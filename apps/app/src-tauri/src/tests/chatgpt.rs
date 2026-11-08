use std::io::{Read, Write};
use std::net::TcpStream;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use ring::rand::SystemRandom;
use ring::signature::{RsaKeyPair, RSA_PKCS1_SHA256};
use serde_json::{json, Value};

use super::mock_http::{url_pairs, MockResponse, MockServer};
use super::support::{open_test_connection, TEST_NOW};
use crate::ai::testing::{
    build_authorize_url, build_responses_payload, classify_chatgpt_error, classify_token_error,
    ensure_fresh_credentials, execute_chatgpt_completion, is_valid_host_id, new_host_id,
    parse_callback, parse_discovery, parse_models, parse_responses_stream, pkce_challenge,
    validate_id_claims, verify_rs256, ChatgptCredentials, CredentialStore, PendingAuthorization,
    SessionGate, SignInControl, SignInInputs, PLAN_USAGE_SCOPE,
};
use crate::ai::{
    disconnect_chatgpt, is_registration_rejected, list_chatgpt_models, load_sign_in_inputs,
    note_chatgpt_failure, record_chatgpt_status, record_sign_in, run_chatgpt_sign_in,
    ChatgptEndpoints, ChatgptModel, ChatgptStatus,
};
use crate::error::{AiConnectionReason, AppError, AppResult};

const CLIENT_ID: &str = "oaiapp_test_client";

fn reason(error: &AppError) -> Option<AiConnectionReason> {
    match error {
        AppError::AiConnection { reason, .. } => Some(*reason),
        _ => None,
    }
}

fn key_pair() -> RsaKeyPair {
    RsaKeyPair::from_pkcs8(include_bytes!("fixtures/test-only-rsa-key.pk8.der"))
        .expect("parse test key")
}

fn jwks() -> Value {
    let key = key_pair();
    let public = ring::rsa::PublicKeyComponents::<Vec<u8>>::from(key.public());
    json!({ "keys": [{
        "kty": "RSA",
        "kid": "test-key",
        "alg": "RS256",
        "n": URL_SAFE_NO_PAD.encode(&public.n),
        "e": URL_SAFE_NO_PAD.encode(&public.e),
    }]})
}

fn sign_jwt(claims: &Value) -> String {
    let header = URL_SAFE_NO_PAD.encode(json!({"alg": "RS256", "kid": "test-key"}).to_string());
    let payload = URL_SAFE_NO_PAD.encode(claims.to_string());
    let input = format!("{header}.{payload}");
    let key = key_pair();
    let mut signature = vec![0; key.public().modulus_len()];
    key.sign(
        &RSA_PKCS1_SHA256,
        &SystemRandom::new(),
        input.as_bytes(),
        &mut signature,
    )
    .expect("sign");
    format!("{input}.{}", URL_SAFE_NO_PAD.encode(signature))
}

fn pending(client_id: Option<&str>) -> PendingAuthorization {
    PendingAuthorization {
        state: "state-123".to_string(),
        nonce: "nonce-456".to_string(),
        verifier: "verifier".to_string(),
        client_id: client_id.map(str::to_string),
        redirect_uri: "http://127.0.0.1:1455/auth/callback".to_string(),
    }
}

fn credentials(expires_at_ms: i64, scopes: &[&str]) -> ChatgptCredentials {
    ChatgptCredentials {
        client_id: CLIENT_ID.to_string(),
        subject: "user-sub".to_string(),
        email: Some("learner@example.com".to_string()),
        id_token: "id.token.value".to_string(),
        access_token: "access-old".to_string(),
        refresh_token: Some("refresh-old".to_string()),
        token_type: "Bearer".to_string(),
        expires_at_ms,
        scopes: scopes.iter().map(|s| s.to_string()).collect(),
        saved_at_ms: 0,
    }
}

#[derive(Default)]
struct MemoryStore(Mutex<Option<ChatgptCredentials>>, SessionGate);

impl MemoryStore {
    fn with(credentials: ChatgptCredentials) -> Self {
        Self(Mutex::new(Some(credentials)), SessionGate::default())
    }
    fn current(&self) -> Option<ChatgptCredentials> {
        self.0.lock().unwrap().clone()
    }
}

impl CredentialStore for MemoryStore {
    fn load(&self) -> AppResult<Option<ChatgptCredentials>> {
        Ok(self.current())
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

fn endpoints(server: &MockServer) -> ChatgptEndpoints {
    ChatgptEndpoints {
        auth_base: server.base.clone(),
        api_base: format!("{}/v1", server.base),
    }
}

fn now() -> i64 {
    TEST_NOW
}

fn completed_stream(text: &str) -> MockResponse {
    MockResponse::sse(&[
        json!({"type": "response.created"}),
        json!({"type": "response.output_text.delta", "delta": &text[..text.len() / 2]}),
        json!({"type": "response.output_text.delta", "delta": &text[text.len() / 2..]}),
        json!({"type": "response.completed", "response": {"output": []}}),
    ])
}

#[test]
fn pkce_challenge_matches_the_rfc_7636_example() {
    assert_eq!(
        pkce_challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
        "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
    );
}

#[test]
fn first_sign_in_registers_dynamically_and_asks_for_plan_usage() {
    let url = build_authorize_url(
        &ChatgptEndpoints::default(),
        &pending(None),
        "urn:uuid:host",
    )
    .expect("authorize url");
    let params = url_pairs(url.query().unwrap_or_default());

    assert_eq!(url.host_str(), Some("auth.openai.com"));
    assert_eq!(params["client_id"], "dynamic_agent_client");
    assert_eq!(params["agent_name_hint"], "Pupil");
    assert_eq!(params["ext_agent_host_id"], "urn:uuid:host");
    assert_eq!(params["code_challenge_method"], "S256");
    assert_eq!(params["code_challenge"], pkce_challenge("verifier"));
    assert_eq!(params["resource"], "https://api.openai.com/v1");
    assert!(params["scope"]
        .split(' ')
        .any(|scope| scope == PLAN_USAGE_SCOPE));
    assert!(params["redirect_uri"].starts_with("http://127.0.0.1:"));
}

#[test]
fn returning_sign_in_reuses_the_issued_client_without_a_name_hint() {
    let url = build_authorize_url(
        &ChatgptEndpoints::default(),
        &pending(Some(CLIENT_ID)),
        "urn:uuid:host",
    )
    .expect("authorize url");
    let params = url_pairs(url.query().unwrap_or_default());

    assert_eq!(params["client_id"], CLIENT_ID);
    assert!(!params.contains_key("agent_name_hint"));
}

#[test]
fn callback_with_a_different_state_is_rejected() {
    let error = parse_callback(
        "/auth/callback?code=abc&state=other&client_id=x",
        &pending(None),
    )
    .expect_err("state mismatch");
    assert_eq!(reason(&error), Some(AiConnectionReason::Provider));
}

#[test]
fn callback_with_access_denied_reports_declined_consent() {
    let error = parse_callback(
        "/auth/callback?error=access_denied&state=state-123",
        &pending(None),
    )
    .expect_err("denied");
    assert_eq!(reason(&error), Some(AiConnectionReason::Declined));
}

#[test]
fn registration_callback_returns_the_issued_client_id() {
    let code = parse_callback(
        "/auth/callback?code=abc&state=state-123&client_id=oaiapp_new",
        &pending(None),
    )
    .expect("callback");
    assert_eq!(code.code, "abc");
    assert_eq!(code.client_id, "oaiapp_new");
}

#[test]
fn registration_callback_without_an_issued_client_id_is_incomplete() {
    assert!(parse_callback("/auth/callback?code=abc&state=state-123", &pending(None)).is_err());
}

#[test]
fn reauthorization_callback_keeps_the_saved_client_and_rejects_another() {
    let kept = parse_callback(
        "/auth/callback?code=abc&state=state-123",
        &pending(Some(CLIENT_ID)),
    )
    .expect("callback without client id");
    assert_eq!(kept.client_id, CLIENT_ID);
    assert!(parse_callback(
        "/auth/callback?code=abc&state=state-123&client_id=oaiapp_other",
        &pending(Some(CLIENT_ID)),
    )
    .is_err());
}

#[test]
fn id_token_signature_is_verified_against_the_jwks() {
    let token = sign_jwt(&json!({"sub": "user-sub", "nonce": "n"}));
    let claims = verify_rs256(&token, &jwks()).expect("valid signature");
    assert_eq!(claims["sub"], "user-sub");

    let mut parts: Vec<String> = token.split('.').map(str::to_string).collect();
    parts[1] = URL_SAFE_NO_PAD.encode(json!({"sub": "attacker", "nonce": "n"}).to_string());
    assert!(verify_rs256(&parts.join("."), &jwks()).is_err());
}

#[test]
fn id_token_claims_must_match_issuer_audience_nonce_and_expiry() {
    let now_secs = TEST_NOW / 1000;
    let valid = json!({
        "iss": "https://auth.openai.com", "aud": CLIENT_ID, "nonce": "n",
        "exp": now_secs + 600, "sub": "user-sub", "email": "learner@example.com"
    });
    let identity = validate_id_claims(&valid, "https://auth.openai.com", CLIENT_ID, "n", now_secs)
        .expect("valid claims");
    assert_eq!(identity.subject, "user-sub");
    assert_eq!(identity.email.as_deref(), Some("learner@example.com"));

    for (field, value) in [
        ("iss", json!("https://evil.example")),
        ("aud", json!("someone-else")),
        ("nonce", json!("replayed")),
        ("exp", json!(now_secs - 3600)),
    ] {
        let mut claims = valid.clone();
        claims[field] = value;
        assert!(
            validate_id_claims(&claims, "https://auth.openai.com", CLIENT_ID, "n", now_secs)
                .is_err(),
            "{field} should be checked"
        );
    }
}

#[test]
fn discovery_only_trusts_https_key_endpoints() {
    let endpoints = ChatgptEndpoints::default();
    assert!(parse_discovery(
        &json!({"issuer": "https://auth.openai.com", "jwks_uri": "http://evil.example/jwks"}),
        &endpoints
    )
    .is_err());
    let discovery = parse_discovery(
        &json!({
            "issuer": "https://auth.openai.com",
            "jwks_uri": "https://auth.openai.com/.well-known/jwks.json",
            "revocation_endpoint": "https://auth.openai.com/oauth/revoke"
        }),
        &endpoints,
    )
    .expect("discovery");
    assert!(discovery.revocation_endpoint.is_some());
}

#[test]
fn responses_payload_disables_storage_and_streams_without_sampling_parameters() {
    let payload = build_responses_payload("gpt-test", Some("system"), "user");
    assert_eq!(payload["store"], false);
    assert_eq!(payload["stream"], true);
    assert_eq!(payload["instructions"], "system");
    assert_eq!(payload["input"][0]["role"], "user");
    assert!(payload.get("temperature").is_none());
}

#[test]
fn responses_stream_joins_text_deltas_once_completed() {
    let body = completed_stream("[{\"front\":\"a\",\"back\":\"b\"}]").body;
    assert_eq!(
        parse_responses_stream(&body, "gpt-test").expect("text"),
        "[{\"front\":\"a\",\"back\":\"b\"}]"
    );
}

#[test]
fn responses_stream_falls_back_to_completed_output_text() {
    let body = MockResponse::sse(&[json!({
        "type": "response.completed",
        "response": {"output": [{"content": [{"type": "output_text", "text": "ok"}]}]}
    })])
    .body;
    assert_eq!(
        parse_responses_stream(&body, "gpt-test").expect("text"),
        "ok"
    );
}

#[test]
fn responses_stream_that_ends_without_completion_is_a_failure() {
    let body =
        MockResponse::sse(&[json!({"type": "response.output_text.delta", "delta": "par"})]).body;
    assert!(parse_responses_stream(&body, "gpt-test").is_err());
}

#[test]
fn responses_stream_usage_limit_event_is_reported_as_a_usage_limit() {
    let body = MockResponse::sse(&[json!({
        "type": "response.failed",
        "response": {"error": {"code": "subscription_sharing_usage_limit_exceeded"}}
    })])
    .body;
    let error = parse_responses_stream(&body, "gpt-test").expect_err("limit");
    assert_eq!(reason(&error), Some(AiConnectionReason::UsageLimit));
}

#[test]
fn plan_usage_http_failures_map_to_specific_remedies() {
    let cases = [
        (
            429,
            r#"{"error":{"code":"subscription_sharing_usage_limit_exceeded"}}"#,
            Some(AiConnectionReason::UsageLimit),
        ),
        (
            403,
            r#"{"error":{"code":"subscription_sharing_user_not_eligible"}}"#,
            Some(AiConnectionReason::NotEligible),
        ),
        (
            401,
            r#"{"error":{"code":"subscription_sharing_invalid_user"}}"#,
            Some(AiConnectionReason::Expired),
        ),
        (
            404,
            r#"{"error":{"code":"model_not_found"}}"#,
            Some(AiConnectionReason::ModelUnavailable),
        ),
        (
            403,
            r#"{"detail":"region"}"#,
            Some(AiConnectionReason::NotEligible),
        ),
        (503, r#"{"detail":"unavailable"}"#, None),
    ];
    for (status, body, expected) in cases {
        assert_eq!(
            reason(&classify_chatgpt_error(Some(status), body, "gpt-test")),
            expected,
            "HTTP {status}"
        );
    }
}

#[test]
fn unavailable_plan_routing_stays_retryable_like_other_server_errors() {
    let error = classify_chatgpt_error(Some(503), r#"{"detail":"try later"}"#, "gpt-test");
    assert!(crate::ai::testing::is_transient_ai_error(&error));
}

#[test]
fn refresh_token_failures_end_the_session() {
    for code in [
        "invalid_grant",
        "refresh_token_expired",
        "refresh_token_reused",
    ] {
        let error = classify_token_error(400, &json!({"error": code}).to_string());
        assert_eq!(reason(&error), Some(AiConnectionReason::Expired), "{code}");
    }
    assert_eq!(reason(&classify_token_error(500, "oops")), None);
}

#[test]
fn model_catalog_keeps_listed_models_with_display_names() {
    let models = parse_models(&json!({"models": [
        {"slug": "gpt-a", "display_name": "GPT A", "visibility": "list"},
        {"slug": "gpt-hidden", "display_name": "Hidden", "visibility": "hide"},
        {"slug": "gpt-a", "display_name": "Duplicate", "visibility": "list"},
        {"slug": "gpt-b", "visibility": "list"}
    ]}));
    assert_eq!(
        models,
        vec![
            ChatgptModel {
                id: "gpt-a".into(),
                label: "GPT A".into()
            },
            ChatgptModel {
                id: "gpt-b".into(),
                label: "gpt-b".into()
            },
        ]
    );
}

#[test]
fn credential_debug_output_never_contains_tokens() {
    let printed = format!("{:?}", credentials(0, &[PLAN_USAGE_SCOPE]));
    assert!(!printed.contains("access-old"));
    assert!(!printed.contains("refresh-old"));
    assert!(!printed.contains("id.token.value"));
    assert!(printed.contains("[redacted]"));
}

#[test]
fn host_ids_are_opaque_uuid_urns() {
    let host_id = new_host_id().expect("host id");
    assert!(is_valid_host_id(&host_id));
    assert_eq!(host_id.len(), "urn:uuid:".len() + 36);
    assert_eq!(&host_id["urn:uuid:".len() + 14..][..1], "4");
    assert!(!is_valid_host_id("learner@example.com"));
}

#[test]
fn sign_in_inputs_persist_one_host_id_and_reuse_the_issued_client() {
    let connection = open_test_connection();
    let first = load_sign_in_inputs(&connection, false).expect("inputs");
    let second = load_sign_in_inputs(&connection, false).expect("inputs again");
    assert_eq!(first.host_id, second.host_id);
    assert!(first.saved_client_id.is_none());
}

fn oauth_server(nonce: Arc<Mutex<String>>, issuer_holder: Arc<Mutex<String>>) -> MockServer {
    MockServer::start(move |request| {
        let issuer = issuer_holder.lock().unwrap().clone();
        match (request.method.as_str(), request.path_only()) {
            ("POST", "/api/accounts/oauth/token") => {
                let form = request.form();
                if form.get("grant_type").map(String::as_str) == Some("authorization_code") {
                    assert_eq!(form["code"], "auth-code");
                    assert_eq!(form["client_id"], CLIENT_ID);
                    assert!(form["redirect_uri"].starts_with("http://127.0.0.1:"));
                    let id_token = sign_jwt(&json!({
                        "iss": issuer, "aud": CLIENT_ID, "sub": "user-sub",
                        "email": "learner@example.com",
                        "nonce": nonce.lock().unwrap().clone(),
                        "exp": TEST_NOW / 1000 + 3600,
                    }));
                    MockResponse::json(
                        200,
                        json!({
                            "access_token": "access-new", "refresh_token": "refresh-new",
                            "id_token": id_token, "token_type": "Bearer", "expires_in": 3600,
                            "scope": "openid email offline_access chatgpt.tokens.use.direct"
                        }),
                    )
                } else {
                    MockResponse::json(400, json!({"error": "unsupported_grant_type"}))
                }
            }
            ("GET", "/.well-known/openid-configuration") => MockResponse::json(
                200,
                json!({
                    "issuer": issuer,
                    "jwks_uri": format!("{issuer}/jwks"),
                    "revocation_endpoint": format!("{issuer}/revoke"),
                }),
            ),
            ("GET", "/jwks") => MockResponse::json(200, jwks()),
            _ => MockResponse::json(404, json!({})),
        }
    })
}

/// Plays the browser: reads the authorize URL, then hits the loopback
/// redirect the way OpenAI's consent page would.
fn simulate_browser(
    url: &str,
    nonce: &Arc<Mutex<String>>,
    query: impl Fn(&str) -> String + Send + 'static,
) {
    let params = url_pairs(
        reqwest::Url::parse(url)
            .unwrap()
            .query()
            .unwrap_or_default(),
    );
    *nonce.lock().unwrap() = params["nonce"].clone();
    let redirect = reqwest::Url::parse(&params["redirect_uri"]).unwrap();
    let state = params["state"].clone();
    std::thread::spawn(move || {
        let address = format!("127.0.0.1:{}", redirect.port().unwrap());
        let mut stream = TcpStream::connect(address).expect("connect to loopback");
        write!(
            stream,
            "GET {}?{} HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n",
            redirect.path(),
            query(&state)
        )
        .unwrap();
        let mut response = String::new();
        let _ = stream.read_to_string(&mut response);
        assert!(response.starts_with("HTTP/1.1 200"));
    });
}

#[tokio::test]
async fn sign_in_registers_verifies_the_identity_and_records_plan_usage() {
    let nonce = Arc::new(Mutex::new(String::new()));
    let issuer = Arc::new(Mutex::new(String::new()));
    let server = oauth_server(Arc::clone(&nonce), Arc::clone(&issuer));
    *issuer.lock().unwrap() = server.base.clone();
    let control: &'static SignInControl = Box::leak(Box::default());
    let browser_nonce = Arc::clone(&nonce);
    let mut opened_url = String::new();

    let credentials = run_chatgpt_sign_in(
        &endpoints(&server),
        control,
        SignInInputs {
            host_id: "urn:uuid:test-host".into(),
            saved_client_id: None,
        },
        |url| {
            opened_url = url.to_string();
            simulate_browser(url, &browser_nonce, |state| {
                format!("code=auth-code&state={state}&client_id={CLIENT_ID}")
            });
            Ok(())
        },
        Duration::from_secs(10),
        now,
    )
    .await
    .expect("sign in");

    assert!(opened_url.contains("client_id=dynamic_agent_client"));
    assert_eq!(credentials.client_id, CLIENT_ID);
    assert_eq!(credentials.email.as_deref(), Some("learner@example.com"));
    assert!(credentials.has_plan_usage());
    assert_eq!(credentials.expires_at_ms, TEST_NOW + 3_600_000);
}

#[tokio::test]
async fn a_cancelled_sign_in_stops_waiting_for_the_browser() {
    let control: &'static SignInControl = Box::leak(Box::default());
    let started = Instant::now();
    let result = run_chatgpt_sign_in(
        &ChatgptEndpoints::default(),
        control,
        SignInInputs {
            host_id: "urn:uuid:test-host".into(),
            saved_client_id: None,
        },
        |_| {
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_millis(200));
                control.cancel();
            });
            Ok(())
        },
        Duration::from_secs(30),
        now,
    )
    .await;

    assert_eq!(
        reason(&result.expect_err("cancelled")),
        Some(AiConnectionReason::Cancelled)
    );
    assert!(started.elapsed() < Duration::from_secs(5));
}

#[tokio::test]
async fn only_one_sign_in_can_wait_at_a_time() {
    let control: &'static SignInControl = Box::leak(Box::default());
    let _ticket = control.begin().expect("first");
    assert!(control.begin().is_err());
}

#[test]
fn recorded_sign_in_keeps_tokens_out_of_sqlite() {
    let mut connection = open_test_connection();
    let store = MemoryStore::default();
    let saved = credentials(TEST_NOW + 3_600_000, &[PLAN_USAGE_SCOPE]);

    record_sign_in(&mut connection, &store, &saved).expect("record");

    let values: Vec<String> = connection
        .prepare("SELECT key || '=' || value FROM settings")
        .unwrap()
        .query_map([], |row| row.get(0))
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap();
    assert!(values.iter().all(|value| !value.contains("access-old")
        && !value.contains("refresh-old")
        && !value.contains("id.token.value")));
    assert_eq!(store.current(), Some(saved));
    let state = crate::ai::testing::load_ai_settings_rows(&connection).expect("state");
    assert_eq!(state.chatgpt.status, "connected");
    assert!(state.chatgpt.plan_usage);
    assert_eq!(state.chatgpt.email.as_deref(), Some("learner@example.com"));
}

fn token_server(refresh_reply: Value, refresh_status: u16) -> MockServer {
    MockServer::start(move |request| match request.path_only() {
        "/api/accounts/oauth/token" => {
            let form = request.form();
            assert_eq!(form["grant_type"], "refresh_token");
            assert_eq!(form["client_id"], CLIENT_ID);
            assert!(!form.contains_key("scope"));
            MockResponse::json(refresh_status, refresh_reply.clone())
        }
        "/v1/responses" => {
            if request.headers.get("authorization").map(String::as_str) == Some("Bearer access-old")
            {
                MockResponse::json(
                    401,
                    json!({"error": {"code": "subscription_sharing_invalid_user"}}),
                )
            } else {
                completed_stream("fresh answer")
            }
        }
        "/v1/models" => MockResponse::json(
            200,
            json!({"models": [
                {"slug": "gpt-a", "display_name": "GPT A", "visibility": "list"}
            ]}),
        ),
        _ => MockResponse::json(404, json!({})),
    })
}

#[tokio::test]
async fn a_token_near_expiry_is_refreshed_and_the_rotated_refresh_token_saved() {
    let server = token_server(
        json!({"access_token": "access-new", "refresh_token": "refresh-rotated", "expires_in": 3600}),
        200,
    );
    let store = MemoryStore::with(credentials(TEST_NOW + 60_000, &[PLAN_USAGE_SCOPE]));

    let fresh = ensure_fresh_credentials(&endpoints(&server), &store, false, &now)
        .await
        .expect("refresh");

    assert_eq!(fresh.access_token, "access-new");
    assert_eq!(fresh.refresh_token.as_deref(), Some("refresh-rotated"));
    assert_eq!(fresh.scopes, vec![PLAN_USAGE_SCOPE.to_string()]);
    assert_eq!(
        store.current().unwrap().refresh_token.as_deref(),
        Some("refresh-rotated")
    );
}

#[tokio::test]
async fn an_unusable_refresh_token_clears_the_session_and_reports_it_expired() {
    let server = token_server(json!({"error": "refresh_token_expired"}), 400);
    let store = MemoryStore::with(credentials(TEST_NOW - 1, &[PLAN_USAGE_SCOPE]));

    let error = ensure_fresh_credentials(&endpoints(&server), &store, false, &now)
        .await
        .expect_err("expired");

    assert_eq!(reason(&error), Some(AiConnectionReason::Expired));
    assert!(store.current().is_none());
}

#[tokio::test]
async fn a_rejected_access_token_is_refreshed_once_and_the_request_retried() {
    let server = token_server(
        json!({"access_token": "access-new", "refresh_token": "refresh-rotated", "expires_in": 3600}),
        200,
    );
    let store = MemoryStore::with(credentials(TEST_NOW + 3_600_000, &[PLAN_USAGE_SCOPE]));

    let text = execute_chatgpt_completion(
        &endpoints(&server),
        &store,
        "gpt-a",
        Some("sys"),
        "hi",
        &now,
    )
    .await
    .expect("retry succeeds");

    assert_eq!(text, "fresh answer");
    assert_eq!(server.requests_to("/v1/responses").len(), 2);
    assert_eq!(server.requests_to("/api/accounts/oauth/token").len(), 1);
}

#[tokio::test]
async fn a_session_without_plan_usage_is_refused_before_any_request() {
    let server = token_server(json!({}), 200);
    let store = MemoryStore::with(credentials(TEST_NOW + 3_600_000, &["openid", "email"]));

    let error = execute_chatgpt_completion(&endpoints(&server), &store, "gpt-a", None, "hi", &now)
        .await
        .expect_err("declined");

    assert_eq!(reason(&error), Some(AiConnectionReason::Declined));
    assert!(server.requests_to("/v1/responses").is_empty());
}

#[tokio::test]
async fn account_models_come_from_the_plan_catalog() {
    let server = token_server(json!({}), 200);
    let store = MemoryStore::with(credentials(TEST_NOW + 3_600_000, &[PLAN_USAGE_SCOPE]));

    let models = list_chatgpt_models(&endpoints(&server), &store, &now)
        .await
        .expect("models");

    assert_eq!(
        models,
        vec![ChatgptModel {
            id: "gpt-a".into(),
            label: "GPT A".into()
        }]
    );
}

#[tokio::test]
async fn disconnect_revokes_the_refresh_token_and_clears_local_tokens() {
    let issuer = Arc::new(Mutex::new(String::new()));
    let issuer_for_server = Arc::clone(&issuer);
    let server = MockServer::start(move |request| {
        let issuer = issuer_for_server.lock().unwrap().clone();
        match request.path_only() {
            "/.well-known/openid-configuration" => MockResponse::json(
                200,
                json!({
                    "issuer": issuer, "jwks_uri": format!("{issuer}/jwks"),
                    "revocation_endpoint": format!("{issuer}/revoke"),
                }),
            ),
            "/revoke" => MockResponse::json(200, json!({})),
            _ => MockResponse::json(404, json!({})),
        }
    });
    *issuer.lock().unwrap() = server.base.clone();
    let store = MemoryStore::with(credentials(TEST_NOW, &[PLAN_USAGE_SCOPE]));

    let revoked = disconnect_chatgpt(&endpoints(&server), &store)
        .await
        .expect("disconnect");

    assert!(revoked);
    assert!(store.current().is_none());
    let form = server.requests_to("/revoke")[0].form();
    assert_eq!(form["token"], "refresh-old");
    assert_eq!(form["token_type_hint"], "refresh_token");
}

#[tokio::test]
async fn disconnect_without_reaching_openai_still_clears_tokens_but_says_so() {
    let unreachable = ChatgptEndpoints {
        auth_base: "http://127.0.0.1:9".to_string(),
        api_base: "http://127.0.0.1:9/v1".to_string(),
    };
    let store = MemoryStore::with(credentials(TEST_NOW, &[PLAN_USAGE_SCOPE]));

    let revoked = disconnect_chatgpt(&unreachable, &store)
        .await
        .expect("disconnect");

    assert!(!revoked);
    assert!(store.current().is_none());
}

#[test]
fn a_rejected_saved_registration_is_recognized_in_the_callback_and_token_reply() {
    let callback = parse_callback(
        "/auth/callback?state=state-123&error=invalid_client",
        &pending(Some("oaiapp_saved")),
    )
    .expect_err("rejected");
    assert!(is_registration_rejected(&callback));
    assert!(is_registration_rejected(&classify_token_error(
        401,
        r#"{"error":"invalid_client"}"#
    )));
    // Without a saved registration there is nothing to forget.
    let first_time = parse_callback(
        "/auth/callback?state=state-123&error=invalid_client",
        &pending(None),
    )
    .expect_err("failed");
    assert!(!is_registration_rejected(&first_time));
}

#[test]
fn a_new_account_sign_in_registers_afresh_even_with_a_saved_registration() {
    let mut connection = open_test_connection();
    record_sign_in(
        &mut connection,
        &MemoryStore::default(),
        &credentials(TEST_NOW + 3_600_000, &[PLAN_USAGE_SCOPE]),
    )
    .expect("record");
    record_chatgpt_status(&connection, ChatgptStatus::Disconnected).expect("disconnect");

    let state = crate::ai::testing::load_ai_settings_rows(&connection).expect("state");
    assert!(state.chatgpt.saved_account);
    let returning = load_sign_in_inputs(&connection, false).expect("returning");
    assert_eq!(returning.saved_client_id.as_deref(), Some(CLIENT_ID));
    let new_account = load_sign_in_inputs(&connection, true).expect("new account");
    assert!(new_account.saved_client_id.is_none());
    assert_eq!(new_account.host_id, returning.host_id);
}

#[tokio::test]
async fn a_registration_openai_rejects_is_dropped_and_the_next_sign_in_registers_afresh() {
    let mut connection = open_test_connection();
    super::support::seed_space(&connection, "space-1", "Networking", TEST_NOW);
    super::support::seed_card(
        &connection,
        "card-1",
        "space-1",
        "Q",
        "A",
        0,
        TEST_NOW,
        false,
        TEST_NOW,
    );
    let store = MemoryStore::default();
    let mut rejected = credentials(TEST_NOW - 1, &[PLAN_USAGE_SCOPE]);
    rejected.client_id = "oaiapp_rejected".into();
    record_sign_in(&mut connection, &store, &rejected).expect("record");
    let refresh_server =
        MockServer::start(|_| MockResponse::json(401, json!({"error": "invalid_client"})));

    // A request finds the registration rejected; the app notes it.
    let error = ensure_fresh_credentials(&endpoints(&refresh_server), &store, false, &now)
        .await
        .expect_err("rejected");
    assert!(is_registration_rejected(&error));
    note_chatgpt_failure(&connection, &error).expect("note");
    let state = crate::ai::testing::load_ai_settings_rows(&connection).expect("state");
    assert_eq!(state.chatgpt.status, "expired");
    assert!(!state.chatgpt.saved_account);

    // The user disconnects, then connects again.
    disconnect_chatgpt(&endpoints(&refresh_server), &store)
        .await
        .expect("disconnect");
    record_chatgpt_status(&connection, ChatgptStatus::Disconnected).expect("status");
    let inputs = load_sign_in_inputs(&connection, false).expect("inputs");
    assert!(inputs.saved_client_id.is_none());

    let nonce = Arc::new(Mutex::new(String::new()));
    let issuer = Arc::new(Mutex::new(String::new()));
    let server = oauth_server(Arc::clone(&nonce), Arc::clone(&issuer));
    *issuer.lock().unwrap() = server.base.clone();
    let control: &'static SignInControl = Box::leak(Box::default());
    let mut opened_url = String::new();
    let fresh = run_chatgpt_sign_in(
        &endpoints(&server),
        control,
        inputs,
        |url| {
            opened_url = url.to_string();
            simulate_browser(url, &nonce, |state| {
                format!("code=auth-code&state={state}&client_id={CLIENT_ID}")
            });
            Ok(())
        },
        Duration::from_secs(10),
        now,
    )
    .await
    .expect("fresh sign in");
    record_sign_in(&mut connection, &store, &fresh).expect("record fresh");

    assert!(opened_url.contains("client_id=dynamic_agent_client"));
    let state = crate::ai::testing::load_ai_settings_rows(&connection).expect("state");
    assert_eq!(state.chatgpt.status, "connected");
    assert_eq!(
        load_sign_in_inputs(&connection, false)
            .unwrap()
            .saved_client_id
            .as_deref(),
        Some(CLIENT_ID)
    );
    let cards: i64 = connection
        .query_row("SELECT COUNT(*) FROM cards", [], |row| row.get(0))
        .unwrap();
    assert_eq!(cards, 1, "reconnecting must not touch study data");
}

#[tokio::test]
async fn disconnecting_during_a_refresh_keeps_the_new_tokens_out_and_starts_no_request() {
    // The token reply is held until the test has disconnected.
    let release = Arc::new((Mutex::new(false), std::sync::Condvar::new()));
    let held = Arc::clone(&release);
    let issuer = Arc::new(Mutex::new(String::new()));
    let issuer_for_server = Arc::clone(&issuer);
    let server = MockServer::start(move |request| {
        let issuer = issuer_for_server.lock().unwrap().clone();
        match request.path_only() {
            "/api/accounts/oauth/token" => {
                let (lock, ready) = &*held;
                let mut released = lock.lock().unwrap();
                while !*released {
                    released = ready.wait(released).unwrap();
                }
                MockResponse::json(
                    200,
                    json!({"access_token": "access-late", "refresh_token": "refresh-late", "expires_in": 3600}),
                )
            }
            "/.well-known/openid-configuration" => MockResponse::json(
                200,
                json!({
                    "issuer": issuer, "jwks_uri": format!("{issuer}/jwks"),
                    "revocation_endpoint": format!("{issuer}/revoke"),
                }),
            ),
            "/revoke" => MockResponse::json(200, json!({})),
            "/v1/responses" => completed_stream("should not run"),
            _ => MockResponse::json(404, json!({})),
        }
    });
    *issuer.lock().unwrap() = server.base.clone();
    let store = Arc::new(MemoryStore::with(credentials(
        TEST_NOW - 1,
        &[PLAN_USAGE_SCOPE],
    )));
    let request_store = Arc::clone(&store);
    let request_endpoints = endpoints(&server);
    let request = tokio::spawn(async move {
        execute_chatgpt_completion(
            &request_endpoints,
            request_store.as_ref(),
            "gpt-a",
            None,
            "hi",
            &now,
        )
        .await
    });
    let deadline = Instant::now() + Duration::from_secs(5);
    while server.requests_to("/api/accounts/oauth/token").is_empty() {
        assert!(Instant::now() < deadline, "the refresh never started");
        tokio::time::sleep(Duration::from_millis(10)).await;
    }

    let revoked = disconnect_chatgpt(&endpoints(&server), store.as_ref())
        .await
        .expect("disconnect");
    {
        let (lock, ready) = &*release;
        *lock.lock().unwrap() = true;
        ready.notify_all();
    }
    let error = request.await.unwrap().expect_err("stopped");

    assert!(revoked);
    assert_eq!(reason(&error), Some(AiConnectionReason::Cancelled));
    assert!(store.current().is_none(), "the late refresh was saved");
    assert!(server.requests_to("/v1/responses").is_empty());
    // Both the old session and the tokens that arrived late are revoked.
    let revoked_tokens: Vec<String> = server
        .requests_to("/revoke")
        .iter()
        .map(|request| request.form()["token"].clone())
        .collect();
    assert!(revoked_tokens.contains(&"refresh-old".to_string()));
    assert!(revoked_tokens.contains(&"refresh-late".to_string()));
}
