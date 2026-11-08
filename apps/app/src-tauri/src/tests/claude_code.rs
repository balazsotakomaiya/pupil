use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use crate::ai::testing::{
    build_run_args, candidate_paths, check_binary_name, child_path_var, classify_run_error,
    discover_binary, evaluate_auth, parse_auth_status, parse_run_output, parse_version,
    validate_binary_path, ClaudeAuthStatus, CommandOutput, DiscoveryEnv,
};
use crate::error::{AiConnectionReason, AppError};

fn reason(error: &AppError) -> Option<AiConnectionReason> {
    match error {
        AppError::AiConnection { reason, .. } => Some(*reason),
        _ => None,
    }
}

fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("pupil-claude-test-{name}-{}", nanoid::nanoid!(8)));
    std::fs::create_dir_all(&dir).expect("create temp dir");
    dir
}

fn output(success: bool, stdout: &str) -> CommandOutput {
    CommandOutput {
        success,
        stdout: stdout.to_string(),
        stderr: String::new(),
    }
}

// Captured from a real `claude -p --output-format json` run (Claude Code
// 2.1.263, Max plan), trimmed to the fields Pupil reads.
const REAL_SUCCESS: &str = r#"{"type":"result","subtype":"success","is_error":false,"api_error_status":null,"result":"ok","modelUsage":{"claude-haiku-4-5-20251001":{"inputTokens":896,"outputTokens":2},"claude-opus-5":{"inputTokens":505,"outputTokens":4}},"total_cost_usd":0.002625}"#;
const REAL_UNKNOWN_MODEL: &str = r#"{"type":"result","subtype":"success","is_error":true,"api_error_status":404,"result":"There's an issue with the selected model (claude-nonexistent-9). It may not exist or you may not have access to it."}"#;
const REAL_AUTH_STATUS: &str = r#"{"loggedIn":true,"authMethod":"claude.ai","apiProvider":"firstParty","subscriptionType":"max","email":"learner@example.com"}"#;

#[test]
fn a_successful_run_returns_the_result_text_and_resolved_model() {
    let parsed = parse_run_output(&output(true, REAL_SUCCESS), "opus").expect("result");
    assert_eq!(parsed.text, "ok");
    assert_eq!(parsed.model.as_deref(), Some("claude-opus-5"));
}

#[test]
fn a_run_with_log_lines_before_the_result_still_parses() {
    let stdout = format!("[claude-code:notice] something\n{REAL_SUCCESS}\n");
    assert_eq!(
        parse_run_output(&output(true, &stdout), "opus")
            .unwrap()
            .text,
        "ok"
    );
}

#[test]
fn an_unknown_model_is_reported_as_unavailable() {
    let error = parse_run_output(&output(false, REAL_UNKNOWN_MODEL), "claude-nonexistent-9")
        .expect_err("model error");
    assert_eq!(reason(&error), Some(AiConnectionReason::ModelUnavailable));
}

#[test]
fn run_failures_map_to_specific_remedies() {
    let cases = [
        (
            Some(429),
            "Claude AI usage limit reached|1700000000",
            Some(AiConnectionReason::UsageLimit),
        ),
        (
            None,
            "You've hit your usage limit",
            Some(AiConnectionReason::UsageLimit),
        ),
        (
            Some(401),
            "OAuth token has expired. Please run /login",
            Some(AiConnectionReason::Expired),
        ),
        (
            Some(403),
            "Forbidden",
            Some(AiConnectionReason::NotEligible),
        ),
        (Some(529), "Overloaded", None),
    ];
    for (status, text, expected) in cases {
        assert_eq!(
            reason(&classify_run_error(status, text, "opus")),
            expected,
            "{text}"
        );
    }
}

#[test]
fn overloaded_claude_stays_retryable_like_other_server_errors() {
    let error = classify_run_error(Some(529), "Overloaded", "opus");
    assert!(crate::ai::testing::is_transient_ai_error(&error));
}

#[test]
fn a_run_with_no_json_result_reports_what_claude_code_printed() {
    let command = CommandOutput {
        success: false,
        stdout: String::new(),
        stderr: "error: unknown option '--tools'".to_string(),
    };
    match parse_run_output(&command, "opus").expect_err("no result") {
        AppError::AiProvider { detail, .. } => {
            assert!(detail.unwrap_or_default().contains("unknown option"))
        }
        other => panic!("unexpected {other:?}"),
    }
}

#[test]
fn auth_status_from_a_subscription_sign_in_is_accepted() {
    let status = parse_auth_status(REAL_AUTH_STATUS).expect("status");
    assert_eq!(status.subscription_type.as_deref(), Some("max"));
    assert!(evaluate_auth(&status).is_ok());
}

#[test]
fn auth_status_rejects_signed_out_api_billing_and_cloud_providers() {
    let base = parse_auth_status(REAL_AUTH_STATUS).unwrap();
    let cases = [
        (
            ClaudeAuthStatus {
                logged_in: false,
                ..base.clone()
            },
            AiConnectionReason::SignedOut,
        ),
        (
            ClaudeAuthStatus {
                auth_method: Some("api_key".into()),
                ..base.clone()
            },
            AiConnectionReason::ApiBilling,
        ),
        (
            ClaudeAuthStatus {
                api_provider: Some("bedrock".into()),
                ..base.clone()
            },
            AiConnectionReason::ApiBilling,
        ),
    ];
    for (status, expected) in cases {
        assert_eq!(
            reason(&evaluate_auth(&status).expect_err("rejected")),
            Some(expected)
        );
    }
}

#[test]
fn an_old_claude_code_without_auth_status_asks_for_an_update() {
    let error = parse_auth_status("error: unknown command 'auth'").expect_err("old version");
    assert_eq!(reason(&error), Some(AiConnectionReason::NotInstalled));
}

#[test]
fn version_is_read_from_the_first_token() {
    assert_eq!(
        parse_version("2.1.263 (Claude Code)\n").as_deref(),
        Some("2.1.263")
    );
    assert_eq!(parse_version("claude: not found"), None);
}

#[test]
fn run_arguments_disable_tools_and_never_include_prompt_text() {
    let args = build_run_args("opus", Path::new("/tmp/system.txt"));
    let text: Vec<String> = args
        .iter()
        .map(|arg| arg.to_string_lossy().into_owned())
        .collect();
    let after = |flag: &str| text[text.iter().position(|arg| arg == flag).unwrap() + 1].clone();

    assert_eq!(after("--tools"), "");
    assert_eq!(after("--model"), "opus");
    assert_eq!(after("--output-format"), "json");
    assert_eq!(after("--setting-sources"), "");
    assert_eq!(after("--system-prompt-file"), "/tmp/system.txt");
    assert!(text.contains(&"--no-session-persistence".to_string()));
    assert!(text.contains(&"--strict-mcp-config".to_string()));
}

#[test]
fn model_names_that_could_be_read_as_flags_are_rejected() {
    use crate::ai::testing::validate_claude_model;
    assert!(validate_claude_model("opus").is_ok());
    assert!(validate_claude_model("claude-opus-5[1m]").is_ok());
    assert!(validate_claude_model("--dangerously-skip-permissions").is_err());
    assert!(validate_claude_model("opus; rm -rf /").is_err());
}

#[test]
fn binary_paths_must_be_absolute_and_name_the_claude_program() {
    let name = if cfg!(windows) {
        "claude.exe"
    } else {
        "claude"
    };
    let root = if cfg!(windows) {
        "C:\\tools\\"
    } else {
        "/opt/tools/"
    };
    assert!(validate_binary_path(&format!("{root}{name}")).is_ok());
    assert!(validate_binary_path(name).is_err());
    assert!(validate_binary_path(&format!("{root}python")).is_err());
    assert!(validate_binary_path(&format!("{root}{name}\n")).is_ok());
    assert!(validate_binary_path(&format!("{root}cla\u{0}ude")).is_err());
}

#[test]
fn windows_accepts_only_the_native_claude_exe() {
    assert!(check_binary_name("claude.exe", true).is_ok());
    assert!(check_binary_name("CLAUDE.EXE", true).is_ok());
    for shim in ["claude.cmd", "claude.bat", "claude.ps1"] {
        let message = check_binary_name(shim, true).expect_err(shim);
        assert!(message.contains("native Claude Code"), "{shim}: {message}");
    }
    assert!(check_binary_name("node.exe", true).is_err());
}

#[test]
fn macos_and_linux_accept_only_a_program_named_claude() {
    assert!(check_binary_name("claude", false).is_ok());
    assert!(check_binary_name("claude.cmd", false).is_err());
    assert!(check_binary_name("bash", false).is_err());
}

#[test]
fn discovery_checks_common_install_folders_beyond_path() {
    let home = PathBuf::from(if cfg!(windows) {
        "C:\\Users\\learner"
    } else {
        "/home/learner"
    });
    let env = DiscoveryEnv {
        path_var: None,
        home: Some(home.clone()),
        app_data: None,
    };
    let candidates = candidate_paths(&env);
    assert!(candidates
        .iter()
        .any(|path| path.starts_with(home.join(".local").join("bin"))));
    assert!(candidates
        .iter()
        .any(|path| path.starts_with(home.join(".claude").join("local"))));
}

#[test]
fn discovery_finds_an_installed_binary_and_reports_a_missing_one() {
    let dir = temp_dir("discover");
    let name = if cfg!(windows) {
        "claude.exe"
    } else {
        "claude"
    };
    let env = DiscoveryEnv {
        path_var: Some(std::env::join_paths([dir.clone()]).unwrap()),
        home: None,
        app_data: None,
    };
    let missing = discover_binary(None, &DiscoveryEnv::default());
    // A real install may exist on the machine running the tests; only an
    // empty environment is guaranteed to come up empty.
    if let Err(error) = missing {
        assert_eq!(reason(&error), Some(AiConnectionReason::NotInstalled));
    }

    std::fs::write(dir.join(name), "").unwrap();
    assert_eq!(discover_binary(None, &env).unwrap(), dir.join(name));
    let custom = discover_binary(
        Some(&dir.join(name).display().to_string()),
        &DiscoveryEnv::default(),
    );
    assert_eq!(custom.unwrap(), dir.join(name));
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn a_custom_path_to_nothing_is_reported_as_not_installed() {
    let dir = temp_dir("custom-missing");
    let name = if cfg!(windows) {
        "claude.exe"
    } else {
        "claude"
    };
    let error = discover_binary(
        Some(&dir.join(name).display().to_string()),
        &DiscoveryEnv::default(),
    )
    .expect_err("missing");
    assert_eq!(reason(&error), Some(AiConnectionReason::NotInstalled));
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn the_child_path_starts_with_the_binary_folder() {
    let binary = PathBuf::from(if cfg!(windows) {
        "C:\\tools\\claude.exe"
    } else {
        "/opt/tools/claude"
    });
    let path = child_path_var(&binary, &DiscoveryEnv::default());
    let first = std::env::split_paths(&path).next().unwrap();
    assert_eq!(first, binary.parent().unwrap());
}

#[cfg(unix)]
mod subprocess {
    //! Runs fake `claude` scripts to check the real process handling:
    //! arguments, stdin, environment, timeouts and cancellation.
    use super::*;
    use crate::ai::testing::{
        execute_claude_code_completion, run_bounded, run_command, CancelToken, ClaudeCodeTarget,
    };
    use crate::ai::AiRequestRegistry;
    use std::os::unix::fs::PermissionsExt;

    fn fake_claude(dir: &Path, auth_method: &str, run_body: &str) -> PathBuf {
        let path = dir.join("claude");
        let script = format!(
            r#"#!/bin/sh
case "$1" in
  --version) echo "9.9.9 (Claude Code)";;
  auth) echo '{{"loggedIn":true,"authMethod":"{auth_method}","apiProvider":"firstParty","subscriptionType":"pro"}}';;
  -p)
    while [ $# -gt 0 ]; do
      case "$1" in
        --system-prompt-file) SYSTEM_FILE="$2"; shift;;
        --model) MODEL="$2"; shift;;
      esac
      shift
    done
    {run_body}
    ;;
esac
"#
        );
        std::fs::write(&path, script).unwrap();
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).unwrap();
        path
    }

    fn target(binary: PathBuf, workdir: &Path) -> ClaudeCodeTarget {
        ClaudeCodeTarget {
            binary,
            model: "opus".to_string(),
            max_tokens: 4096,
            workdir: workdir.join("work"),
        }
    }

    #[tokio::test]
    async fn a_completion_sends_the_prompt_on_stdin_and_the_system_prompt_as_a_file() {
        let dir = temp_dir("success");
        let binary = fake_claude(
            &dir,
            "claude.ai",
            r#"USER=$(cat); SYSTEM=$(cat "$SYSTEM_FILE"); printf '{"type":"result","subtype":"success","is_error":false,"result":"%s|%s|%s|%s"}\n' "$MODEL" "$SYSTEM" "$USER" "$CLAUDE_CODE_MAX_OUTPUT_TOKENS""#,
        );
        let target = target(binary, &dir);

        let output = execute_claude_code_completion(
            &target,
            "make cards",
            Some("be brief"),
            &CancelToken::none(),
        )
        .await
        .expect("completion");

        assert_eq!(output.text, "opus|be brief|make cards|4096");
        // The per-run system prompt file is removed afterwards.
        let leftovers: Vec<_> = std::fs::read_dir(&target.workdir).unwrap().collect();
        assert!(leftovers.is_empty());
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[tokio::test]
    async fn api_credentials_in_the_environment_never_reach_claude_code() {
        let dir = temp_dir("env");
        let binary = fake_claude(
            &dir,
            "claude.ai",
            r#"cat >/dev/null; printf '{"type":"result","subtype":"success","is_error":false,"result":"key=%s base=%s"}\n' "${ANTHROPIC_API_KEY:-none}" "${ANTHROPIC_BASE_URL:-none}""#,
        );
        std::env::set_var("ANTHROPIC_API_KEY", "sk-ant-should-not-pass");
        std::env::set_var("ANTHROPIC_BASE_URL", "https://proxy.example");

        let output =
            execute_claude_code_completion(&target(binary, &dir), "hi", None, &CancelToken::none())
                .await
                .expect("completion");

        assert_eq!(output.text, "key=none base=none");
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[tokio::test]
    async fn claude_code_on_api_billing_is_refused_before_any_run() {
        let dir = temp_dir("api-billing");
        let marker = dir.join("ran");
        let binary = fake_claude(&dir, "api_key", &format!("touch '{}'", marker.display()));

        let error =
            execute_claude_code_completion(&target(binary, &dir), "hi", None, &CancelToken::none())
                .await
                .expect_err("refused");

        assert_eq!(reason(&error), Some(AiConnectionReason::ApiBilling));
        assert!(!marker.exists());
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[tokio::test]
    async fn switching_claude_code_to_console_billing_stops_the_next_run() {
        // The sign-in is read from a file the "user" rewrites between runs,
        // like `claude auth login --console` in a terminal would.
        let dir = temp_dir("switch-billing");
        let auth_file = dir.join("auth.json");
        let runs = dir.join("runs");
        std::fs::write(
            &auth_file,
            r#"{"loggedIn":true,"authMethod":"claude.ai","apiProvider":"firstParty","subscriptionType":"max"}"#,
        )
        .unwrap();
        let path = dir.join("claude");
        let script = format!(
            "#!/bin/sh\ncase \"$1\" in\n  auth) cat '{auth}';;\n  -p) cat >/dev/null; echo run >> '{runs}'; echo '{{\"type\":\"result\",\"subtype\":\"success\",\"is_error\":false,\"result\":\"ok\"}}';;\nesac\n",
            auth = auth_file.display(),
            runs = runs.display(),
        );
        std::fs::write(&path, script).unwrap();
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).unwrap();
        let target = target(path, &dir);

        execute_claude_code_completion(&target, "hi", None, &CancelToken::none())
            .await
            .expect("first run on the plan");
        std::fs::write(
            &auth_file,
            r#"{"loggedIn":true,"authMethod":"console","apiProvider":"firstParty"}"#,
        )
        .unwrap();
        let error = execute_claude_code_completion(&target, "hi", None, &CancelToken::none())
            .await
            .expect_err("refused after the switch");

        assert_eq!(reason(&error), Some(AiConnectionReason::ApiBilling));
        let launched = std::fs::read_to_string(&runs).unwrap();
        assert_eq!(
            launched.lines().count(),
            1,
            "a second completion was launched"
        );
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[tokio::test]
    async fn a_plan_usage_limit_is_reported_as_such() {
        let dir = temp_dir("limit");
        let binary = fake_claude(
            &dir,
            "claude.ai",
            r#"cat >/dev/null; echo '{"type":"result","subtype":"success","is_error":true,"api_error_status":429,"result":"Claude AI usage limit reached|1700000000"}'; exit 1"#,
        );

        let error =
            execute_claude_code_completion(&target(binary, &dir), "hi", None, &CancelToken::none())
                .await
                .expect_err("limit");

        assert_eq!(reason(&error), Some(AiConnectionReason::UsageLimit));
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[tokio::test]
    async fn an_expired_sign_in_is_reported_as_expired() {
        let dir = temp_dir("expired");
        let binary = fake_claude(
            &dir,
            "claude.ai",
            r#"cat >/dev/null; echo '{"type":"result","subtype":"success","is_error":true,"api_error_status":401,"result":"OAuth token has expired. Please run /login"}'; exit 1"#,
        );

        let error =
            execute_claude_code_completion(&target(binary, &dir), "hi", None, &CancelToken::none())
                .await
                .expect_err("expired");

        assert_eq!(reason(&error), Some(AiConnectionReason::Expired));
        std::fs::remove_dir_all(dir).unwrap();
    }

    fn slow_script(dir: &Path, marker: &Path) -> PathBuf {
        let path = dir.join("claude");
        std::fs::write(
            &path,
            format!("#!/bin/sh\nsleep 2\ntouch '{}'\n", marker.display()),
        )
        .unwrap();
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).unwrap();
        path
    }

    #[tokio::test]
    async fn a_run_past_its_time_limit_is_killed() {
        let dir = temp_dir("timeout");
        let marker = dir.join("finished");
        let binary = slow_script(&dir, &marker);

        let error = run_bounded(
            "claudeCode",
            &CancelToken::none(),
            Duration::from_millis(300),
            "too slow".to_string(),
            run_command(&binary, &[] as &[OsString], "", &dir, &[]),
        )
        .await
        .err()
        .expect("timed out");

        assert_eq!(reason(&error), Some(AiConnectionReason::Timeout));
        tokio::time::sleep(Duration::from_millis(2500)).await;
        assert!(!marker.exists(), "the child kept running after the timeout");
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[tokio::test]
    async fn cancelling_a_request_kills_its_process() {
        let dir = temp_dir("cancel");
        let marker = dir.join("finished");
        let binary = slow_script(&dir, &marker);
        let registry = Arc::new(AiRequestRegistry::default());
        let guard = registry.register(Some("gen-1".to_string()));
        let canceller = Arc::clone(&registry);
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(200)).await;
            assert!(canceller.cancel("gen-1"));
        });

        let error = run_bounded(
            "claudeCode",
            &guard.token,
            Duration::from_secs(10),
            "too slow".to_string(),
            run_command(&binary, &[] as &[OsString], "", &dir, &[]),
        )
        .await
        .err()
        .expect("cancelled");

        assert_eq!(reason(&error), Some(AiConnectionReason::Cancelled));
        tokio::time::sleep(Duration::from_millis(2500)).await;
        assert!(
            !marker.exists(),
            "the child kept running after cancellation"
        );
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[tokio::test]
    async fn concurrent_requests_each_get_their_own_result() {
        let dir = temp_dir("concurrent");
        let binary = fake_claude(
            &dir,
            "claude.ai",
            r#"USER=$(cat); printf '{"type":"result","subtype":"success","is_error":false,"result":"%s"}\n' "$USER""#,
        );
        let target = target(binary, &dir);
        let token = CancelToken::none();

        let (a, b, c, d) = tokio::join!(
            execute_claude_code_completion(&target, "one", None, &token),
            execute_claude_code_completion(&target, "two", None, &token),
            execute_claude_code_completion(&target, "three", None, &token),
            execute_claude_code_completion(&target, "four", None, &token),
        );

        let texts: Vec<String> = [a, b, c, d].into_iter().map(|r| r.unwrap().text).collect();
        assert_eq!(texts, ["one", "two", "three", "four"]);
        std::fs::remove_dir_all(dir).unwrap();
    }
}

/// Live checks against the real, signed-in Claude Code on this machine. They
/// use the user's Claude plan, so they only run when asked for:
/// `cargo test live_claude -- --ignored --nocapture`.
mod live {
    use crate::ai::testing::{
        discover_binary, execute_claude_code_completion, CancelToken, ClaudeCodeTarget,
        DiscoveryEnv,
    };
    use crate::ai::{
        build_explain_card_prompt, build_generate_cards_prompt, parse_explain_card_response,
        parse_generated_cards_response,
    };
    use crate::constants::{AI_EXPLAIN_SYSTEM_PROMPT, AI_SYSTEM_PROMPT};

    fn live_target(model: &str) -> ClaudeCodeTarget {
        let workdir = std::env::temp_dir().join("pupil-claude-live");
        std::fs::create_dir_all(&workdir).unwrap();
        ClaudeCodeTarget {
            binary: discover_binary(None, &DiscoveryEnv::from_process())
                .expect("Claude Code installed"),
            model: model.to_string(),
            max_tokens: 4096,
            workdir,
        }
    }

    #[tokio::test]
    #[ignore = "live: uses the signed-in Claude Code subscription"]
    async fn live_claude_code_generates_valid_cards_with_opus() {
        let target = live_target("opus");
        let prompt = build_generate_cards_prompt(
            "The TCP three-way handshake",
            Some(3),
            "Intermediate",
            "Q&A",
        );
        let started = std::time::Instant::now();
        let output = execute_claude_code_completion(
            &target,
            &prompt,
            Some(AI_SYSTEM_PROMPT),
            &CancelToken::none(),
        )
        .await
        .expect("live generation");
        let cards = parse_generated_cards_response(&output.text, Some(3)).expect("valid card JSON");
        println!("model={:?} elapsed={:?}", output.model, started.elapsed());
        for card in &cards {
            println!("Q: {}\nA: {}\n", card.front, card.back);
        }
        assert_eq!(cards.len(), 3);
        assert!(output.model.unwrap_or_default().contains("opus"));
    }

    #[tokio::test]
    #[ignore = "live: uses the signed-in Claude Code subscription"]
    async fn live_claude_code_explains_a_card_in_the_explanation_contract() {
        let target = live_target("sonnet");
        let prompt = build_explain_card_prompt(
            "What does SYN-ACK acknowledge?",
            "The client's initial sequence number + 1.",
        );
        let output = execute_claude_code_completion(
            &target,
            &prompt,
            Some(AI_EXPLAIN_SYSTEM_PROMPT),
            &CancelToken::none(),
        )
        .await
        .expect("live explanation");
        let payload = parse_explain_card_response(&output.text).expect("valid explanation JSON");
        println!(
            "model={:?} paragraphs={}",
            output.model,
            payload.paragraphs.len()
        );
        assert!(!payload.paragraphs.is_empty());
    }

    #[tokio::test]
    #[ignore = "live: uses the signed-in Claude Code subscription"]
    async fn live_claude_code_reports_an_unavailable_model() {
        let target = live_target("claude-nonexistent-9");
        let error = execute_claude_code_completion(&target, "hi", None, &CancelToken::none())
            .await
            .expect_err("unknown model");
        println!("{error}");
        assert_eq!(
            super::reason(&error),
            Some(crate::error::AiConnectionReason::ModelUnavailable)
        );
    }
}
