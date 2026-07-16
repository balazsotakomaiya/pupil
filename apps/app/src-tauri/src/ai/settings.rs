use rusqlite::{params, Connection};
use tauri::AppHandle;

use super::secrets::{clear_ai_api_key, load_ai_api_key, save_ai_api_key};
use super::validation::{
    normalize_ai_settings_input as normalize_input, trim_trailing_zeroes,
    validate_provider_model_selection,
};
use crate::constants::{
    AI_SETTING_BASE_URL_KEY, AI_SETTING_EXPLAIN_ENABLED_KEY, AI_SETTING_HAS_API_KEY_KEY,
    AI_SETTING_MAX_TOKENS_KEY, AI_SETTING_MODEL_KEY, AI_SETTING_TEMPERATURE_KEY,
    DEFAULT_AI_BASE_URL, DEFAULT_AI_MAX_TOKENS, DEFAULT_AI_MODEL, DEFAULT_AI_TEMPERATURE,
};
use crate::error::{AppError, AppResult};
use crate::types::{
    AiSettingsState, NormalizedAiSettingsInput, ResolvedAiSettings, SaveAiSettingsInput,
};

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
        explain_enabled: load_bool_setting(connection, AI_SETTING_EXPLAIN_ENABLED_KEY, true)?,
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
    if let Some(explain_enabled) = input.explain_enabled {
        upsert_setting(
            &transaction,
            AI_SETTING_EXPLAIN_ENABLED_KEY,
            if explain_enabled { "1" } else { "0" },
        )?;
    }
    transaction.commit()?;

    load_ai_settings_state(app, connection)
}

pub(crate) fn resolve_ai_settings_for_test(
    app: &AppHandle,
    _connection: &Connection,
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
    normalize_input(input)
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
        "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}
