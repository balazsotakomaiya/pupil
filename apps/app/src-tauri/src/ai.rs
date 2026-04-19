use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use rusqlite::{params, Connection};
use serde_json::Value;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager};
use tauri_plugin_stronghold::stronghold::Stronghold;

use crate::app::app_data_dir;
#[cfg(target_os = "macos")]
use crate::constants::{AI_SECRET_ACCOUNT_NAME, AI_SECRET_SERVICE_NAME};
use crate::constants::{
    AI_SETTING_BASE_URL_KEY, AI_SETTING_HAS_API_KEY_KEY, AI_SETTING_MAX_TOKENS_KEY,
    AI_SETTING_MODEL_KEY, AI_SETTING_TEMPERATURE_KEY, DEFAULT_AI_BASE_URL, DEFAULT_AI_MAX_TOKENS,
    DEFAULT_AI_MODEL, DEFAULT_AI_TEMPERATURE, STRONGHOLD_SNAPSHOT_FILE_NAME,
};
#[cfg(not(target_os = "macos"))]
use crate::constants::{STRONGHOLD_AI_API_KEY_RECORD_KEY, STRONGHOLD_CLIENT_NAME};
use crate::error::{AppError, AppResult};
use crate::types::{
    AiSettingsState, GenerateCardsInput, GeneratedCardPayload, NormalizedAiSettingsInput,
    NormalizedGenerateCardsInput, ResolvedAiSettings, SaveAiSettingsInput,
};

#[cfg_attr(target_os = "macos", allow(dead_code))]
#[derive(Default)]
pub(crate) struct StrongholdState {
    pub(crate) lock: Mutex<()>,
}

pub(crate) fn load_ai_settings_state(
    _app: &AppHandle,
    connection: &Connection,
) -> AppResult<AiSettingsState> {
    Ok(AiSettingsState {
        base_url: load_string_setting(connection, AI_SETTING_BASE_URL_KEY, DEFAULT_AI_BASE_URL)?,
        model: load_string_setting(connection, AI_SETTING_MODEL_KEY, DEFAULT_AI_MODEL)?,
        max_tokens: load_string_setting(
            connection,
            AI_SETTING_MAX_TOKENS_KEY,
            DEFAULT_AI_MAX_TOKENS,
        )?,
        temperature: load_string_setting(
            connection,
            AI_SETTING_TEMPERATURE_KEY,
            DEFAULT_AI_TEMPERATURE,
        )?,
        has_api_key: load_bool_setting(connection, AI_SETTING_HAS_API_KEY_KEY, false)?,
    })
}

pub(crate) fn save_ai_settings_rows(
    app: &AppHandle,
    connection: &mut Connection,
    input: NormalizedAiSettingsInput,
) -> AppResult<AiSettingsState> {
    let next_has_api_key = match input.api_key.as_ref() {
        Some(api_key) => !api_key.is_empty(),
        None => load_bool_setting(connection, AI_SETTING_HAS_API_KEY_KEY, false)?,
    };

    match input.api_key {
        Some(api_key) if api_key.is_empty() => clear_ai_api_key(app)?,
        Some(api_key) => save_ai_api_key(app, &api_key)?,
        None => {}
    }

    let transaction = connection.transaction()?;
    upsert_setting(&transaction, AI_SETTING_BASE_URL_KEY, &input.base_url)?;
    upsert_setting(&transaction, AI_SETTING_MODEL_KEY, &input.model)?;
    upsert_setting(
        &transaction,
        AI_SETTING_MAX_TOKENS_KEY,
        &input.max_tokens.to_string(),
    )?;
    upsert_setting(
        &transaction,
        AI_SETTING_TEMPERATURE_KEY,
        &trim_trailing_zeroes(input.temperature),
    )?;
    upsert_setting(
        &transaction,
        AI_SETTING_HAS_API_KEY_KEY,
        if next_has_api_key { "1" } else { "0" },
    )?;
    transaction.commit()?;

    load_ai_settings_state(app, connection)
}

pub(crate) fn resolve_ai_settings_for_test(
    app: &AppHandle,
    connection: &Connection,
    input: NormalizedAiSettingsInput,
) -> AppResult<ResolvedAiSettings> {
    let api_key = match input.api_key {
        Some(api_key) if api_key.is_empty() => {
            return Err(AppError::validation_field(
                "Add an API key first.",
                "apiKey",
            ));
        }
        Some(api_key) => api_key,
        None => load_ai_api_key(app)?
            .ok_or_else(|| AppError::validation_field("Add an API key first.", "apiKey"))?,
    };

    let _ = connection;

    let settings = ResolvedAiSettings {
        api_key,
        base_url: input.base_url,
        model: input.model,
        max_tokens: input.max_tokens,
        temperature: input.temperature,
    };

    validate_provider_model_selection(&settings)?;

    Ok(settings)
}

pub(crate) fn load_resolved_ai_settings(
    app: &AppHandle,
    connection: &Connection,
) -> AppResult<ResolvedAiSettings> {
    let state = load_ai_settings_state(app, connection)?;
    let api_key = load_ai_api_key(app)?
        .ok_or_else(|| AppError::validation_field("Add an API key in Settings first.", "apiKey"))?;
    let max_tokens = state.max_tokens.parse::<i64>().map_err(|_| {
        AppError::validation_field("Max tokens must be a positive integer.", "maxTokens")
    })?;
    let temperature = state.temperature.parse::<f64>().map_err(|_| {
        AppError::validation_field("Temperature must be a finite number.", "temperature")
    })?;

    let settings = ResolvedAiSettings {
        api_key,
        base_url: state.base_url,
        model: state.model,
        max_tokens,
        temperature,
    };

    validate_provider_model_selection(&settings)?;

    Ok(settings)
}

pub(crate) fn normalize_ai_settings_input(
    input: SaveAiSettingsInput,
) -> Result<NormalizedAiSettingsInput, String> {
    let base_url = normalize_base_url(&input.base_url)?;
    let model = normalize_non_empty_text(&input.model, "Model")?;
    let max_tokens = input
        .max_tokens
        .trim()
        .parse::<i64>()
        .map_err(|_| "Max tokens must be a positive integer.".to_string())?;

    if max_tokens <= 0 {
        return Err("Max tokens must be a positive integer.".to_string());
    }

    let temperature = input
        .temperature
        .trim()
        .parse::<f64>()
        .map_err(|_| "Temperature must be a number between 0.0 and 2.0.".to_string())?;

    if !temperature.is_finite() || !(0.0..=2.0).contains(&temperature) {
        return Err("Temperature must be a number between 0.0 and 2.0.".to_string());
    }

    Ok(NormalizedAiSettingsInput {
        api_key: input.api_key.map(|value| value.trim().to_string()),
        base_url,
        model,
        max_tokens,
        temperature,
    })
}

pub(crate) fn normalize_generate_cards_input(
    input: GenerateCardsInput,
) -> Result<NormalizedGenerateCardsInput, String> {
    let topic = normalize_non_empty_text(&input.topic, "Topic")?;
    let count = match input.count {
        Some(value) if !(1..=30).contains(&value) => {
            return Err("Card count must be between 1 and 30.".to_string());
        }
        Some(value) => Some(value),
        None => None,
    };
    let difficulty = normalize_ai_difficulty(&input.difficulty)?;
    let style = normalize_ai_style(&input.style)?;

    Ok(NormalizedGenerateCardsInput {
        topic,
        count,
        difficulty,
        style,
    })
}

pub(crate) fn build_generate_cards_prompt(
    topic: &str,
    count: Option<i64>,
    difficulty: &str,
    style: &str,
) -> String {
    let request_line = match count {
        Some(value) => format!("Generate exactly {value} flashcards about \"{topic}\"."),
        None => format!(
            "Generate the smallest complete set of flashcards about \"{topic}\". Return between 6 and 20 cards."
        ),
    };

    format!(
        "{request_line}\n\nDifficulty: {}\nCard style: {}\n\nReturn only the JSON array.",
        ai_difficulty_description(difficulty),
        ai_style_description(style)
    )
}

pub(crate) async fn execute_ai_completion(
    settings: &ResolvedAiSettings,
    user_prompt: &str,
    system_prompt: Option<&str>,
) -> AppResult<String> {
    if settings.api_key.trim().is_empty() {
        return Err(AppError::validation_field(
            "Add an API key in Settings first.",
            "apiKey",
        ));
    }

    if is_anthropic_base_url(&settings.base_url) {
        execute_anthropic_completion(settings, user_prompt, system_prompt).await
    } else {
        execute_openai_compatible_completion(settings, user_prompt, system_prompt).await
    }
}

pub(crate) fn parse_generated_cards_response(
    response_text: &str,
) -> AppResult<Vec<GeneratedCardPayload>> {
    let candidate = extract_json_array_candidate(response_text);
    let payload: Value = serde_json::from_str(&candidate).map_err(|error| {
        AppError::ai_provider("Failed to parse AI JSON.", Some(error.to_string()))
    })?;
    let Some(items) = payload.as_array() else {
        return Err(AppError::ai_provider(
            "The AI response was not a JSON array.",
            None::<String>,
        ));
    };

    let cards = items
        .iter()
        .filter_map(|item| {
            let front = item.get("front")?.as_str()?.trim();
            let back = item.get("back")?.as_str()?.trim();

            if front.is_empty() || back.is_empty() {
                return None;
            }

            Some(GeneratedCardPayload {
                back: back.to_string(),
                front: front.to_string(),
            })
        })
        .collect::<Vec<_>>();

    if cards.is_empty() {
        return Err(AppError::ai_provider(
            "The AI response did not contain any valid cards.",
            None::<String>,
        ));
    }

    Ok(cards)
}

pub(crate) fn clear_ai_api_key(app: &AppHandle) -> AppResult<()> {
    #[cfg(target_os = "macos")]
    {
        let _ = app;
        clear_ai_api_key_macos()
    }

    #[cfg(not(target_os = "macos"))]
    with_stronghold_lock(app, || {
        let stronghold = open_stronghold(app)?;
        let client = stronghold
            .get_client(STRONGHOLD_CLIENT_NAME)
            .or_else(|_| stronghold.load_client(STRONGHOLD_CLIENT_NAME))
            .or_else(|_| stronghold.create_client(STRONGHOLD_CLIENT_NAME))
            .map_err(|error| AppError::storage_message(error.to_string()))?;
        let _ = client
            .store()
            .delete(STRONGHOLD_AI_API_KEY_RECORD_KEY)
            .map_err(|error| AppError::storage_message(error.to_string()))?;
        stronghold
            .save()
            .map_err(|error| AppError::storage_message(error.to_string()))?;

        Ok(())
    })
}

fn load_string_setting(
    connection: &Connection,
    key: &str,
    default: &str,
) -> rusqlite::Result<String> {
    connection
        .query_row("SELECT value FROM settings WHERE key = ?1", [key], |row| {
            row.get::<_, String>(0)
        })
        .or_else(|error| match error {
            rusqlite::Error::QueryReturnedNoRows => Ok(default.to_string()),
            other => Err(other),
        })
}

fn load_bool_setting(connection: &Connection, key: &str, default: bool) -> rusqlite::Result<bool> {
    let raw = load_string_setting(connection, key, if default { "1" } else { "0" })?;

    Ok(matches!(raw.as_str(), "1" | "true" | "yes"))
}

fn upsert_setting(
    transaction: &rusqlite::Transaction<'_>,
    key: &str,
    value: &str,
) -> rusqlite::Result<()> {
    transaction.execute(
        "
        INSERT INTO settings (key, value)
        VALUES (?1, ?2)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        ",
        params![key, value],
    )?;

    Ok(())
}

#[cfg_attr(target_os = "macos", allow(dead_code))]
fn stronghold_snapshot_path(app: &AppHandle) -> AppResult<PathBuf> {
    let path = app_data_dir(app)?.join(STRONGHOLD_SNAPSHOT_FILE_NAME);

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    Ok(path)
}

#[cfg_attr(target_os = "macos", allow(dead_code))]
fn stronghold_password(app: &AppHandle) -> AppResult<Vec<u8>> {
    let mut hasher = Sha256::new();
    hasher.update(b"pupil-stronghold-v1");
    hasher.update(app_data_dir(app)?.display().to_string().as_bytes());

    if let Ok(user) = std::env::var("USER").or_else(|_| std::env::var("USERNAME")) {
        hasher.update(user.as_bytes());
    }

    Ok(hasher.finalize().to_vec())
}

#[cfg_attr(target_os = "macos", allow(dead_code))]
fn open_stronghold(app: &AppHandle) -> AppResult<Stronghold> {
    let snapshot_path = stronghold_snapshot_path(app)?;
    let password = stronghold_password(app)?;

    Stronghold::new(snapshot_path, password)
        .map_err(|error| AppError::storage_message(error.to_string()))
}

fn load_ai_api_key(app: &AppHandle) -> AppResult<Option<String>> {
    #[cfg(target_os = "macos")]
    {
        let _ = app;
        load_ai_api_key_macos()
    }

    #[cfg(not(target_os = "macos"))]
    with_stronghold_lock(app, || {
        let stronghold = open_stronghold(app)?;
        let client = stronghold
            .get_client(STRONGHOLD_CLIENT_NAME)
            .or_else(|_| stronghold.load_client(STRONGHOLD_CLIENT_NAME))
            .or_else(|_| stronghold.create_client(STRONGHOLD_CLIENT_NAME))
            .map_err(|error| AppError::storage_message(error.to_string()))?;
        let value = client
            .store()
            .get(STRONGHOLD_AI_API_KEY_RECORD_KEY)
            .map_err(|error| AppError::storage_message(error.to_string()))?;

        value
            .map(String::from_utf8)
            .transpose()
            .map_err(|error| AppError::storage_message(error.to_string()))
    })
}

fn save_ai_api_key(app: &AppHandle, api_key: &str) -> AppResult<()> {
    #[cfg(target_os = "macos")]
    {
        let _ = app;
        save_ai_api_key_macos(api_key)
    }

    #[cfg(not(target_os = "macos"))]
    with_stronghold_lock(app, || {
        let stronghold = open_stronghold(app)?;
        let client = stronghold
            .get_client(STRONGHOLD_CLIENT_NAME)
            .or_else(|_| stronghold.load_client(STRONGHOLD_CLIENT_NAME))
            .or_else(|_| stronghold.create_client(STRONGHOLD_CLIENT_NAME))
            .map_err(|error| AppError::storage_message(error.to_string()))?;
        client
            .store()
            .insert(
                STRONGHOLD_AI_API_KEY_RECORD_KEY.to_vec(),
                api_key.as_bytes().to_vec(),
                None,
            )
            .map_err(|error| AppError::storage_message(error.to_string()))?;
        stronghold
            .save()
            .map_err(|error| AppError::storage_message(error.to_string()))?;

        Ok(())
    })
}

#[cfg_attr(target_os = "macos", allow(dead_code))]
fn with_stronghold_lock<T>(
    app: &AppHandle,
    operation: impl FnOnce() -> AppResult<T>,
) -> AppResult<T> {
    let state = app.state::<StrongholdState>();
    let _guard = state
        .lock
        .lock()
        .map_err(|_| std::io::Error::other("Stronghold access failed"))?;

    operation()
}

#[cfg(target_os = "macos")]
fn macos_keyring_entry() -> AppResult<keyring::Entry> {
    keyring::Entry::new(AI_SECRET_SERVICE_NAME, AI_SECRET_ACCOUNT_NAME)
        .map_err(|error| AppError::storage_message(error.to_string()))
}

#[cfg(target_os = "macos")]
fn load_ai_api_key_macos() -> AppResult<Option<String>> {
    match macos_keyring_entry()?.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(AppError::storage_message(error.to_string())),
    }
}

#[cfg(target_os = "macos")]
fn save_ai_api_key_macos(api_key: &str) -> AppResult<()> {
    let entry = macos_keyring_entry()?;
    entry
        .set_password(api_key)
        .map_err(|error| AppError::storage_message(error.to_string()))?;

    match entry.get_password() {
        Ok(saved_api_key) if saved_api_key == api_key => Ok(()),
        Ok(_) => Err(AppError::storage_message(
            "The API key could not be verified after saving it locally.",
        )),
        Err(error) => Err(AppError::storage_message(error.to_string())),
    }
}

#[cfg(target_os = "macos")]
fn clear_ai_api_key_macos() -> AppResult<()> {
    let entry = macos_keyring_entry()?;

    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(AppError::storage_message(error.to_string())),
    }
}

fn normalize_base_url(value: &str) -> Result<String, String> {
    let trimmed = value.trim().trim_end_matches('/');

    if trimmed.is_empty() {
        return Err("Base URL can't be empty.".to_string());
    }

    if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
        return Err("Base URL must start with http:// or https://.".to_string());
    }

    Ok(trimmed.to_string())
}

fn normalize_non_empty_text(value: &str, label: &str) -> Result<String, String> {
    let trimmed = value.trim();

    if trimmed.is_empty() {
        return Err(format!("{label} can't be empty."));
    }

    Ok(trimmed.to_string())
}

fn normalize_ai_difficulty(value: &str) -> Result<String, String> {
    match value.trim() {
        "Beginner" | "Intermediate" | "Advanced" => Ok(value.trim().to_string()),
        _ => Err("Difficulty must be Beginner, Intermediate, or Advanced.".to_string()),
    }
}

fn normalize_ai_style(value: &str) -> Result<String, String> {
    match value.trim() {
        "Concept" | "Q&A" | "Cloze" => Ok(value.trim().to_string()),
        _ => Err("Style must be Concept, Q&A, or Cloze.".to_string()),
    }
}

fn trim_trailing_zeroes(value: f64) -> String {
    let mut text = format!("{value:.2}");

    while text.contains('.') && text.ends_with('0') {
        text.pop();
    }

    if text.ends_with('.') {
        text.pop();
    }

    text
}

fn ai_difficulty_description(value: &str) -> &'static str {
    match value {
        "Beginner" => {
            "Introductory - assume no prior knowledge. Use simple language and cover the most essential concepts."
        }
        "Advanced" => {
            "Expert level. Include edge cases, trade-offs, subtle distinctions, and deep technical detail."
        }
        _ => {
            "Assumes basic familiarity. Include nuance, important details, and connections between concepts."
        }
    }
}

fn ai_style_description(value: &str) -> &'static str {
    match value {
        "Concept" => {
            "Concept definition cards: front = concept name or term, back = clear definition with enough context to be unambiguous."
        }
        "Cloze" => {
            "Cloze deletion cards: front = a sentence with ___ replacing the key term, back = the missing term with a one-sentence explanation."
        }
        _ => {
            "Question and answer cards: front = a precise question targeting one fact, back = a concise direct answer."
        }
    }
}

fn is_anthropic_base_url(base_url: &str) -> bool {
    base_url.contains("anthropic.com")
}

fn is_official_openai_base_url(base_url: &str) -> bool {
    base_url.contains("api.openai.com")
}

fn validate_provider_model_selection(settings: &ResolvedAiSettings) -> AppResult<()> {
    let model = settings.model.trim().to_ascii_lowercase();

    if is_anthropic_base_url(&settings.base_url) && model.starts_with("gpt-") {
        return Err(AppError::validation_field(
            "This base URL points to Anthropic, but the model looks like OpenAI (`gpt-...`). Pick a Claude model or switch the base URL to https://api.openai.com/v1.",
            "model",
        ));
    }

    if is_official_openai_base_url(&settings.base_url) && model.starts_with("claude-") {
        return Err(AppError::validation_field(
            "This base URL points to OpenAI, but the model looks like Anthropic (`claude-...`). Pick an OpenAI model or switch the base URL to https://api.anthropic.com/v1.",
            "model",
        ));
    }

    Ok(())
}

async fn execute_openai_compatible_completion(
    settings: &ResolvedAiSettings,
    user_prompt: &str,
    system_prompt: Option<&str>,
) -> AppResult<String> {
    let endpoint = format!(
        "{}/chat/completions",
        settings.base_url.trim_end_matches('/')
    );
    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {}", settings.api_key)).map_err(|_| {
            AppError::validation_field("The API key contains invalid header characters.", "apiKey")
        })?,
    );

    let mut messages = Vec::new();
    if let Some(system_prompt) = system_prompt {
        messages.push(serde_json::json!({ "role": "system", "content": system_prompt }));
    }
    messages.push(serde_json::json!({ "role": "user", "content": user_prompt }));

    let response = reqwest::Client::new()
        .post(&endpoint)
        .headers(headers)
        .json(&serde_json::json!({
            "model": settings.model,
            "messages": messages,
            "max_tokens": settings.max_tokens,
            "temperature": settings.temperature
        }))
        .send()
        .await
        .map_err(|error| {
            AppError::ai_provider(
                format!(
                    "Failed to reach the AI provider at {endpoint} with model {}.",
                    settings.model
                ),
                Some(error.to_string()),
            )
        })?;
    let status = response.status();
    let body = response.text().await.map_err(|error| {
        AppError::ai_provider(
            format!("Failed to read the AI provider response from {endpoint}."),
            Some(error.to_string()),
        )
    })?;

    if !status.is_success() {
        return Err(AppError::ai_provider(
            "The AI provider rejected the request.",
            Some(format_provider_error(
                &endpoint,
                &settings.model,
                status.as_u16(),
                &body,
            )),
        ));
    }

    let payload: Value = serde_json::from_str(&body).map_err(|error| {
        AppError::ai_provider("Invalid provider JSON.", Some(error.to_string()))
    })?;
    let content = &payload["choices"][0]["message"]["content"];

    extract_text_content(content).ok_or_else(|| {
        AppError::ai_provider("The provider returned no message content.", None::<String>)
    })
}

async fn execute_anthropic_completion(
    settings: &ResolvedAiSettings,
    user_prompt: &str,
    system_prompt: Option<&str>,
) -> AppResult<String> {
    let endpoint = format!("{}/messages", settings.base_url.trim_end_matches('/'));
    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    headers.insert(
        "x-api-key",
        HeaderValue::from_str(&settings.api_key).map_err(|_| {
            AppError::validation_field("The API key contains invalid header characters.", "apiKey")
        })?,
    );
    headers.insert("anthropic-version", HeaderValue::from_static("2023-06-01"));

    let response = reqwest::Client::new()
        .post(&endpoint)
        .headers(headers)
        .json(&serde_json::json!({
            "model": settings.model,
            "max_tokens": settings.max_tokens,
            "temperature": settings.temperature,
            "system": system_prompt.unwrap_or_default(),
            "messages": [{ "role": "user", "content": user_prompt }]
        }))
        .send()
        .await
        .map_err(|error| {
            AppError::ai_provider(
                format!(
                    "Failed to reach the AI provider at {endpoint} with model {}.",
                    settings.model
                ),
                Some(error.to_string()),
            )
        })?;
    let status = response.status();
    let body = response.text().await.map_err(|error| {
        AppError::ai_provider(
            format!("Failed to read the AI provider response from {endpoint}."),
            Some(error.to_string()),
        )
    })?;

    if !status.is_success() {
        return Err(AppError::ai_provider(
            "The AI provider rejected the request.",
            Some(format_provider_error(
                &endpoint,
                &settings.model,
                status.as_u16(),
                &body,
            )),
        ));
    }

    let payload: Value = serde_json::from_str(&body).map_err(|error| {
        AppError::ai_provider("Invalid provider JSON.", Some(error.to_string()))
    })?;
    let content = payload["content"].as_array().ok_or_else(|| {
        AppError::ai_provider("The provider returned no content array.", None::<String>)
    })?;
    let mut text = String::new();

    for part in content {
        if part["type"].as_str() == Some("text") {
            if let Some(part_text) = part["text"].as_str() {
                text.push_str(part_text);
            }
        }
    }

    if text.trim().is_empty() {
        return Err(AppError::ai_provider(
            "The provider returned no text content.",
            None::<String>,
        ));
    }

    Ok(text)
}

fn extract_text_content(value: &Value) -> Option<String> {
    if let Some(text) = value.as_str() {
        return Some(text.to_string());
    }

    value.as_array().map(|parts| {
        parts
            .iter()
            .filter_map(|part| {
                part.get("text")
                    .and_then(Value::as_str)
                    .or_else(|| part.get("content").and_then(Value::as_str))
            })
            .collect::<String>()
    })
}

fn format_provider_error(endpoint: &str, model: &str, status_code: u16, body: &str) -> String {
    let detail = extract_provider_error_detail(body);

    if detail.is_empty() {
        format!("The AI provider at {endpoint} rejected model {model} with HTTP {status_code}.")
    } else {
        format!(
            "The AI provider at {endpoint} rejected model {model} with HTTP {status_code}: {detail}"
        )
    }
}

fn extract_provider_error_detail(body: &str) -> String {
    let trimmed = body.trim();

    if trimmed.is_empty() {
        return String::new();
    }

    if let Ok(payload) = serde_json::from_str::<Value>(trimmed) {
        let message = payload
            .pointer("/error/message")
            .and_then(Value::as_str)
            .or_else(|| payload.pointer("/message").and_then(Value::as_str))
            .or_else(|| payload.pointer("/error").and_then(Value::as_str));

        if let Some(message) = message {
            return truncate_message_detail(message);
        }
    }

    truncate_message_detail(trimmed)
}

fn truncate_message_detail(detail: &str) -> String {
    let collapsed = detail.split_whitespace().collect::<Vec<_>>().join(" ");
    let mut chars = collapsed.chars();
    let truncated = chars.by_ref().take(240).collect::<String>();

    if chars.next().is_some() {
        format!("{truncated}…")
    } else {
        truncated
    }
}

fn extract_json_array_candidate(response_text: &str) -> String {
    let trimmed = response_text.trim();
    let unfenced = if trimmed.starts_with("```") {
        let mut lines = trimmed.lines();
        let _ = lines.next();
        let body = lines.collect::<Vec<_>>().join("\n");

        if let Some(index) = body.rfind("```") {
            body[..index].trim().to_string()
        } else {
            body.trim().to_string()
        }
    } else {
        trimmed.to_string()
    };

    let first_bracket = unfenced.find('[');
    let last_bracket = unfenced.rfind(']');

    match (first_bracket, last_bracket) {
        (Some(start), Some(end)) if start <= end => unfenced[start..=end].to_string(),
        _ => unfenced,
    }
}
