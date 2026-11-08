use std::path::PathBuf;

use rusqlite::Connection;
use tauri::{AppHandle, Manager};

use super::chatgpt::CHATGPT_PROVIDER;
use super::chatgpt_session::ChatgptStatus;
use super::claude_code::{discover_binary, ClaudeCodeTarget, DiscoveryEnv};
use super::connection::{AiConnectionKind, ResolvedAiTarget};
use super::secrets::{clear_ai_api_key, load_ai_api_key, save_ai_api_key};
use super::settings_store::{load_bool_setting, load_string_setting, upsert_setting_on};
use super::validation::{
    normalize_ai_settings_input as normalize_input, trim_trailing_zeroes,
    validate_provider_model_selection,
};
use crate::constants::{
    AI_SETTING_BASE_URL_KEY, AI_SETTING_CHATGPT_EMAIL_KEY, AI_SETTING_CHATGPT_MODEL_KEY,
    AI_SETTING_CHATGPT_PLAN_USAGE_KEY, AI_SETTING_CHATGPT_STATUS_KEY,
    AI_SETTING_CLAUDE_CODE_MODEL_KEY, AI_SETTING_CLAUDE_CODE_PATH_KEY,
    AI_SETTING_CLAUDE_CODE_READY_KEY, AI_SETTING_CONNECTION_KEY, AI_SETTING_EXPLAIN_ENABLED_KEY,
    AI_SETTING_HAS_API_KEY_KEY, AI_SETTING_MAX_TOKENS_KEY, AI_SETTING_MODEL_KEY,
    AI_SETTING_TEMPERATURE_KEY, DEFAULT_AI_BASE_URL, DEFAULT_AI_MAX_TOKENS, DEFAULT_AI_MODEL,
    DEFAULT_AI_TEMPERATURE, DEFAULT_CHATGPT_MODEL, DEFAULT_CLAUDE_CODE_MODEL,
};
use crate::error::{AiConnectionReason, AppError, AppResult};
use crate::types::{
    AiSettingsState, ChatgptSettingsState, ClaudeCodeSettingsState, NormalizedAiSettingsInput,
    ResolvedAiSettings, SaveAiSettingsInput,
};

pub(crate) fn load_ai_settings_state(
    _app: &AppHandle,
    connection: &Connection,
) -> AppResult<AiSettingsState> {
    load_ai_settings_rows(connection)
}

/// Reads every non-secret AI setting. Missing rows take the defaults an
/// install had before subscriptions existed, so old databases read as an API
/// key connection.
pub(crate) fn load_ai_settings_rows(connection: &Connection) -> AppResult<AiSettingsState> {
    let kind = AiConnectionKind::from_db(&load_string_setting(
        connection,
        AI_SETTING_CONNECTION_KEY,
        AiConnectionKind::ApiKey.as_db(),
    )?);
    let has_api_key = load_bool_setting(connection, AI_SETTING_HAS_API_KEY_KEY, false)?;
    let chatgpt = ChatgptSettingsState {
        status: ChatgptStatus::parse(&load_string_setting(
            connection,
            AI_SETTING_CHATGPT_STATUS_KEY,
            "",
        )?)
        .as_str()
        .to_string(),
        email: Some(load_string_setting(
            connection,
            AI_SETTING_CHATGPT_EMAIL_KEY,
            "",
        )?)
        .filter(|email| !email.is_empty()),
        plan_usage: load_bool_setting(connection, AI_SETTING_CHATGPT_PLAN_USAGE_KEY, false)?,
        model: load_string_setting(
            connection,
            AI_SETTING_CHATGPT_MODEL_KEY,
            DEFAULT_CHATGPT_MODEL,
        )?,
    };
    let claude_code = ClaudeCodeSettingsState {
        model: load_string_setting(
            connection,
            AI_SETTING_CLAUDE_CODE_MODEL_KEY,
            DEFAULT_CLAUDE_CODE_MODEL,
        )?,
        path: load_string_setting(connection, AI_SETTING_CLAUDE_CODE_PATH_KEY, "")?,
        ready: load_bool_setting(connection, AI_SETTING_CLAUDE_CODE_READY_KEY, false)?,
    };
    let ai_ready = match kind {
        AiConnectionKind::ApiKey => has_api_key,
        AiConnectionKind::Chatgpt => chatgpt.status == "connected" && chatgpt.plan_usage,
        AiConnectionKind::ClaudeCode => claude_code.ready,
    };

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
        has_api_key,
        explain_enabled: load_bool_setting(connection, AI_SETTING_EXPLAIN_ENABLED_KEY, true)?,
        connection: kind,
        chatgpt,
        claude_code,
        ai_ready,
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

    match input.api_key.as_deref() {
        Some("") => clear_ai_api_key(app)?,
        Some(api_key) => save_ai_api_key(app, api_key)?,
        None => {}
    }

    persist_ai_settings_rows(connection, &input, next_has_api_key)
}

/// Writes the non-secret settings in one transaction.
pub(crate) fn persist_ai_settings_rows(
    connection: &mut Connection,
    input: &NormalizedAiSettingsInput,
    has_api_key: bool,
) -> AppResult<AiSettingsState> {
    let previous_path = load_string_setting(connection, AI_SETTING_CLAUDE_CODE_PATH_KEY, "")?;
    let transaction = connection.transaction()?;
    upsert_setting_on(&transaction, AI_SETTING_BASE_URL_KEY, &input.base_url)?;
    upsert_setting_on(&transaction, AI_SETTING_MODEL_KEY, &input.model)?;
    upsert_setting_on(
        &transaction,
        AI_SETTING_MAX_TOKENS_KEY,
        &input.max_tokens.to_string(),
    )?;
    upsert_setting_on(
        &transaction,
        AI_SETTING_TEMPERATURE_KEY,
        &trim_trailing_zeroes(input.temperature),
    )?;
    upsert_setting_on(
        &transaction,
        AI_SETTING_HAS_API_KEY_KEY,
        if has_api_key { "1" } else { "0" },
    )?;
    if let Some(explain_enabled) = input.explain_enabled {
        upsert_setting_on(
            &transaction,
            AI_SETTING_EXPLAIN_ENABLED_KEY,
            if explain_enabled { "1" } else { "0" },
        )?;
    }
    if let Some(kind) = input.connection {
        upsert_setting_on(&transaction, AI_SETTING_CONNECTION_KEY, kind.as_db())?;
    }
    if let Some(model) = &input.chatgpt_model {
        upsert_setting_on(&transaction, AI_SETTING_CHATGPT_MODEL_KEY, model)?;
    }
    if let Some(model) = &input.claude_code_model {
        upsert_setting_on(&transaction, AI_SETTING_CLAUDE_CODE_MODEL_KEY, model)?;
    }
    if let Some(path) = &input.claude_code_path {
        upsert_setting_on(&transaction, AI_SETTING_CLAUDE_CODE_PATH_KEY, path)?;
        if path != &previous_path {
            // A different binary has to pass its own status check.
            upsert_setting_on(&transaction, AI_SETTING_CLAUDE_CODE_READY_KEY, "0")?;
        }
    }
    transaction.commit()?;

    load_ai_settings_rows(connection)
}

pub(crate) fn record_claude_code_ready(connection: &Connection, ready: bool) -> AppResult<()> {
    upsert_setting_on(
        connection,
        AI_SETTING_CLAUDE_CODE_READY_KEY,
        if ready { "1" } else { "0" },
    )?;
    Ok(())
}

/// Everything needed to pick a transport, from saved settings or a draft.
pub(crate) struct AiDraft {
    pub(crate) connection: AiConnectionKind,
    pub(crate) base_url: String,
    pub(crate) model: String,
    pub(crate) max_tokens: i64,
    pub(crate) temperature: f64,
    /// `Some` when the caller supplied a key; otherwise the saved key is used.
    pub(crate) api_key: Option<String>,
    pub(crate) chatgpt: ChatgptSettingsState,
    pub(crate) claude_code_model: String,
    pub(crate) claude_code_path: String,
}

impl AiDraft {
    pub(crate) fn from_state(state: AiSettingsState) -> AppResult<Self> {
        let max_tokens = state.max_tokens.parse::<i64>().map_err(|_| {
            AppError::validation_field("Max tokens must be a positive integer.", "maxTokens")
        })?;
        let temperature = state.temperature.parse::<f64>().map_err(|_| {
            AppError::validation_field("Temperature must be a finite number.", "temperature")
        })?;
        Ok(Self {
            connection: state.connection,
            base_url: state.base_url,
            model: state.model,
            max_tokens,
            temperature,
            api_key: None,
            chatgpt: state.chatgpt,
            claude_code_model: state.claude_code.model,
            claude_code_path: state.claude_code.path,
        })
    }

    /// Overlays a not-yet-saved settings form on the saved state.
    pub(crate) fn from_input(saved: AiSettingsState, input: NormalizedAiSettingsInput) -> Self {
        Self {
            connection: input.connection.unwrap_or(saved.connection),
            base_url: input.base_url,
            model: input.model,
            max_tokens: input.max_tokens,
            temperature: input.temperature,
            api_key: input.api_key,
            chatgpt: ChatgptSettingsState {
                model: input.chatgpt_model.unwrap_or(saved.chatgpt.model.clone()),
                ..saved.chatgpt
            },
            claude_code_model: input.claude_code_model.unwrap_or(saved.claude_code.model),
            claude_code_path: input.claude_code_path.unwrap_or(saved.claude_code.path),
        }
    }
}

/// Picks the transport for a draft. Each connection kind only ever resolves
/// to its own transport: a missing subscription is an error, never a quiet
/// switch to the saved API key.
pub(crate) fn resolve_ai_target(
    draft: AiDraft,
    load_saved_api_key: impl FnOnce() -> AppResult<Option<String>>,
    discovery_env: &DiscoveryEnv,
    workdir: PathBuf,
) -> AppResult<ResolvedAiTarget> {
    match draft.connection {
        AiConnectionKind::ApiKey => {
            let api_key = match draft.api_key {
                Some(api_key) if api_key.is_empty() => None,
                Some(api_key) => Some(api_key),
                None => load_saved_api_key()?,
            }
            .ok_or_else(|| {
                AppError::validation_field("Add an API key in Settings first.", "apiKey")
            })?;
            let settings = ResolvedAiSettings {
                api_key,
                base_url: draft.base_url,
                model: draft.model,
                max_tokens: draft.max_tokens,
                temperature: draft.temperature,
            };
            validate_provider_model_selection(&settings)?;
            Ok(ResolvedAiTarget::Api(settings))
        }
        AiConnectionKind::Chatgpt => {
            match (
                ChatgptStatus::parse(&draft.chatgpt.status),
                draft.chatgpt.plan_usage,
            ) {
                (ChatgptStatus::Connected, true) => Ok(ResolvedAiTarget::Chatgpt {
                    model: draft.chatgpt.model,
                }),
                (ChatgptStatus::Connected, false) => Err(AppError::ai_connection(
                    CHATGPT_PROVIDER,
                    AiConnectionReason::Declined,
                    "ChatGPT plan usage wasn't allowed when you signed in. Reconnect and allow it, or use an API key.",
                )),
                (ChatgptStatus::Expired, _) => Err(AppError::ai_connection(
                    CHATGPT_PROVIDER,
                    AiConnectionReason::Expired,
                    "Your ChatGPT connection has ended. Reconnect in Settings to keep using your plan.",
                )),
                (ChatgptStatus::Disconnected, _) => Err(AppError::ai_connection(
                    CHATGPT_PROVIDER,
                    AiConnectionReason::SignedOut,
                    "Connect your ChatGPT account in Settings first.",
                )),
            }
        }
        AiConnectionKind::ClaudeCode => {
            let binary = discover_binary(Some(&draft.claude_code_path), discovery_env)?;
            Ok(ResolvedAiTarget::ClaudeCode(ClaudeCodeTarget {
                binary,
                model: draft.claude_code_model,
                max_tokens: draft.max_tokens,
                workdir,
            }))
        }
    }
}

/// An empty folder Claude Code runs in, so it never picks up a project's
/// CLAUDE.md or settings from wherever Pupil was launched.
pub(crate) fn claude_code_workdir(app: &AppHandle) -> AppResult<PathBuf> {
    let dir = app
        .path()
        .app_cache_dir()
        .map_err(|error| AppError::internal_message(error.to_string()))?
        .join("claude-code");
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

pub(crate) fn resolve_ai_target_for_test(
    app: &AppHandle,
    connection: &Connection,
    input: NormalizedAiSettingsInput,
) -> AppResult<ResolvedAiTarget> {
    let saved = load_ai_settings_rows(connection)?;
    resolve_ai_target(
        AiDraft::from_input(saved, input),
        || load_ai_api_key(app),
        &DiscoveryEnv::from_process(),
        claude_code_workdir(app)?,
    )
}

pub(crate) fn load_resolved_ai_target(
    app: &AppHandle,
    connection: &Connection,
) -> AppResult<ResolvedAiTarget> {
    let state = load_ai_settings_rows(connection)?;
    resolve_ai_target(
        AiDraft::from_state(state)?,
        || load_ai_api_key(app),
        &DiscoveryEnv::from_process(),
        claude_code_workdir(app)?,
    )
}

pub(crate) fn normalize_ai_settings_input(
    input: SaveAiSettingsInput,
) -> Result<NormalizedAiSettingsInput, String> {
    normalize_input(input)
}
