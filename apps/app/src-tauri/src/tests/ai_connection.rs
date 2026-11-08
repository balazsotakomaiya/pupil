use std::path::PathBuf;
use std::sync::Arc;

use rusqlite::Connection;

use super::support::open_test_connection;
use crate::ai::testing::{
    load_ai_settings_rows, persist_ai_settings_rows, record_claude_code_ready, resolve_ai_target,
    AiConnectionKind, AiDraft, DiscoveryEnv,
};
use crate::ai::{
    normalize_ai_settings_input, record_chatgpt_status, AiRequestRegistry, ChatgptStatus,
    ResolvedAiTarget,
};
use crate::error::{AiConnectionReason, AppError};
use crate::migration_runner::apply_migrations;
use crate::migrations::MIGRATIONS;
use crate::types::{NormalizedAiSettingsInput, SaveAiSettingsInput};

fn reason(error: &AppError) -> Option<AiConnectionReason> {
    match error {
        AppError::AiConnection { reason, .. } => Some(*reason),
        _ => None,
    }
}

fn input(connection: Option<&str>) -> SaveAiSettingsInput {
    SaveAiSettingsInput {
        api_key: None,
        base_url: "https://api.openai.com/v1".to_string(),
        model: "gpt-5.6-terra".to_string(),
        max_tokens: "4096".to_string(),
        temperature: "0.7".to_string(),
        explain_enabled: None,
        connection: connection.map(str::to_string),
        chatgpt_model: None,
        claude_code_model: None,
        claude_code_path: None,
    }
}

fn normalized(connection: Option<&str>) -> NormalizedAiSettingsInput {
    normalize_ai_settings_input(input(connection)).expect("normalize")
}

fn draft(connection: &Connection) -> AiDraft {
    AiDraft::from_state(load_ai_settings_rows(connection).expect("state")).expect("draft")
}

fn no_saved_key() -> crate::error::AppResult<Option<String>> {
    Ok(None)
}

fn workdir() -> PathBuf {
    std::env::temp_dir()
}

#[test]
fn the_connection_migration_records_existing_installs_as_api_key() {
    let mut connection = Connection::open_in_memory().unwrap();
    apply_migrations(&mut connection, &MIGRATIONS[..MIGRATIONS.len() - 1]).unwrap();
    connection
        .execute(
            "INSERT INTO settings (key, value) VALUES ('ai.has_api_key', '1')",
            [],
        )
        .unwrap();

    apply_migrations(&mut connection, MIGRATIONS).unwrap();

    let stored: String = connection
        .query_row(
            "SELECT value FROM settings WHERE key = 'ai.connection'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(stored, "api_key");
    let state = load_ai_settings_rows(&connection).unwrap();
    assert_eq!(state.connection, AiConnectionKind::ApiKey);
    assert!(state.ai_ready);
}

#[test]
fn the_connection_migration_keeps_a_choice_already_made() {
    let mut connection = Connection::open_in_memory().unwrap();
    apply_migrations(&mut connection, &MIGRATIONS[..MIGRATIONS.len() - 1]).unwrap();
    connection
        .execute(
            "INSERT INTO settings (key, value) VALUES ('ai.connection', 'claude_code')",
            [],
        )
        .unwrap();

    apply_migrations(&mut connection, MIGRATIONS).unwrap();

    assert_eq!(
        load_ai_settings_rows(&connection).unwrap().connection,
        AiConnectionKind::ClaudeCode
    );
}

#[test]
fn settings_without_connection_rows_read_as_an_unconfigured_api_key_connection() {
    let connection = open_test_connection();
    connection.execute("DELETE FROM settings", []).unwrap();

    let state = load_ai_settings_rows(&connection).unwrap();

    assert_eq!(state.connection, AiConnectionKind::ApiKey);
    assert_eq!(state.chatgpt.status, "disconnected");
    assert_eq!(state.claude_code.model, "opus");
    assert!(!state.ai_ready);
}

#[test]
fn saving_a_connection_keeps_the_api_settings_and_saved_key_flag() {
    let mut connection = open_test_connection();
    let mut api = normalized(Some("apiKey"));
    api.base_url = "https://api.anthropic.com/v1".to_string();
    api.model = "claude-sonnet-5".to_string();
    persist_ai_settings_rows(&mut connection, &api, true).unwrap();

    let mut claude = normalized(Some("claudeCode"));
    claude.base_url = api.base_url.clone();
    claude.model = api.model.clone();
    claude.claude_code_model = Some("opus".to_string());
    let state = persist_ai_settings_rows(&mut connection, &claude, true).unwrap();

    assert_eq!(state.connection, AiConnectionKind::ClaudeCode);
    assert_eq!(state.base_url, "https://api.anthropic.com/v1");
    assert_eq!(state.model, "claude-sonnet-5");
    assert!(state.has_api_key);
    // Claude Code isn't ready until a status check confirms its sign-in.
    assert!(!state.ai_ready);
}

#[test]
fn claude_code_becomes_ready_after_a_passing_status_check_and_resets_on_a_new_path() {
    let mut connection = open_test_connection();
    persist_ai_settings_rows(&mut connection, &normalized(Some("claudeCode")), false).unwrap();
    record_claude_code_ready(&connection, true).unwrap();
    assert!(load_ai_settings_rows(&connection).unwrap().ai_ready);

    let mut moved = normalized(None);
    moved.claude_code_path = Some(if cfg!(windows) {
        "C:\\tools\\claude.exe".to_string()
    } else {
        "/opt/tools/claude".to_string()
    });
    let state = persist_ai_settings_rows(&mut connection, &moved, false).unwrap();

    assert!(!state.claude_code.ready);
    assert!(!state.ai_ready);
}

#[test]
fn chatgpt_is_ready_only_when_connected_with_plan_usage() {
    let mut connection = open_test_connection();
    persist_ai_settings_rows(&mut connection, &normalized(Some("chatgpt")), false).unwrap();
    assert!(!load_ai_settings_rows(&connection).unwrap().ai_ready);

    connection
        .execute_batch(
            "INSERT INTO settings (key, value) VALUES ('ai.chatgpt.status', 'connected'), ('ai.chatgpt.plan_usage', '1')",
        )
        .unwrap();
    assert!(load_ai_settings_rows(&connection).unwrap().ai_ready);

    record_chatgpt_status(&connection, ChatgptStatus::Expired).unwrap();
    let expired = load_ai_settings_rows(&connection).unwrap();
    assert_eq!(expired.chatgpt.status, "expired");
    assert!(!expired.ai_ready);
}

#[test]
fn disconnecting_chatgpt_forgets_the_account_but_keeps_the_registration() {
    let connection = open_test_connection();
    connection
        .execute_batch(
            "INSERT INTO settings (key, value) VALUES
              ('ai.chatgpt.status', 'connected'), ('ai.chatgpt.plan_usage', '1'),
              ('ai.chatgpt.email', 'learner@example.com'), ('ai.chatgpt.client_id', 'oaiapp_x')",
        )
        .unwrap();

    record_chatgpt_status(&connection, ChatgptStatus::Disconnected).unwrap();

    let state = load_ai_settings_rows(&connection).unwrap();
    assert_eq!(state.chatgpt.status, "disconnected");
    assert_eq!(state.chatgpt.email, None);
    let client: String = connection
        .query_row(
            "SELECT value FROM settings WHERE key = 'ai.chatgpt.client_id'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(client, "oaiapp_x");
}

#[test]
fn an_api_key_connection_resolves_to_the_api_transport_with_the_saved_key() {
    let mut connection = open_test_connection();
    persist_ai_settings_rows(&mut connection, &normalized(Some("apiKey")), true).unwrap();

    let target = resolve_ai_target(
        draft(&connection),
        || Ok(Some("sk-saved".to_string())),
        &DiscoveryEnv::default(),
        workdir(),
    )
    .unwrap();

    match target {
        ResolvedAiTarget::Api(settings) => {
            assert_eq!(settings.api_key, "sk-saved");
            assert_eq!(settings.model, "gpt-5.6-terra");
        }
        _ => panic!("expected the API transport"),
    }
}

#[test]
fn an_api_key_connection_without_a_key_asks_for_one() {
    let connection = open_test_connection();
    let error = resolve_ai_target(
        draft(&connection),
        no_saved_key,
        &DiscoveryEnv::default(),
        workdir(),
    )
    .err()
    .expect("missing key");
    assert!(matches!(error, AppError::Validation { field: Some(ref f), .. } if f == "apiKey"));
}

#[test]
fn a_subscription_connection_never_falls_back_to_a_saved_api_key() {
    let mut connection = open_test_connection();
    persist_ai_settings_rows(&mut connection, &normalized(Some("chatgpt")), true).unwrap();
    let mut key_was_read = false;

    let error = resolve_ai_target(
        draft(&connection),
        || {
            key_was_read = true;
            Ok(Some("sk-saved".to_string()))
        },
        &DiscoveryEnv::default(),
        workdir(),
    )
    .err()
    .expect("not connected");

    assert_eq!(reason(&error), Some(AiConnectionReason::SignedOut));
    assert!(!key_was_read);
}

#[test]
fn chatgpt_without_plan_usage_or_after_expiry_explains_how_to_reconnect() {
    let mut connection = open_test_connection();
    persist_ai_settings_rows(&mut connection, &normalized(Some("chatgpt")), false).unwrap();
    connection
        .execute_batch(
            "INSERT INTO settings (key, value) VALUES ('ai.chatgpt.status', 'connected'), ('ai.chatgpt.plan_usage', '0')",
        )
        .unwrap();
    let declined = resolve_ai_target(
        draft(&connection),
        no_saved_key,
        &DiscoveryEnv::default(),
        workdir(),
    )
    .err()
    .unwrap();
    assert_eq!(reason(&declined), Some(AiConnectionReason::Declined));

    record_chatgpt_status(&connection, ChatgptStatus::Expired).unwrap();
    let expired = resolve_ai_target(
        draft(&connection),
        no_saved_key,
        &DiscoveryEnv::default(),
        workdir(),
    )
    .err()
    .unwrap();
    assert_eq!(reason(&expired), Some(AiConnectionReason::Expired));
}

#[test]
fn a_connected_chatgpt_plan_resolves_to_the_saved_plan_model() {
    let mut connection = open_test_connection();
    let mut chatgpt = normalized(Some("chatgpt"));
    chatgpt.chatgpt_model = Some("gpt-6.1-sol".to_string());
    persist_ai_settings_rows(&mut connection, &chatgpt, false).unwrap();
    connection
        .execute_batch(
            "INSERT INTO settings (key, value) VALUES ('ai.chatgpt.status', 'connected'), ('ai.chatgpt.plan_usage', '1')",
        )
        .unwrap();

    let target = resolve_ai_target(
        draft(&connection),
        no_saved_key,
        &DiscoveryEnv::default(),
        workdir(),
    )
    .unwrap();

    assert_eq!(target.model(), "gpt-6.1-sol");
    assert!(matches!(target, ResolvedAiTarget::Chatgpt { .. }));
}

#[test]
fn claude_code_resolves_to_the_discovered_binary() {
    let dir = std::env::temp_dir().join(format!("pupil-resolve-{}", nanoid::nanoid!(8)));
    std::fs::create_dir_all(&dir).unwrap();
    let name = if cfg!(windows) {
        "claude.exe"
    } else {
        "claude"
    };
    std::fs::write(dir.join(name), "").unwrap();
    let mut connection = open_test_connection();
    persist_ai_settings_rows(&mut connection, &normalized(Some("claudeCode")), false).unwrap();
    let env = DiscoveryEnv {
        path_var: Some(std::env::join_paths([dir.clone()]).unwrap()),
        home: None,
        app_data: None,
    };

    let target = resolve_ai_target(draft(&connection), no_saved_key, &env, workdir()).unwrap();

    match target {
        ResolvedAiTarget::ClaudeCode(target) => {
            assert_eq!(target.binary, dir.join(name));
            assert_eq!(target.model, "opus");
        }
        _ => panic!("expected Claude Code"),
    }
    std::fs::remove_dir_all(dir).unwrap();
}

#[test]
fn a_draft_can_test_a_connection_before_it_is_saved() {
    let connection = open_test_connection();
    let saved = load_ai_settings_rows(&connection).unwrap();
    let mut test_input = normalized(Some("apiKey"));
    test_input.api_key = Some("sk-draft".to_string());

    let target = resolve_ai_target(
        AiDraft::from_input(saved, test_input),
        no_saved_key,
        &DiscoveryEnv::default(),
        workdir(),
    )
    .unwrap();

    assert!(matches!(target, ResolvedAiTarget::Api(ref s) if s.api_key == "sk-draft"));
}

#[test]
fn settings_input_rejects_unknown_connections_and_unsafe_subscription_values() {
    assert!(normalize_ai_settings_input(input(Some("gemini"))).is_err());

    let mut bad_model = input(Some("claudeCode"));
    bad_model.claude_code_model = Some("--dangerously-skip-permissions".to_string());
    assert!(normalize_ai_settings_input(bad_model).is_err());

    let mut bad_path = input(Some("claudeCode"));
    bad_path.claude_code_path = Some("../claude".to_string());
    assert!(normalize_ai_settings_input(bad_path).is_err());

    let mut auto_path = input(Some("claudeCode"));
    auto_path.claude_code_path = Some("   ".to_string());
    assert_eq!(
        normalize_ai_settings_input(auto_path)
            .unwrap()
            .claude_code_path
            .as_deref(),
        Some("")
    );

    let mut bad_chatgpt = input(Some("chatgpt"));
    bad_chatgpt.chatgpt_model = Some("gpt 5; drop".to_string());
    assert!(normalize_ai_settings_input(bad_chatgpt).is_err());
}

#[test]
fn connection_kinds_round_trip_between_the_ui_and_the_database() {
    for kind in [
        AiConnectionKind::ApiKey,
        AiConnectionKind::Chatgpt,
        AiConnectionKind::ClaudeCode,
    ] {
        assert_eq!(AiConnectionKind::from_db(kind.as_db()), kind);
        let ui = serde_json::to_value(kind).unwrap();
        assert_eq!(AiConnectionKind::from_input(ui.as_str().unwrap()), Ok(kind));
    }
    assert_eq!(
        AiConnectionKind::from_db("something-new"),
        AiConnectionKind::ApiKey
    );
}

#[test]
fn cancelling_a_registered_request_fires_only_its_token() {
    let registry = Arc::new(AiRequestRegistry::default());
    let first = registry.register(Some("gen-1".to_string()));
    let second = registry.register(Some("gen-2".to_string()));

    assert!(registry.cancel("gen-1"));

    assert!(first.token.is_cancelled());
    assert!(!second.token.is_cancelled());
    assert!(!registry.cancel("missing"));
}

#[test]
fn finished_requests_leave_the_registry_and_bad_ids_are_not_tracked() {
    let registry = Arc::new(AiRequestRegistry::default());
    {
        let _guard = registry.register(Some("gen-1".to_string()));
        let _untracked = registry.register(Some("not ok/../id".to_string()));
        assert_eq!(registry.active_count(), 1);
    }
    assert_eq!(registry.active_count(), 0);
    assert!(!registry.cancel("gen-1"));
}

#[test]
fn reusing_a_request_id_cancels_the_older_request() {
    let registry = Arc::new(AiRequestRegistry::default());
    let older = registry.register(Some("explain".to_string()));
    let newer = registry.register(Some("explain".to_string()));

    assert!(older.token.is_cancelled());
    assert!(!newer.token.is_cancelled());
}

#[test]
fn connection_errors_serialize_with_a_reason_for_the_frontend() {
    let error = AppError::ai_connection(
        "chatgpt",
        AiConnectionReason::UsageLimit,
        "Usage limit reached.",
    );
    let value = serde_json::to_value(&error).unwrap();
    assert_eq!(value["code"], "AI_CONNECTION");
    assert_eq!(value["reason"], "usageLimit");
    assert_eq!(value["provider"], "chatgpt");
}

mod dispatch {
    //! The transport dispatcher, end to end against a loopback server: the
    //! API key path is unchanged, the ChatGPT path uses the plan token, and a
    //! cancelled request stops waiting.
    use std::sync::Mutex;
    use std::time::{Duration, Instant};

    use serde_json::json;

    use super::super::mock_http::{MockResponse, MockServer};
    use crate::ai::testing::{
        CancelToken, ChatgptCredentials, CredentialStore, SessionGate, PLAN_USAGE_SCOPE,
    };
    use crate::ai::{
        execute_ai_target, AiExecution, AiRequestRegistry, ChatgptEndpoints, ResolvedAiTarget,
    };
    use crate::error::{AiConnectionReason, AppResult};
    use crate::types::ResolvedAiSettings;

    struct OneSession(Mutex<Option<ChatgptCredentials>>, SessionGate);

    impl CredentialStore for OneSession {
        fn load(&self) -> AppResult<Option<ChatgptCredentials>> {
            Ok(self.0.lock().unwrap().clone())
        }
        fn save(&self, credentials: &ChatgptCredentials) -> AppResult<()> {
            *self.0.lock().unwrap() = Some(credentials.clone());
            Ok(())
        }
        fn clear(&self) -> AppResult<()> {
            *self.0.lock().unwrap() = None;
            Ok(())
        }
        fn gate(&self) -> &SessionGate {
            &self.1
        }
    }

    fn session() -> OneSession {
        OneSession(
            Mutex::new(Some(ChatgptCredentials {
                client_id: "oaiapp_x".into(),
                subject: "sub".into(),
                email: None,
                id_token: String::new(),
                access_token: "plan-token".into(),
                refresh_token: Some("refresh".into()),
                token_type: "Bearer".into(),
                expires_at_ms: crate::util::now_ms() + 3_600_000,
                scopes: vec![PLAN_USAGE_SCOPE.into()],
                saved_at_ms: 0,
            })),
            SessionGate::default(),
        )
    }

    fn api_target(base: &str) -> ResolvedAiTarget {
        ResolvedAiTarget::Api(ResolvedAiSettings {
            api_key: "sk-test".into(),
            base_url: format!("{base}/v1"),
            model: "gpt-4.1".into(),
            max_tokens: 256,
            temperature: 0.5,
        })
    }

    #[tokio::test]
    async fn an_api_key_connection_still_posts_chat_completions_with_the_key() {
        let server = MockServer::start(|_| {
            MockResponse::json(200, json!({"choices": [{"message": {"content": "[]"}}]}))
        });
        let store = session();
        let endpoints = ChatgptEndpoints::default();
        let execution = AiExecution {
            store: &store,
            endpoints: &endpoints,
            token: CancelToken::none(),
        };

        let text = execute_ai_target(
            &api_target(&server.base),
            &execution,
            "user",
            Some("system"),
        )
        .await
        .expect("completion");

        assert_eq!(text, "[]");
        let request = &server.requests_to("/v1/chat/completions")[0];
        assert_eq!(request.headers["authorization"], "Bearer sk-test");
        let body: serde_json::Value = serde_json::from_str(&request.body).unwrap();
        assert_eq!(body["messages"][0]["role"], "system");
        assert_eq!(body["temperature"], 0.5);
    }

    #[tokio::test]
    async fn a_chatgpt_connection_uses_the_plan_token_and_never_the_api_key() {
        let server = MockServer::start(|_| {
            MockResponse::sse(&[
                json!({"type": "response.output_text.delta", "delta": "plan answer"}),
                json!({"type": "response.completed", "response": {}}),
            ])
        });
        let store = session();
        let endpoints = ChatgptEndpoints {
            auth_base: server.base.clone(),
            api_base: format!("{}/v1", server.base),
        };
        let execution = AiExecution {
            store: &store,
            endpoints: &endpoints,
            token: CancelToken::none(),
        };

        let text = execute_ai_target(
            &ResolvedAiTarget::Chatgpt {
                model: "gpt-a".into(),
            },
            &execution,
            "user",
            Some("system"),
        )
        .await
        .expect("completion");

        assert_eq!(text, "plan answer");
        let request = &server.requests_to("/v1/responses")[0];
        assert_eq!(request.headers["authorization"], "Bearer plan-token");
        let body: serde_json::Value = serde_json::from_str(&request.body).unwrap();
        assert_eq!(body["model"], "gpt-a");
        assert_eq!(body["store"], false);
    }

    #[tokio::test]
    async fn cancelling_stops_waiting_on_a_slow_provider() {
        let server = MockServer::start(|_| {
            std::thread::sleep(Duration::from_secs(3));
            MockResponse::json(200, json!({"choices": [{"message": {"content": "late"}}]}))
        });
        let store = session();
        let endpoints = ChatgptEndpoints::default();
        let registry = std::sync::Arc::new(AiRequestRegistry::default());
        let guard = registry.register(Some("generate-1".into()));
        let execution = AiExecution {
            store: &store,
            endpoints: &endpoints,
            token: guard.token.clone(),
        };
        let canceller = std::sync::Arc::clone(&registry);
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(150)).await;
            canceller.cancel("generate-1");
        });
        let started = Instant::now();

        let error = execute_ai_target(&api_target(&server.base), &execution, "user", None)
            .await
            .expect_err("cancelled");

        assert_eq!(super::reason(&error), Some(AiConnectionReason::Cancelled));
        assert!(started.elapsed() < Duration::from_secs(2));
    }
}
