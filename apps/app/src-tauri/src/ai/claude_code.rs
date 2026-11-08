//! Claude subscription access through the user's own Claude Code install.
//!
//! Anthropic does not let third-party apps sign users in with Claude.ai or use
//! subscription credentials directly, but it does allow an end user's own,
//! unmodified Claude Code binary, signed in through Anthropic's flow, to run
//! inside other tools. Pupil therefore never sees or stores Claude
//! credentials: it runs `claude -p` as a subprocess, with no tools, and reads
//! the JSON result. See docs/ai-subscriptions.md for the sources.

use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::Semaphore;

use super::cancellation::{run_bounded, CancelToken};
use crate::constants::{
    CLAUDE_CODE_MAX_CONCURRENT_RUNS, CLAUDE_CODE_MAX_OUTPUT_BYTES, CLAUDE_CODE_PROBE_TIMEOUT_SECS,
    CLAUDE_CODE_TIMEOUT_SECS,
};
use crate::error::{AiConnectionReason, AppError, AppResult};

pub(crate) const CLAUDE_CODE_PROVIDER: &str = "claudeCode";

/// Credentials and routing a child must never inherit: any of these would
/// make Claude Code bill an API account or a cloud provider instead of the
/// user's subscription, which Pupil must not do silently.
const STRIPPED_ENV_VARS: &[&str] = &[
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_AUTH_TOKEN",
    "ANTHROPIC_BASE_URL",
    "ANTHROPIC_BEDROCK_BASE_URL",
    "ANTHROPIC_VERTEX_BASE_URL",
    "CLAUDE_CODE_USE_BEDROCK",
    "CLAUDE_CODE_USE_VERTEX",
    "CLAUDE_CODE_USE_FOUNDRY",
    "CLAUDE_CODE_SIMPLE",
];

const AUTH_CACHE_TTL: Duration = Duration::from_secs(300);

/// How Pupil reaches Claude Code for one request.
#[derive(Clone, Debug)]
pub(crate) struct ClaudeCodeTarget {
    pub(crate) binary: PathBuf,
    pub(crate) model: String,
    pub(crate) max_tokens: i64,
    pub(crate) workdir: PathBuf,
}

/// What Settings shows about the local Claude Code install.
#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ClaudeCodeStatus {
    pub(crate) installed: bool,
    pub(crate) path: Option<String>,
    pub(crate) version: Option<String>,
    pub(crate) logged_in: bool,
    pub(crate) subscription_type: Option<String>,
    pub(crate) email: Option<String>,
    pub(crate) usable: bool,
    pub(crate) reason: Option<AiConnectionReason>,
    pub(crate) message: String,
}

#[derive(Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ClaudeAuthStatus {
    #[serde(default)]
    pub(crate) logged_in: bool,
    #[serde(default)]
    pub(crate) auth_method: Option<String>,
    #[serde(default)]
    pub(crate) api_provider: Option<String>,
    #[serde(default)]
    pub(crate) subscription_type: Option<String>,
    #[serde(default)]
    pub(crate) email: Option<String>,
}

#[derive(Debug, PartialEq)]
pub(crate) struct ClaudeRunOutput {
    pub(crate) text: String,
    pub(crate) model: Option<String>,
}

pub(crate) struct CommandOutput {
    pub(crate) success: bool,
    pub(crate) stdout: String,
    pub(crate) stderr: String,
}

/// The environment discovery looks at, split out so tests can supply one.
#[derive(Clone, Debug, Default)]
pub(crate) struct DiscoveryEnv {
    pub(crate) path_var: Option<OsString>,
    pub(crate) home: Option<PathBuf>,
    pub(crate) app_data: Option<PathBuf>,
}

impl DiscoveryEnv {
    pub(crate) fn from_process() -> Self {
        Self {
            path_var: std::env::var_os("PATH"),
            home: std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" })
                .map(PathBuf::from),
            app_data: std::env::var_os("APPDATA").map(PathBuf::from),
        }
    }
}

fn binary_names() -> &'static [&'static str] {
    if cfg!(windows) {
        &["claude.exe", "claude.cmd"]
    } else {
        &["claude"]
    }
}

/// Places Claude Code's installers put the binary. A desktop app launched
/// from the Dock or Start menu does not inherit the shell's PATH, so PATH
/// alone misses most installs.
pub(crate) fn candidate_paths(env: &DiscoveryEnv) -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = env
        .path_var
        .as_ref()
        .map(|value| std::env::split_paths(value).collect())
        .unwrap_or_default();
    if let Some(home) = &env.home {
        dirs.push(home.join(".local").join("bin"));
        dirs.push(home.join(".claude").join("local"));
        dirs.push(home.join(".npm-global").join("bin"));
        dirs.push(home.join(".bun").join("bin"));
        dirs.push(home.join(".volta").join("bin"));
    }
    if cfg!(windows) {
        if let Some(app_data) = &env.app_data {
            dirs.push(app_data.join("npm"));
        }
    } else {
        dirs.push(PathBuf::from("/opt/homebrew/bin"));
        dirs.push(PathBuf::from("/usr/local/bin"));
        dirs.push(PathBuf::from("/usr/bin"));
    }
    let mut seen = std::collections::HashSet::new();
    dirs.into_iter()
        .filter(|dir| dir.is_absolute())
        .flat_map(|dir| binary_names().iter().map(move |name| dir.join(name)))
        .filter(|path| seen.insert(path.clone()))
        .collect()
}

/// Accepts only an absolute path to an existing file named like the Claude
/// Code binary. The path is passed straight to the OS as the program, never
/// through a shell, so this is about not running an arbitrary program.
pub(crate) fn validate_binary_path(raw: &str) -> Result<PathBuf, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("Enter the full path to the claude program.".to_string());
    }
    if trimmed.len() > 1024 || trimmed.chars().any(char::is_control) {
        return Err("That path isn't valid.".to_string());
    }
    let path = PathBuf::from(trimmed);
    if !path.is_absolute() {
        return Err("Use the full path to the claude program, starting from the root.".to_string());
    }
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if !binary_names().contains(&name.as_str()) {
        return Err(format!(
            "The path must point to the Claude Code program ({}).",
            binary_names().join(" or ")
        ));
    }
    Ok(path)
}

fn is_runnable_file(path: &Path) -> bool {
    std::fs::metadata(path)
        .map(|metadata| metadata.is_file())
        .unwrap_or(false)
}

/// Finds the binary: an explicit path wins, otherwise the first candidate
/// that exists.
pub(crate) fn discover_binary(custom: Option<&str>, env: &DiscoveryEnv) -> AppResult<PathBuf> {
    if let Some(custom) = custom.filter(|value| !value.trim().is_empty()) {
        let path = validate_binary_path(custom).map_err(|message| {
            AppError::ai_connection(
                CLAUDE_CODE_PROVIDER,
                AiConnectionReason::NotInstalled,
                message,
            )
        })?;
        if !is_runnable_file(&path) {
            return Err(AppError::ai_connection(
                CLAUDE_CODE_PROVIDER,
                AiConnectionReason::NotInstalled,
                "Nothing is installed at the Claude Code path in Settings.",
            ));
        }
        return Ok(path);
    }
    candidate_paths(env)
        .into_iter()
        .find(|path| is_runnable_file(path))
        .ok_or_else(not_installed_error)
}

fn not_installed_error() -> AppError {
    AppError::ai_connection(
        CLAUDE_CODE_PROVIDER,
        AiConnectionReason::NotInstalled,
        "Claude Code isn't installed. Install it, sign in with your Claude account, then check again in Settings.",
    )
}

/// Extends the child's PATH with the binary's own folder and the usual tool
/// folders, so an npm-installed `claude` can find `node` when Pupil was
/// launched from the Dock with a minimal PATH.
pub(crate) fn child_path_var(binary: &Path, env: &DiscoveryEnv) -> OsString {
    let mut dirs: Vec<PathBuf> = Vec::new();
    if let Some(parent) = binary.parent() {
        dirs.push(parent.to_path_buf());
    }
    if let Some(value) = &env.path_var {
        dirs.extend(std::env::split_paths(value));
    }
    if !cfg!(windows) {
        dirs.push(PathBuf::from("/opt/homebrew/bin"));
        dirs.push(PathBuf::from("/usr/local/bin"));
        dirs.push(PathBuf::from("/usr/bin"));
        dirs.push(PathBuf::from("/bin"));
    }
    let mut seen = std::collections::HashSet::new();
    dirs.retain(|dir| seen.insert(dir.clone()));
    std::env::join_paths(dirs).unwrap_or_default()
}

pub(crate) fn validate_model(raw: &str) -> Result<String, String> {
    let model = raw.trim();
    if model.is_empty() {
        return Err("Choose a Claude model.".to_string());
    }
    let valid = model.len() <= 100
        && !model.starts_with('-')
        && model
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || "-._:[]".contains(ch));
    if !valid {
        return Err("Claude model names use letters, numbers, dots and dashes.".to_string());
    }
    Ok(model.to_string())
}

/// Arguments for one non-interactive run. Every value is a fixed flag, a
/// validated model name, or a path Pupil created; prompts go through stdin
/// and a file so no user text is ever an argument.
pub(crate) fn build_run_args(model: &str, system_prompt_file: &Path) -> Vec<OsString> {
    let mut args: Vec<OsString> = [
        "-p",
        "--output-format",
        "json",
        "--model",
        model,
        // No tools, MCP servers, skills or settings files: the run is a plain
        // completion, not an agent that can touch the machine.
        "--tools",
        "",
        "--strict-mcp-config",
        "--disable-slash-commands",
        "--setting-sources",
        "",
        "--no-session-persistence",
        "--system-prompt-file",
    ]
    .iter()
    .map(OsString::from)
    .collect();
    args.push(system_prompt_file.as_os_str().to_owned());
    args
}

pub(crate) fn parse_version(stdout: &str) -> Option<String> {
    stdout
        .split_whitespace()
        .next()
        .filter(|token| token.chars().next().is_some_and(|ch| ch.is_ascii_digit()))
        .map(str::to_string)
}

pub(crate) fn parse_auth_status(stdout: &str) -> AppResult<ClaudeAuthStatus> {
    let candidate = last_json_object_line(stdout).unwrap_or_else(|| stdout.trim().to_string());
    serde_json::from_str(&candidate).map_err(|_| {
        AppError::ai_connection(
            CLAUDE_CODE_PROVIDER,
            AiConnectionReason::NotInstalled,
            "This version of Claude Code can't report its sign-in. Update Claude Code, then check again.",
        )
    })
}

/// Only a Claude subscription sign-in is acceptable: an API key or cloud
/// provider would bill a different account than the user chose.
pub(crate) fn evaluate_auth(status: &ClaudeAuthStatus) -> AppResult<()> {
    if !status.logged_in {
        return Err(AppError::ai_connection(
            CLAUDE_CODE_PROVIDER,
            AiConnectionReason::SignedOut,
            "Claude Code isn't signed in. Run `claude auth login` in a terminal, sign in with your Claude account, then check again.",
        ));
    }
    let provider = status.api_provider.as_deref().unwrap_or("firstParty");
    if provider != "firstParty" {
        return Err(AppError::ai_connection(
            CLAUDE_CODE_PROVIDER,
            AiConnectionReason::ApiBilling,
            "Claude Code is set up to use a cloud provider, not a Claude subscription. Pupil only uses Claude Code with a Claude plan.",
        ));
    }
    let method = status.auth_method.as_deref().unwrap_or_default();
    if !matches!(method, "claude.ai" | "oauth_token") {
        return Err(AppError::ai_connection(
            CLAUDE_CODE_PROVIDER,
            AiConnectionReason::ApiBilling,
            "Claude Code is signed in with API billing, not a Claude subscription. Run `claude auth login --claudeai` to use your plan, or use an API key connection instead.",
        ));
    }
    Ok(())
}

fn last_json_object_line(stdout: &str) -> Option<String> {
    let trimmed = stdout.trim();
    if trimmed.starts_with('{') && serde_json::from_str::<Value>(trimmed).is_ok() {
        return Some(trimmed.to_string());
    }
    stdout
        .lines()
        .rev()
        .map(str::trim)
        .find(|line| line.starts_with('{') && serde_json::from_str::<Value>(line).is_ok())
        .map(str::to_string)
}

/// Reads the `--output-format json` result object.
pub(crate) fn parse_run_output(
    command: &CommandOutput,
    requested_model: &str,
) -> AppResult<ClaudeRunOutput> {
    let Some(line) = last_json_object_line(&command.stdout) else {
        let detail = truncate(command.stderr.trim(), 240);
        return Err(AppError::ai_provider(
            "Claude Code stopped without a result.",
            (!detail.is_empty()).then_some(detail),
        ));
    };
    let payload: Value = serde_json::from_str(&line)
        .map_err(|_| AppError::ai_provider("Claude Code returned invalid JSON.", None::<String>))?;
    let text = payload
        .get("result")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let is_error = payload
        .get("is_error")
        .and_then(Value::as_bool)
        .unwrap_or(!command.success);
    if is_error || payload.get("subtype").and_then(Value::as_str) != Some("success") {
        let status = payload
            .get("api_error_status")
            .and_then(Value::as_u64)
            .and_then(|status| u16::try_from(status).ok());
        return Err(classify_run_error(status, &text, requested_model));
    }
    if text.trim().is_empty() {
        return Err(AppError::ai_provider(
            "Claude Code returned an empty response.",
            None::<String>,
        ));
    }
    // Claude Code also makes small side calls on a lighter model, so the
    // model that wrote the answer is the one with the most output tokens.
    let model = payload
        .get("modelUsage")
        .and_then(Value::as_object)
        .and_then(|usage| {
            usage
                .iter()
                .max_by_key(|(_, entry)| {
                    entry
                        .get("outputTokens")
                        .and_then(Value::as_u64)
                        .unwrap_or(0)
                })
                .map(|(name, _)| name.clone())
        });
    Ok(ClaudeRunOutput { text, model })
}

pub(crate) fn classify_run_error(status: Option<u16>, text: &str, model: &str) -> AppError {
    let lowered = text.to_ascii_lowercase();
    let reason = if matches!(status, Some(429))
        || lowered.contains("usage limit")
        || lowered.contains("limit reached")
        || lowered.contains("rate limit")
    {
        Some((
            AiConnectionReason::UsageLimit,
            "Your Claude plan's usage limit was reached. Try again after it resets.".to_string(),
        ))
    } else if matches!(status, Some(401))
        || lowered.contains("/login")
        || lowered.contains("oauth token")
        || lowered.contains("not logged in")
        || lowered.contains("invalid api key")
    {
        Some((
            AiConnectionReason::Expired,
            "Claude Code's sign-in has expired. Run `claude auth login` in a terminal, then test the connection again.".to_string(),
        ))
    } else if matches!(status, Some(403)) {
        Some((
            AiConnectionReason::NotEligible,
            "Your Claude account can't use Claude Code right now. Check your plan, then test again.".to_string(),
        ))
    } else if matches!(status, Some(404)) || lowered.contains("selected model") {
        Some((
            AiConnectionReason::ModelUnavailable,
            format!("Claude Code can't use the model \"{model}\" on your plan. Choose another model in Settings."),
        ))
    } else {
        None
    };
    if let Some((reason, message)) = reason {
        return AppError::ai_connection(CLAUDE_CODE_PROVIDER, reason, message);
    }
    // Keep the HTTP status in the detail so the explain retry treats 5xx and
    // overload as transient, like the API transport.
    let detail = match status {
        Some(code) => format!("HTTP {code}: {}", truncate(text, 240)),
        None => truncate(text, 240),
    };
    AppError::ai_provider("Claude Code couldn't complete the request.", Some(detail))
}

fn truncate(text: &str, limit: usize) -> String {
    let collapsed = text.split_whitespace().collect::<Vec<_>>().join(" ");
    let mut chars = collapsed.chars();
    let head: String = chars.by_ref().take(limit).collect();
    if chars.next().is_some() {
        format!("{head}…")
    } else {
        head
    }
}

fn run_semaphore() -> &'static Semaphore {
    static SEMAPHORE: OnceLock<Semaphore> = OnceLock::new();
    SEMAPHORE.get_or_init(|| Semaphore::new(CLAUDE_CODE_MAX_CONCURRENT_RUNS))
}

/// Spawns the binary directly (no shell), feeds stdin, and reads bounded
/// output. The child is killed if this future is dropped, so cancellation and
/// timeouts never leave a process behind.
pub(crate) async fn run_command(
    binary: &Path,
    args: &[OsString],
    stdin_text: &str,
    workdir: &Path,
    extra_env: &[(&str, String)],
) -> AppResult<CommandOutput> {
    let env = DiscoveryEnv::from_process();
    let mut command = tokio::process::Command::new(binary);
    command
        .args(args)
        .current_dir(workdir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .env("PATH", child_path_var(binary, &env))
        .env("DISABLE_AUTOUPDATER", "1");
    for name in STRIPPED_ENV_VARS {
        command.env_remove(name);
    }
    for (name, value) in extra_env {
        command.env(name, value);
    }
    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = command.spawn().map_err(|error| match error.kind() {
        std::io::ErrorKind::NotFound => not_installed_error(),
        _ => AppError::ai_connection(
            CLAUDE_CODE_PROVIDER,
            AiConnectionReason::NotInstalled,
            format!("Claude Code couldn't start: {error}"),
        ),
    })?;

    let mut stdin = child.stdin.take();
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let input = stdin_text.as_bytes().to_vec();
    let write = async move {
        if let Some(mut stdin) = stdin.take() {
            // A child that exits early closes the pipe; that is not our error.
            let _ = stdin.write_all(&input).await;
            let _ = stdin.shutdown().await;
        }
    };
    let read_stdout = read_bounded(stdout);
    let read_stderr = read_bounded(stderr);
    let ((), stdout, stderr, status) = tokio::join!(write, read_stdout, read_stderr, child.wait());
    let status = status.map_err(|error| {
        AppError::ai_provider(
            "Claude Code didn't finish cleanly.",
            Some(error.to_string()),
        )
    })?;

    Ok(CommandOutput {
        success: status.success(),
        stdout,
        stderr,
    })
}

async fn read_bounded(pipe: Option<impl tokio::io::AsyncRead + Unpin>) -> String {
    let Some(pipe) = pipe else {
        return String::new();
    };
    let mut buffer = Vec::new();
    let mut limited = pipe.take(CLAUDE_CODE_MAX_OUTPUT_BYTES as u64);
    let _ = limited.read_to_end(&mut buffer).await;
    String::from_utf8_lossy(&buffer).into_owned()
}

/// Checks the install and its sign-in. Never fails: problems are described
/// in the returned status so Settings can show them.
pub(crate) async fn probe_status(custom_path: Option<&str>, workdir: &Path) -> ClaudeCodeStatus {
    let mut status = ClaudeCodeStatus {
        installed: false,
        path: None,
        version: None,
        logged_in: false,
        subscription_type: None,
        email: None,
        usable: false,
        reason: None,
        message: String::new(),
    };
    let binary = match discover_binary(custom_path, &DiscoveryEnv::from_process()) {
        Ok(binary) => binary,
        Err(error) => return fill_error(status, error),
    };
    status.path = Some(binary.display().to_string());
    let timeout = Duration::from_secs(CLAUDE_CODE_PROBE_TIMEOUT_SECS);
    let token = CancelToken::none();

    let version = run_bounded(
        CLAUDE_CODE_PROVIDER,
        &token,
        timeout,
        "Claude Code didn't answer in time.".to_string(),
        run_command(&binary, &[OsString::from("--version")], "", workdir, &[]),
    )
    .await;
    match version {
        Ok(output) if output.success => {
            status.installed = true;
            status.version = parse_version(&output.stdout);
        }
        Ok(_) => {
            return fill_error(
                status,
                AppError::ai_connection(
                    CLAUDE_CODE_PROVIDER,
                    AiConnectionReason::NotInstalled,
                    "Claude Code is installed but couldn't start. Run `claude --version` in a terminal to see why.",
                ),
            )
        }
        Err(error) => return fill_error(status, error),
    }

    match check_auth(&binary, workdir, false).await {
        Ok(auth) => {
            status.logged_in = auth.logged_in;
            status.subscription_type = auth.subscription_type.clone();
            status.email = auth.email.clone();
            status.usable = true;
            status.message = match auth.subscription_type.as_deref() {
                Some(plan) if !plan.is_empty() => {
                    format!("Signed in with a Claude {} plan.", title_case(plan))
                }
                _ => "Signed in with a Claude subscription.".to_string(),
            };
            status
        }
        Err((auth, error)) => {
            if let Some(auth) = auth {
                status.logged_in = auth.logged_in;
                status.email = auth.email;
            }
            fill_error(status, error)
        }
    }
}

fn fill_error(mut status: ClaudeCodeStatus, error: AppError) -> ClaudeCodeStatus {
    match error {
        AppError::AiConnection {
            message, reason, ..
        } => {
            status.reason = Some(reason);
            status.message = message;
        }
        other => {
            status.reason = Some(AiConnectionReason::Provider);
            status.message = other.to_string();
        }
    }
    status
}

fn title_case(value: &str) -> String {
    let mut chars = value.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
        None => String::new(),
    }
}

fn auth_cache() -> &'static Mutex<Option<(PathBuf, Instant, ClaudeAuthStatus)>> {
    static CACHE: OnceLock<Mutex<Option<(PathBuf, Instant, ClaudeAuthStatus)>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(None))
}

type AuthCheckError = (Option<ClaudeAuthStatus>, AppError);

/// Confirms Claude Code is signed in with a subscription. A good result is
/// cached briefly so each generation doesn't pay for a second process.
async fn check_auth(
    binary: &Path,
    workdir: &Path,
    use_cache: bool,
) -> Result<ClaudeAuthStatus, AuthCheckError> {
    if use_cache {
        if let Ok(cache) = auth_cache().lock() {
            if let Some((path, at, status)) = cache.as_ref() {
                if path == binary && at.elapsed() < AUTH_CACHE_TTL {
                    return Ok(status.clone());
                }
            }
        }
    }
    let output = run_bounded(
        CLAUDE_CODE_PROVIDER,
        &CancelToken::none(),
        Duration::from_secs(CLAUDE_CODE_PROBE_TIMEOUT_SECS),
        "Claude Code didn't report its sign-in in time.".to_string(),
        run_command(
            binary,
            &["auth", "status", "--json"].map(OsString::from),
            "",
            workdir,
            &[],
        ),
    )
    .await
    .map_err(|error| (None, error))?;
    let auth = parse_auth_status(&output.stdout).map_err(|error| (None, error))?;
    evaluate_auth(&auth).map_err(|error| (Some(auth.clone()), error))?;
    if let Ok(mut cache) = auth_cache().lock() {
        *cache = Some((binary.to_path_buf(), Instant::now(), auth.clone()));
    }
    Ok(auth)
}

pub(crate) fn forget_cached_auth() {
    if let Ok(mut cache) = auth_cache().lock() {
        *cache = None;
    }
}

/// Removes the per-run system prompt file however the run ends.
struct TempFile(PathBuf);

impl Drop for TempFile {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.0);
    }
}

fn write_private_file(path: &Path, contents: &str) -> std::io::Result<()> {
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    use std::io::Write;
    options.open(path)?.write_all(contents.as_bytes())
}

/// Runs one completion through Claude Code and returns its text.
pub(crate) async fn execute_claude_code_completion(
    target: &ClaudeCodeTarget,
    user_prompt: &str,
    system_prompt: Option<&str>,
    token: &CancelToken,
) -> AppResult<ClaudeRunOutput> {
    let _permit = tokio::select! {
        permit = run_semaphore().acquire() => permit.map_err(|_| {
            AppError::internal_message("The Claude Code queue was closed.")
        })?,
        () = token.cancelled() => return Err(super::cancellation::cancelled_error(CLAUDE_CODE_PROVIDER)),
    };
    std::fs::create_dir_all(&target.workdir)?;
    check_auth(&target.binary, &target.workdir, true)
        .await
        .map_err(|(_, error)| error)?;

    let prompt_file = TempFile(
        target
            .workdir
            .join(format!("system-{}.txt", nanoid::nanoid!(12))),
    );
    write_private_file(&prompt_file.0, system_prompt.unwrap_or_default())?;
    let args = build_run_args(&target.model, &prompt_file.0);
    let extra_env = [(
        "CLAUDE_CODE_MAX_OUTPUT_TOKENS",
        target.max_tokens.to_string(),
    )];

    let output = run_bounded(
        CLAUDE_CODE_PROVIDER,
        token,
        Duration::from_secs(CLAUDE_CODE_TIMEOUT_SECS),
        format!("Claude Code didn't finish within {CLAUDE_CODE_TIMEOUT_SECS}s. Try again, or ask for fewer cards."),
        run_command(&target.binary, &args, user_prompt, &target.workdir, &extra_env),
    )
    .await?;
    let result = parse_run_output(&output, &target.model);
    if let Err(AppError::AiConnection {
        reason: AiConnectionReason::Expired,
        ..
    }) = &result
    {
        forget_cached_auth();
    }
    result
}
