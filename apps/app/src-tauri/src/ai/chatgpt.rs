//! ChatGPT plan usage for open-source, locally hosted apps.
//!
//! This follows OpenAI's documented "Sign in with ChatGPT" plan-usage flow
//! (developers.openai.com/siwc/token-sharing-open-source): dynamic client
//! registration with PKCE over a 127.0.0.1 loopback redirect, ID-token
//! validation against OpenAI's JWKS, then streamed Responses API requests with
//! the user's bearer token. Pupil owns these tokens, so they live in the OS
//! secure store via `secrets.rs` and never reach SQLite, logs, or the UI.

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;
use std::time::{Duration, Instant};

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::error::{AiConnectionReason, AppError, AppResult};

pub(crate) const CHATGPT_PROVIDER: &str = "chatgpt";
pub(crate) const PLAN_USAGE_SCOPE: &str = "chatgpt.tokens.use.direct";
const SCOPES: &str =
    "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct";
const RESOURCE: &str = "https://api.openai.com/v1";
const DYNAMIC_CLIENT_ID: &str = "dynamic_agent_client";
const AGENT_NAME: &str = "Pupil";
const CALLBACK_PATH: &str = "/auth/callback";
const PREFERRED_CALLBACK_PORT: u16 = 1455;
/// Refresh a little before expiry so a long generation doesn't start with a
/// token that dies mid-stream.
const REFRESH_MARGIN_MS: i64 = 5 * 60 * 1000;

/// Where the OAuth and inference endpoints live. Production uses OpenAI's
/// hosts; tests point this at a loopback mock server.
#[derive(Clone, Debug)]
pub(crate) struct ChatgptEndpoints {
    pub(crate) auth_base: String,
    pub(crate) api_base: String,
}

impl Default for ChatgptEndpoints {
    fn default() -> Self {
        Self {
            auth_base: "https://auth.openai.com".to_string(),
            api_base: "https://api.openai.com/v1".to_string(),
        }
    }
}

impl ChatgptEndpoints {
    fn authorize_url(&self) -> String {
        format!("{}/api/accounts/authorize", self.auth_base)
    }
    fn token_url(&self) -> String {
        format!("{}/api/accounts/oauth/token", self.auth_base)
    }
    fn discovery_url(&self) -> String {
        format!("{}/.well-known/openid-configuration", self.auth_base)
    }
}

/// The saved credential record. `Debug` is hand-written so a stray log line
/// can never print a token.
#[derive(Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ChatgptCredentials {
    pub(crate) client_id: String,
    pub(crate) subject: String,
    pub(crate) email: Option<String>,
    pub(crate) id_token: String,
    pub(crate) access_token: String,
    pub(crate) refresh_token: Option<String>,
    pub(crate) token_type: String,
    pub(crate) expires_at_ms: i64,
    pub(crate) scopes: Vec<String>,
    pub(crate) saved_at_ms: i64,
}

impl std::fmt::Debug for ChatgptCredentials {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("ChatgptCredentials")
            .field("client_id", &self.client_id)
            .field("email", &self.email)
            .field("expires_at_ms", &self.expires_at_ms)
            .field("scopes", &self.scopes)
            .field("tokens", &"[redacted]")
            .finish()
    }
}

impl ChatgptCredentials {
    pub(crate) fn has_plan_usage(&self) -> bool {
        self.scopes.iter().any(|scope| scope == PLAN_USAGE_SCOPE)
    }

    pub(crate) fn needs_refresh(&self, now_ms: i64) -> bool {
        self.expires_at_ms - REFRESH_MARGIN_MS <= now_ms
    }
}

/// Per-attempt values kept until the callback arrives.
pub(crate) struct PendingAuthorization {
    pub(crate) state: String,
    pub(crate) nonce: String,
    pub(crate) verifier: String,
    pub(crate) client_id: Option<String>,
    pub(crate) redirect_uri: String,
}

impl PendingAuthorization {
    pub(crate) fn new(saved_client_id: Option<String>, port: u16) -> AppResult<Self> {
        Ok(Self {
            state: random_urlsafe(32)?,
            nonce: random_urlsafe(32)?,
            verifier: random_urlsafe(48)?,
            client_id: saved_client_id.filter(|id| !id.trim().is_empty()),
            redirect_uri: format!("http://127.0.0.1:{port}{CALLBACK_PATH}"),
        })
    }

    pub(crate) fn is_registration(&self) -> bool {
        self.client_id.is_none()
    }
}

pub(crate) fn random_urlsafe(bytes: usize) -> AppResult<String> {
    let mut buffer = vec![0u8; bytes];
    getrandom::getrandom(&mut buffer)
        .map_err(|error| AppError::internal_message(error.to_string()))?;
    Ok(URL_SAFE_NO_PAD.encode(buffer))
}

pub(crate) fn pkce_challenge(verifier: &str) -> String {
    let digest = ring::digest::digest(&ring::digest::SHA256, verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(digest.as_ref())
}

/// A stable, opaque per-install identifier in the `urn:uuid:` form OpenAI
/// accepts. It holds no user information.
pub(crate) fn new_host_id() -> AppResult<String> {
    let mut bytes = [0u8; 16];
    getrandom::getrandom(&mut bytes)
        .map_err(|error| AppError::internal_message(error.to_string()))?;
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    let hex: String = bytes.iter().map(|byte| format!("{byte:02x}")).collect();
    Ok(format!(
        "urn:uuid:{}-{}-{}-{}-{}",
        &hex[0..8],
        &hex[8..12],
        &hex[12..16],
        &hex[16..20],
        &hex[20..32]
    ))
}

pub(crate) fn is_valid_host_id(value: &str) -> bool {
    value.len() <= 128
        && (value.starts_with("urn:uuid:")
            || value.starts_with("urn:ietf:params:oauth:jwk-thumbprint:")
            || value.starts_with("did:key:"))
}

pub(crate) fn build_authorize_url(
    endpoints: &ChatgptEndpoints,
    pending: &PendingAuthorization,
    host_id: &str,
) -> AppResult<reqwest::Url> {
    let mut url = reqwest::Url::parse(&endpoints.authorize_url())
        .map_err(|_| AppError::internal_message("Invalid ChatGPT authorize URL."))?;
    {
        let mut query = url.query_pairs_mut();
        query
            .append_pair(
                "client_id",
                pending.client_id.as_deref().unwrap_or(DYNAMIC_CLIENT_ID),
            )
            .append_pair("ext_agent_host_id", host_id)
            .append_pair("response_type", "code")
            .append_pair("redirect_uri", &pending.redirect_uri)
            .append_pair("scope", SCOPES)
            .append_pair("resource", RESOURCE)
            .append_pair("state", &pending.state)
            .append_pair("nonce", &pending.nonce)
            .append_pair("code_challenge_method", "S256")
            .append_pair("code_challenge", &pkce_challenge(&pending.verifier));
        if pending.is_registration() {
            query.append_pair("agent_name_hint", AGENT_NAME);
        }
    }
    Ok(url)
}

#[derive(Debug, PartialEq)]
pub(crate) struct AuthorizationCode {
    pub(crate) code: String,
    pub(crate) client_id: String,
}

fn sign_in_error(reason: AiConnectionReason, message: impl Into<String>) -> AppError {
    AppError::ai_connection(CHATGPT_PROVIDER, reason, message)
}

const REGISTRATION_REJECTED_MESSAGE: &str =
    "OpenAI no longer recognizes Pupil's earlier registration. Connect ChatGPT again and Pupil will register afresh.";

/// OpenAI rejected the issued client ID Pupil saved. The session is over and
/// the saved registration must be dropped, or every later sign-in would
/// reuse the rejected ID.
pub(crate) fn registration_rejected() -> AppError {
    sign_in_error(AiConnectionReason::Expired, REGISTRATION_REJECTED_MESSAGE)
}

pub(crate) fn is_registration_rejected(error: &AppError) -> bool {
    matches!(
        error,
        AppError::AiConnection { message, provider, .. }
            if provider == CHATGPT_PROVIDER && message == REGISTRATION_REJECTED_MESSAGE
    )
}

/// Validates the redirect the browser sent back to the loopback listener.
pub(crate) fn parse_callback(
    request_target: &str,
    pending: &PendingAuthorization,
) -> AppResult<AuthorizationCode> {
    let url = reqwest::Url::parse(&format!("http://127.0.0.1{request_target}")).map_err(|_| {
        sign_in_error(
            AiConnectionReason::Provider,
            "The sign-in reply was malformed.",
        )
    })?;
    let param = |name: &str| {
        url.query_pairs()
            .find(|(key, _)| key == name)
            .map(|(_, value)| value.into_owned())
    };
    if param("state").as_deref() != Some(pending.state.as_str()) {
        return Err(sign_in_error(
            AiConnectionReason::Provider,
            "The sign-in reply didn't match this attempt. Try connecting again.",
        ));
    }
    if let Some(error) = param("error") {
        if pending.client_id.is_some()
            && matches!(error.as_str(), "invalid_client" | "unauthorized_client")
        {
            return Err(registration_rejected());
        }
        return Err(if error == "access_denied" {
            sign_in_error(
                AiConnectionReason::Declined,
                "ChatGPT sign-in was cancelled, so plan usage is off. Connect again to allow it, or use an API key.",
            )
        } else {
            sign_in_error(
                AiConnectionReason::Provider,
                format!("ChatGPT sign-in failed ({}).", sanitize_code(&error)),
            )
        });
    }
    let code = param("code")
        .filter(|code| !code.is_empty())
        .ok_or_else(|| {
            sign_in_error(
                AiConnectionReason::Provider,
                "The sign-in reply had no authorization code.",
            )
        })?;
    let returned_client = param("client_id").filter(|id| !id.is_empty());
    let client_id = match (&pending.client_id, returned_client) {
        (Some(saved), Some(returned)) if saved != &returned => {
            return Err(sign_in_error(
                AiConnectionReason::Provider,
                "The sign-in reply named a different app registration. Try connecting again.",
            ))
        }
        (Some(saved), _) => saved.clone(),
        (None, Some(returned)) => returned,
        (None, None) => {
            return Err(sign_in_error(
                AiConnectionReason::Provider,
                "OpenAI didn't finish registering Pupil. Try connecting again.",
            ))
        }
    };
    Ok(AuthorizationCode { code, client_id })
}

fn sanitize_code(value: &str) -> String {
    value
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric() || *ch == '_')
        .take(64)
        .collect()
}

#[derive(Deserialize)]
pub(crate) struct TokenResponse {
    pub(crate) access_token: String,
    #[serde(default)]
    pub(crate) refresh_token: Option<String>,
    #[serde(default)]
    pub(crate) id_token: Option<String>,
    #[serde(default)]
    pub(crate) token_type: Option<String>,
    #[serde(default)]
    pub(crate) expires_in: Option<i64>,
    #[serde(default)]
    pub(crate) scope: Option<String>,
}

pub(crate) fn split_scopes(scope: Option<&str>) -> Vec<String> {
    scope
        .unwrap_or_default()
        .split_whitespace()
        .map(str::to_string)
        .collect()
}

/// Token-endpoint failures. The refresh-token codes mean the session is over
/// and the user has to sign in again.
pub(crate) fn classify_token_error(status: u16, body: &str) -> AppError {
    let code = serde_json::from_str::<Value>(body)
        .ok()
        .and_then(|value| {
            value.get("error").and_then(|error| {
                error.as_str().map(str::to_string).or_else(|| {
                    error
                        .get("code")
                        .and_then(Value::as_str)
                        .map(str::to_string)
                })
            })
        })
        .unwrap_or_default();
    match code.as_str() {
        "invalid_grant"
        | "invalid_refresh_token"
        | "token_expired"
        | "refresh_token_expired"
        | "refresh_token_invalidated"
        | "refresh_token_reused" => sign_in_error(
            AiConnectionReason::Expired,
            "Your ChatGPT connection has ended. Reconnect in Settings to keep using your plan.",
        ),
        "invalid_client" => registration_rejected(),
        _ => AppError::ai_provider(
            "OpenAI's sign-in service rejected the request.",
            Some(format!("HTTP {status} {}", sanitize_code(&code))),
        ),
    }
}

#[derive(Debug, PartialEq)]
pub(crate) struct IdentityClaims {
    pub(crate) subject: String,
    pub(crate) email: Option<String>,
}

fn decode_segment(segment: &str) -> AppResult<Vec<u8>> {
    URL_SAFE_NO_PAD
        .decode(segment.trim_end_matches('='))
        .map_err(|_| invalid_id_token())
}

fn invalid_id_token() -> AppError {
    sign_in_error(
        AiConnectionReason::Provider,
        "OpenAI's sign-in reply couldn't be verified. Try connecting again.",
    )
}

/// Verifies an RS256 JWT against a JWKS document and returns its claims.
pub(crate) fn verify_rs256(jwt: &str, jwks: &Value) -> AppResult<Value> {
    let parts: Vec<&str> = jwt.split('.').collect();
    let [header, payload, signature] = parts.as_slice() else {
        return Err(invalid_id_token());
    };
    let header: Value =
        serde_json::from_slice(&decode_segment(header)?).map_err(|_| invalid_id_token())?;
    if header.get("alg").and_then(Value::as_str) != Some("RS256") {
        return Err(invalid_id_token());
    }
    let kid = header.get("kid").and_then(Value::as_str);
    let keys = jwks
        .get("keys")
        .and_then(Value::as_array)
        .ok_or_else(invalid_id_token)?;
    let key = keys
        .iter()
        .filter(|key| key.get("kty").and_then(Value::as_str) == Some("RSA"))
        .find(|key| kid.is_none() || key.get("kid").and_then(Value::as_str) == kid)
        .ok_or_else(invalid_id_token)?;
    let modulus = decode_segment(key.get("n").and_then(Value::as_str).unwrap_or_default())?;
    let exponent = decode_segment(key.get("e").and_then(Value::as_str).unwrap_or_default())?;
    let signature = decode_segment(signature)?;
    let signing_input = format!("{}.{}", parts[0], parts[1]);
    ring::signature::RsaPublicKeyComponents {
        n: modulus,
        e: exponent,
    }
    .verify(
        &ring::signature::RSA_PKCS1_2048_8192_SHA256,
        signing_input.as_bytes(),
        &signature,
    )
    .map_err(|_| invalid_id_token())?;
    serde_json::from_slice(&decode_segment(payload)?).map_err(|_| invalid_id_token())
}

pub(crate) fn validate_id_claims(
    claims: &Value,
    issuer: &str,
    client_id: &str,
    nonce: &str,
    now_secs: i64,
) -> AppResult<IdentityClaims> {
    let audience_ok = match claims.get("aud") {
        Some(Value::String(aud)) => aud == client_id,
        Some(Value::Array(values)) => values.iter().any(|aud| aud.as_str() == Some(client_id)),
        _ => false,
    };
    let exp = claims.get("exp").and_then(Value::as_i64).unwrap_or(0);
    let ok = claims.get("iss").and_then(Value::as_str) == Some(issuer)
        && audience_ok
        && exp > now_secs - 60
        && claims.get("nonce").and_then(Value::as_str) == Some(nonce);
    let subject = claims
        .get("sub")
        .and_then(Value::as_str)
        .filter(|sub| !sub.is_empty());
    match (ok, subject) {
        (true, Some(subject)) => Ok(IdentityClaims {
            subject: subject.to_string(),
            email: claims
                .get("email")
                .and_then(Value::as_str)
                .map(str::to_string),
        }),
        _ => Err(invalid_id_token()),
    }
}

#[derive(Debug, Clone)]
pub(crate) struct Discovery {
    pub(crate) issuer: String,
    pub(crate) jwks_uri: String,
    pub(crate) revocation_endpoint: Option<String>,
}

fn is_trusted_endpoint(value: &str, endpoints: &ChatgptEndpoints) -> bool {
    let Ok(url) = reqwest::Url::parse(value) else {
        return false;
    };
    match url.scheme() {
        "https" => true,
        // Only the loopback mock server used by tests may be plain HTTP.
        "http" => {
            url.host_str() == Some("127.0.0.1")
                && endpoints.auth_base.starts_with("http://127.0.0.1")
        }
        _ => false,
    }
}

pub(crate) fn parse_discovery(value: &Value, endpoints: &ChatgptEndpoints) -> AppResult<Discovery> {
    let field = |name: &str| value.get(name).and_then(Value::as_str).map(str::to_string);
    let issuer = field("issuer").ok_or_else(invalid_id_token)?;
    let jwks_uri = field("jwks_uri")
        .filter(|uri| is_trusted_endpoint(uri, endpoints))
        .ok_or_else(invalid_id_token)?;
    let revocation_endpoint =
        field("revocation_endpoint").filter(|uri| is_trusted_endpoint(uri, endpoints));
    Ok(Discovery {
        issuer,
        jwks_uri,
        revocation_endpoint,
    })
}

pub(crate) fn build_responses_payload(model: &str, system: Option<&str>, user: &str) -> Value {
    let mut payload = serde_json::json!({
        "model": model,
        "input": [{ "role": "user", "content": user }],
        "store": false,
        "stream": true,
    });
    if let Some(system) = system.filter(|system| !system.is_empty()) {
        payload["instructions"] = Value::String(system.to_string());
    }
    payload
}

/// Plan-usage failures, from an HTTP status before the stream opened or an
/// error code inside a `response.failed` event.
pub(crate) fn classify_chatgpt_error(status: Option<u16>, body: &str, model: &str) -> AppError {
    let lowered = body.to_ascii_lowercase();
    let has = |code: &str| lowered.contains(code);
    if has("subscription_sharing_usage_limit_exceeded") || status == Some(429) {
        return sign_in_error(
            AiConnectionReason::UsageLimit,
            "You've reached your ChatGPT plan usage limit. Check usage in ChatGPT settings, or try again later.",
        );
    }
    if has("subscription_sharing_usage_unavailable") {
        return sign_in_error(
            AiConnectionReason::UsageLimit,
            "ChatGPT plan usage isn't available for Pupil right now. Check usage in ChatGPT settings.",
        );
    }
    if has("subscription_sharing_user_not_eligible") {
        return sign_in_error(
            AiConnectionReason::NotEligible,
            "ChatGPT plan usage isn't available for this account or workspace. Ask your admin, or use an API key connection.",
        );
    }
    if has("subscription_sharing_invalid_user") || status == Some(401) {
        return sign_in_error(
            AiConnectionReason::Expired,
            "Your ChatGPT connection has ended. Reconnect in Settings to keep using your plan.",
        );
    }
    if has("model_not_found") || status == Some(404) {
        return sign_in_error(
            AiConnectionReason::ModelUnavailable,
            format!("Your ChatGPT plan can't use the model \"{model}\". Choose another model in Settings."),
        );
    }
    if status == Some(403) {
        return sign_in_error(
            AiConnectionReason::NotEligible,
            "OpenAI refused this request. Plan usage may not be available in your region or workspace.",
        );
    }
    let detail = match status {
        Some(code) => format!("HTTP {code}: {}", truncate(&error_detail(body), 240)),
        None => truncate(&error_detail(body), 240),
    };
    AppError::ai_provider("ChatGPT couldn't complete the request.", Some(detail))
}

fn error_detail(body: &str) -> String {
    serde_json::from_str::<Value>(body)
        .ok()
        .and_then(|value| {
            value
                .pointer("/error/message")
                .or_else(|| value.pointer("/response/error/message"))
                .or_else(|| value.get("detail"))
                .or_else(|| value.get("message"))
                .and_then(Value::as_str)
                .map(str::to_string)
        })
        .unwrap_or_else(|| body.to_string())
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

/// Reads a Responses API event stream and returns the output text. A stream
/// that never reaches `response.completed` is a failure.
pub(crate) fn parse_responses_stream(body: &str, model: &str) -> AppResult<String> {
    let mut text = String::new();
    let mut completed_text = String::new();
    let mut completed = false;
    for line in body.lines() {
        let Some(data) = line.strip_prefix("data:") else {
            continue;
        };
        let data = data.trim();
        if data.is_empty() || data == "[DONE]" {
            continue;
        }
        let Ok(event) = serde_json::from_str::<Value>(data) else {
            continue;
        };
        match event
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or_default()
        {
            "response.output_text.delta" => {
                if let Some(delta) = event.get("delta").and_then(Value::as_str) {
                    text.push_str(delta);
                }
            }
            "response.completed" => {
                completed = true;
                completed_text = collect_output_text(event.pointer("/response/output"));
            }
            "response.failed" | "error" => {
                return Err(classify_chatgpt_error(None, data, model));
            }
            "response.incomplete" => {
                let reason = event
                    .pointer("/response/incomplete_details/reason")
                    .and_then(Value::as_str)
                    .unwrap_or("unknown");
                return Err(AppError::ai_provider(
                    "ChatGPT stopped before finishing the response.",
                    Some(format!("incomplete: {}", sanitize_code(reason))),
                ));
            }
            _ => {}
        }
    }
    if !completed {
        return Err(AppError::ai_provider(
            "The ChatGPT response ended early.",
            None::<String>,
        ));
    }
    let output = if text.trim().is_empty() {
        completed_text
    } else {
        text
    };
    if output.trim().is_empty() {
        return Err(AppError::ai_provider(
            "ChatGPT returned no text.",
            None::<String>,
        ));
    }
    Ok(output)
}

fn collect_output_text(output: Option<&Value>) -> String {
    output
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.get("content").and_then(Value::as_array))
                .flatten()
                .filter(|part| part.get("type").and_then(Value::as_str) == Some("output_text"))
                .filter_map(|part| part.get("text").and_then(Value::as_str))
                .collect::<String>()
        })
        .unwrap_or_default()
}

#[derive(Serialize, Debug, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ChatgptModel {
    pub(crate) id: String,
    pub(crate) label: String,
}

/// Keeps listable models from the account-specific catalog.
pub(crate) fn parse_models(value: &Value) -> Vec<ChatgptModel> {
    let mut seen = std::collections::HashSet::new();
    value
        .get("models")
        .and_then(Value::as_array)
        .map(|models| {
            models
                .iter()
                .filter(|model| {
                    model
                        .get("visibility")
                        .and_then(Value::as_str)
                        .is_none_or(|visibility| visibility == "list")
                })
                .filter_map(|model| {
                    let id = model.get("slug").and_then(Value::as_str)?.trim();
                    if id.is_empty() || !seen.insert(id.to_string()) {
                        return None;
                    }
                    let label = model
                        .get("display_name")
                        .and_then(Value::as_str)
                        .filter(|label| !label.trim().is_empty())
                        .unwrap_or(id);
                    Some(ChatgptModel {
                        id: id.to_string(),
                        label: label.to_string(),
                    })
                })
                .take(200)
                .collect()
        })
        .unwrap_or_default()
}

pub(crate) fn validate_model(raw: &str) -> Result<String, String> {
    let model = raw.trim();
    let valid = !model.is_empty()
        && model.len() <= 100
        && model
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || "-._:".contains(ch));
    if valid {
        Ok(model.to_string())
    } else {
        Err("Choose a ChatGPT model from the list.".to_string())
    }
}

fn http_client() -> AppResult<&'static reqwest::Client> {
    static CLIENT: OnceLock<Result<reqwest::Client, String>> = OnceLock::new();
    CLIENT
        .get_or_init(|| {
            reqwest::Client::builder()
                .connect_timeout(Duration::from_secs(15))
                .timeout(Duration::from_secs(
                    crate::constants::AI_REQUEST_TIMEOUT_SECS,
                ))
                .redirect(reqwest::redirect::Policy::none())
                .build()
                .map_err(|error| error.to_string())
        })
        .as_ref()
        .map_err(|error| AppError::internal_message(error.clone()))
}

fn network_error(what: &str, error: &reqwest::Error) -> AppError {
    if error.is_timeout() {
        return AppError::ai_connection(
            CHATGPT_PROVIDER,
            AiConnectionReason::Timeout,
            format!("{what} took too long. Check your connection and try again."),
        );
    }
    // reqwest errors can include the URL; ours never carry tokens in URLs.
    AppError::ai_provider(
        format!("Failed to reach {what}."),
        Some(error.without_url_string()),
    )
}

trait WithoutUrl {
    fn without_url_string(&self) -> String;
}

impl WithoutUrl for reqwest::Error {
    fn without_url_string(&self) -> String {
        let mut text = self.to_string();
        if let Some(url) = self.url() {
            text = text.replace(url.as_str(), "[endpoint]");
        }
        text
    }
}

async fn post_token_form(
    endpoints: &ChatgptEndpoints,
    form: &[(&str, &str)],
) -> AppResult<TokenResponse> {
    let response = http_client()?
        .post(endpoints.token_url())
        .form(form)
        .send()
        .await
        .map_err(|error| network_error("OpenAI's sign-in service", &error))?;
    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|error| network_error("OpenAI's sign-in service", &error))?;
    if !status.is_success() {
        return Err(classify_token_error(status.as_u16(), &body));
    }
    serde_json::from_str(&body).map_err(|_| {
        AppError::ai_provider(
            "OpenAI's sign-in service sent an invalid reply.",
            None::<String>,
        )
    })
}

pub(crate) async fn exchange_code(
    endpoints: &ChatgptEndpoints,
    pending: &PendingAuthorization,
    code: &AuthorizationCode,
) -> AppResult<TokenResponse> {
    post_token_form(
        endpoints,
        &[
            ("grant_type", "authorization_code"),
            ("client_id", &code.client_id),
            ("code", &code.code),
            ("code_verifier", &pending.verifier),
            ("redirect_uri", &pending.redirect_uri),
            ("resource", RESOURCE),
        ],
    )
    .await
}

pub(crate) async fn refresh_tokens(
    endpoints: &ChatgptEndpoints,
    credentials: &ChatgptCredentials,
) -> AppResult<TokenResponse> {
    let refresh_token = credentials.refresh_token.as_deref().ok_or_else(|| {
        sign_in_error(
            AiConnectionReason::Expired,
            "Your ChatGPT connection has ended. Reconnect in Settings to keep using your plan.",
        )
    })?;
    post_token_form(
        endpoints,
        &[
            ("grant_type", "refresh_token"),
            ("client_id", &credentials.client_id),
            ("refresh_token", refresh_token),
            ("resource", RESOURCE),
        ],
    )
    .await
}

async fn get_json(url: &str, bearer: Option<&str>) -> AppResult<(u16, String)> {
    let mut request = http_client()?.get(url);
    if let Some(token) = bearer {
        request = request.bearer_auth(token);
    }
    let response = request
        .send()
        .await
        .map_err(|error| network_error("OpenAI", &error))?;
    let status = response.status().as_u16();
    let body = response
        .text()
        .await
        .map_err(|error| network_error("OpenAI", &error))?;
    Ok((status, body))
}

pub(crate) async fn fetch_discovery(endpoints: &ChatgptEndpoints) -> AppResult<Discovery> {
    let (status, body) = get_json(&endpoints.discovery_url(), None).await?;
    if status != 200 {
        return Err(invalid_id_token());
    }
    let value: Value = serde_json::from_str(&body).map_err(|_| invalid_id_token())?;
    parse_discovery(&value, endpoints)
}

pub(crate) async fn fetch_jwks(discovery: &Discovery) -> AppResult<Value> {
    let (status, body) = get_json(&discovery.jwks_uri, None).await?;
    if status != 200 {
        return Err(invalid_id_token());
    }
    serde_json::from_str(&body).map_err(|_| invalid_id_token())
}

/// Revokes the refresh token. Returns whether OpenAI confirmed it.
pub(crate) async fn revoke(endpoints: &ChatgptEndpoints, credentials: &ChatgptCredentials) -> bool {
    let Some(refresh_token) = credentials.refresh_token.as_deref() else {
        return false;
    };
    let Ok(discovery) = fetch_discovery(endpoints).await else {
        return false;
    };
    let Some(endpoint) = discovery.revocation_endpoint else {
        return false;
    };
    let Ok(client) = http_client() else {
        return false;
    };
    for attempt in 0..3u32 {
        let result = client
            .post(&endpoint)
            .form(&[
                ("token", refresh_token),
                ("token_type_hint", "refresh_token"),
                ("client_id", credentials.client_id.as_str()),
            ])
            .send()
            .await;
        match result {
            Ok(response) if response.status().is_success() => return true,
            Ok(response) if response.status().is_client_error() => return false,
            _ => tokio::time::sleep(Duration::from_millis(200 * 2u64.pow(attempt))).await,
        }
    }
    false
}

pub(crate) async fn list_models(
    endpoints: &ChatgptEndpoints,
    access_token: &str,
) -> AppResult<Vec<ChatgptModel>> {
    let (status, body) = get_json(
        &format!("{}/models", endpoints.api_base),
        Some(access_token),
    )
    .await?;
    if status != 200 {
        return Err(classify_chatgpt_error(Some(status), &body, ""));
    }
    let value: Value = serde_json::from_str(&body).map_err(|_| {
        AppError::ai_provider("OpenAI returned an invalid model list.", None::<String>)
    })?;
    Ok(parse_models(&value))
}

/// One streamed Responses request with the user's plan token.
pub(crate) async fn execute_responses(
    endpoints: &ChatgptEndpoints,
    access_token: &str,
    model: &str,
    system: Option<&str>,
    user: &str,
) -> AppResult<String> {
    let response = http_client()?
        .post(format!("{}/responses", endpoints.api_base))
        .bearer_auth(access_token)
        .header(reqwest::header::ACCEPT, "text/event-stream")
        .json(&build_responses_payload(model, system, user))
        .send()
        .await
        .map_err(|error| network_error("ChatGPT", &error))?;
    let status = response.status().as_u16();
    let body = response
        .text()
        .await
        .map_err(|error| network_error("ChatGPT", &error))?;
    if !(200..300).contains(&status) {
        return Err(classify_chatgpt_error(Some(status), &body, model));
    }
    parse_responses_stream(&body, model)
}

/// Binds the loopback redirect listener, preferring OpenAI's example port
/// and falling back to any free port (only the port may vary between
/// sign-ins).
pub(crate) fn bind_loopback() -> AppResult<(TcpListener, u16)> {
    let listener = TcpListener::bind(("127.0.0.1", PREFERRED_CALLBACK_PORT))
        .or_else(|_| TcpListener::bind(("127.0.0.1", 0)))
        .map_err(|error| {
            AppError::internal_message(format!("Couldn't open the sign-in listener: {error}"))
        })?;
    let port = listener.local_addr()?.port();
    listener.set_nonblocking(true)?;
    Ok((listener, port))
}

const CALLBACK_PAGE: &str = "<!doctype html><html><head><meta charset=\"utf-8\"><title>Pupil</title></head><body style=\"font-family:system-ui,sans-serif;padding:48px;color:#222\"><h1 style=\"font-size:20px\">You can return to Pupil.</h1><p>Pupil is finishing the ChatGPT connection. You can close this tab.</p></body></html>";

/// Waits for the browser to hit the callback path. Other requests (such as
/// a favicon fetch) get a 404 and the wait continues.
pub(crate) fn wait_for_callback(
    listener: &TcpListener,
    deadline: Instant,
    cancel: &AtomicBool,
) -> AppResult<String> {
    loop {
        if cancel.load(Ordering::SeqCst) {
            return Err(super::cancellation::cancelled_error(CHATGPT_PROVIDER));
        }
        if Instant::now() >= deadline {
            return Err(AppError::ai_connection(
                CHATGPT_PROVIDER,
                AiConnectionReason::Timeout,
                "ChatGPT sign-in timed out. Connect again when you're ready.",
            ));
        }
        match listener.accept() {
            Ok((stream, _)) => {
                if let Some(target) = handle_connection(stream) {
                    return Ok(target);
                }
            }
            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(Duration::from_millis(100));
            }
            Err(error) => return Err(AppError::from(error)),
        }
    }
}

fn handle_connection(mut stream: TcpStream) -> Option<String> {
    let _ = stream.set_nonblocking(false);
    let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
    let mut buffer = Vec::new();
    let mut chunk = [0u8; 1024];
    while buffer.len() < 16 * 1024 {
        match stream.read(&mut chunk) {
            Ok(0) => break,
            Ok(read) => {
                buffer.extend_from_slice(&chunk[..read]);
                if buffer.windows(4).any(|window| window == b"\r\n\r\n") {
                    break;
                }
            }
            Err(_) => break,
        }
    }
    let request = String::from_utf8_lossy(&buffer);
    let mut parts = request
        .lines()
        .next()
        .unwrap_or_default()
        .split_whitespace();
    let method = parts.next().unwrap_or_default();
    let target = parts.next().unwrap_or_default().to_string();
    let is_callback = method == "GET"
        && (target == CALLBACK_PATH || target.starts_with(&format!("{CALLBACK_PATH}?")));
    let (status, body) = if is_callback {
        ("200 OK", CALLBACK_PAGE)
    } else {
        ("404 Not Found", "Not found")
    };
    let _ = write!(
        stream,
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    let _ = stream.flush();
    is_callback.then_some(target)
}
