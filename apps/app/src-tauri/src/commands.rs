use std::fs;

use tauri::{AppHandle, Manager};

use std::sync::Arc;
use std::time::Duration;

use tauri_plugin_opener::OpenerExt;

use crate::ai::{
    build_explain_card_prompt, build_explain_prose_fallback_prompt, build_explain_repair_prompt,
    build_generate_cards_prompt, claude_code_workdir, disconnect_chatgpt, execute_ai_target,
    execute_explain_completion_with_retries, fetch_model_catalog, list_chatgpt_models,
    load_ai_settings_state, load_resolved_ai_target, load_sign_in_inputs,
    normalize_ai_settings_input, normalize_generate_cards_input, parse_explain_card_response,
    parse_generated_cards_response, probe_claude_code_status, record_chatgpt_status,
    record_claude_code_ready, record_sign_in, resolve_ai_target_for_test,
    resolve_model_catalog_credentials, run_chatgpt_sign_in, save_ai_settings_rows, sign_in_control,
    AiExecution, AiModelCatalog, AiRequestRegistry, ChatgptEndpoints, ChatgptModel, ChatgptStatus,
    ClaudeCodeStatus, ListAiModelsInput, ResolvedAiTarget, SecureCredentialStore, CHATGPT_PROVIDER,
};
use crate::analytics::{list_space_stats_rows, load_dashboard_stats};
use crate::app::{
    app_data_dir, database_path, open_app_connection, open_connection, BootstrapStatus,
};
use crate::cards::{
    create_card_row, delete_card_row, fetch_card_explanation_source, list_card_summaries,
    review_card_row, save_card_explanation, suspend_card_row, undo_review_card_row,
    update_card_row,
};
use crate::constants::CHATGPT_SIGN_IN_TIMEOUT_SECS;
use crate::constants::{
    AI_SYSTEM_PROMPT, FRONTEND_LOG_MAX_CONTEXT_CHARS, FRONTEND_LOG_MAX_MESSAGE_CHARS,
};
use crate::error::AiConnectionReason;
use crate::error::{AppError, AppResult};
use crate::imports::import_anki_cards_row;
use crate::migration_runner::{
    ensure_schema_migrations_table, load_applied_migrations, pending_migration_ids,
};
use crate::migrations::MIGRATIONS;
use crate::normalize::{
    normalize_card_input, normalize_card_update_input, normalize_import_anki_input,
    normalize_review_card_input, normalize_space_name, normalize_undo_review_card_input,
};
use crate::settings::{
    export_dir, load_new_cards_limit, load_recent_activity, load_settings_data_summary,
    load_today_new_card_count, reset_all_data_rows, save_new_cards_limit, write_review_logs_csv,
};
use crate::spaces::{create_space_row, delete_space_row, list_space_summaries, rename_space_row};
use crate::study_queue::load_study_queue_snapshot;
use crate::tray;
use crate::types::{
    AiConnectionTestResult, AiSettingsState, BootstrapState, CardSummary, ChatgptDisconnectResult,
    CreateCardInput, DashboardStats, ExplainCardInput, ExplainCardPayload, ExplainCardResult,
    ExportDataResult, FrontendLogInput, GenerateCardsInput, GeneratedCardPayload, ImportAnkiInput,
    ImportAnkiResult, RecentActivityEntry, ReviewCardInput, SaveAiSettingsInput,
    SettingsDataSummary, SpaceStats, SpaceSummary, StudyQueueSnapshot, StudySettingsState,
    SuspendCardInput, UndoReviewCardInput, UpdateCardInput,
};
use crate::util::{now_ms, truncate_chars};

async fn run_blocking<T: Send + 'static>(
    operation: impl FnOnce() -> AppResult<T> + Send + 'static,
) -> AppResult<T> {
    tauri::async_runtime::spawn_blocking(operation)
        .await
        .map_err(|error| AppError::internal_message(error.to_string()))?
}

#[tauri::command]
#[tracing::instrument(skip(app))]
pub(crate) fn get_bootstrap_state(app: AppHandle) -> Result<BootstrapState, AppError> {
    let app_data_dir = app_data_dir(&app)?;
    let database_path = database_path(&app)?;
    let bootstrap_status = app.state::<BootstrapStatus>();

    let connection = open_connection(&database_path)?;
    ensure_schema_migrations_table(&connection)?;
    let applied_migrations = load_applied_migrations(&connection)?;
    let pending_migrations = pending_migration_ids(MIGRATIONS, &applied_migrations);

    Ok(BootstrapState {
        app_data_dir: app_data_dir.display().to_string(),
        database_path: database_path.display().to_string(),
        applied_migrations,
        pending_migrations,
        backup_created: bootstrap_status.backup_created,
    })
}

#[tauri::command]
#[tracing::instrument(skip(app))]
pub(crate) fn list_spaces(app: AppHandle) -> Result<Vec<SpaceSummary>, AppError> {
    let connection = open_app_connection(&app)?;

    list_space_summaries(&connection).map_err(AppError::from)
}

#[tauri::command]
#[tracing::instrument(skip(app), fields(name))]
pub(crate) fn create_space(app: AppHandle, name: String) -> Result<SpaceSummary, AppError> {
    let normalized_name = normalize_space_name(&name).map_err(AppError::validation)?;
    let connection = open_app_connection(&app)?;

    create_space_row(&connection, &normalized_name).map_err(AppError::from_space_storage)
}

#[tauri::command]
#[tracing::instrument(skip(app), fields(id))]
pub(crate) fn rename_space(
    app: AppHandle,
    id: String,
    name: String,
) -> Result<SpaceSummary, AppError> {
    let normalized_name = normalize_space_name(&name).map_err(AppError::validation)?;
    let connection = open_app_connection(&app)?;

    rename_space_row(&connection, &id, &normalized_name).map_err(AppError::from_space_storage)
}

#[tauri::command]
#[tracing::instrument(skip(app), fields(id))]
pub(crate) fn delete_space(app: AppHandle, id: String) -> Result<(), AppError> {
    let connection = open_app_connection(&app)?;

    delete_space_row(&connection, &id).map_err(AppError::from_space_storage)
}

#[tauri::command]
#[tracing::instrument(skip(app), fields(space_id = ?space_id))]
pub(crate) fn list_cards(
    app: AppHandle,
    space_id: Option<String>,
) -> Result<Vec<CardSummary>, AppError> {
    let connection = open_app_connection(&app)?;

    list_card_summaries(&connection, space_id.as_deref()).map_err(AppError::from_card_storage)
}

#[tauri::command]
#[tracing::instrument(skip(app, input), fields(space_id = %input.space_id))]
pub(crate) fn create_card(app: AppHandle, input: CreateCardInput) -> Result<CardSummary, AppError> {
    let mut connection = open_app_connection(&app)?;
    let normalized = normalize_card_input(
        &input.space_id,
        &input.front,
        &input.back,
        &input.tags,
        input.source.as_deref(),
    )
    .map_err(AppError::validation)?;

    create_card_row(&mut connection, normalized).map_err(AppError::from_card_storage)
}

#[tauri::command]
#[tracing::instrument(skip(app, input), fields(id = %input.id, space_id = %input.space_id))]
pub(crate) fn update_card(app: AppHandle, input: UpdateCardInput) -> Result<CardSummary, AppError> {
    let mut connection = open_app_connection(&app)?;
    let normalized = normalize_card_update_input(&input).map_err(AppError::validation)?;

    update_card_row(&mut connection, normalized).map_err(AppError::from_card_storage)
}

#[tauri::command]
#[tracing::instrument(skip(app), fields(id))]
pub(crate) fn delete_card(app: AppHandle, id: String) -> Result<(), AppError> {
    let mut connection = open_app_connection(&app)?;

    delete_card_row(&mut connection, &id).map_err(AppError::from_card_storage)
}

#[tauri::command]
#[tracing::instrument(skip(app, input), fields(id = %input.id))]
pub(crate) fn suspend_card(
    app: AppHandle,
    input: SuspendCardInput,
) -> Result<CardSummary, AppError> {
    let mut connection = open_app_connection(&app)?;

    suspend_card_row(&mut connection, &input.id, input.suspended)
        .map_err(AppError::from_card_storage)
}

#[tauri::command]
#[tracing::instrument(skip(app, input), fields(id = %input.id, grade = input.grade))]
pub(crate) fn review_card(app: AppHandle, input: ReviewCardInput) -> Result<CardSummary, AppError> {
    let mut connection = open_app_connection(&app)?;
    let normalized = normalize_review_card_input(&input).map_err(AppError::validation)?;

    review_card_row(&mut connection, normalized).map_err(AppError::from_card_storage)
}

#[tauri::command]
#[tracing::instrument(skip(app, input), fields(id = %input.id))]
pub(crate) fn undo_review_card(
    app: AppHandle,
    input: UndoReviewCardInput,
) -> Result<CardSummary, AppError> {
    let mut connection = open_app_connection(&app)?;
    let normalized = normalize_undo_review_card_input(&input).map_err(AppError::validation)?;

    undo_review_card_row(&mut connection, normalized).map_err(AppError::from_card_storage)
}

#[tauri::command]
#[tracing::instrument(skip(app, input), fields(source_file_name = %input.source_file_name))]
pub(crate) fn import_anki_cards(
    app: AppHandle,
    input: ImportAnkiInput,
) -> Result<ImportAnkiResult, AppError> {
    let mut connection = open_app_connection(&app)?;
    let normalized_input = normalize_import_anki_input(&input).map_err(AppError::validation)?;

    import_anki_cards_row(&mut connection, &input.source_file_name, normalized_input)
        .map_err(AppError::from_card_storage)
}

#[tauri::command]
#[tracing::instrument(skip(app))]
pub(crate) fn get_dashboard_stats(app: AppHandle) -> Result<DashboardStats, AppError> {
    let connection = open_app_connection(&app)?;
    let now = now_ms();

    load_dashboard_stats(&connection, now).map_err(AppError::from)
}

#[tauri::command]
#[tracing::instrument(skip(app))]
pub(crate) fn get_study_queue_snapshot(app: AppHandle) -> Result<StudyQueueSnapshot, AppError> {
    let connection = open_app_connection(&app)?;
    let now = now_ms();
    let new_cards_limit = load_new_cards_limit(&connection)?;
    let new_cards_today = load_today_new_card_count(&connection)?;

    load_study_queue_snapshot(&connection, now, new_cards_limit, new_cards_today)
        .map_err(AppError::from)
}

#[tauri::command]
#[tracing::instrument(skip(app))]
pub(crate) fn list_space_stats(app: AppHandle) -> Result<Vec<SpaceStats>, AppError> {
    let connection = open_app_connection(&app)?;
    let now = now_ms();

    list_space_stats_rows(&connection, now).map_err(AppError::from)
}

#[tauri::command]
#[tracing::instrument(skip(app))]
pub(crate) async fn get_ai_settings(app: AppHandle) -> Result<AiSettingsState, AppError> {
    run_blocking(move || {
        let connection = open_app_connection(&app)?;
        load_ai_settings_state(&app, &connection)
    })
    .await
}

#[tauri::command]
#[tracing::instrument(skip(app, input))]
pub(crate) async fn save_ai_settings(
    app: AppHandle,
    input: SaveAiSettingsInput,
) -> Result<AiSettingsState, AppError> {
    let normalized = normalize_ai_settings_input(input).map_err(AppError::validation)?;

    run_blocking(move || {
        let mut connection = open_app_connection(&app)?;

        save_ai_settings_rows(&app, &mut connection, normalized)
    })
    .await
}

#[tauri::command]
#[tracing::instrument(skip(app, input))]
pub(crate) async fn list_ai_models(
    app: AppHandle,
    input: ListAiModelsInput,
) -> AppResult<AiModelCatalog> {
    let (base_url, api_key) = run_blocking(move || {
        let connection = open_app_connection(&app)?;
        resolve_model_catalog_credentials(&app, &connection, input)
    })
    .await?;
    fetch_model_catalog(&base_url, api_key.as_deref()).await
}

fn ai_registry(app: &AppHandle) -> Arc<AiRequestRegistry> {
    Arc::clone(app.state::<Arc<AiRequestRegistry>>().inner())
}

/// Keeps the saved ChatGPT status honest when a request finds the session
/// has ended, so Settings and the AI gates offer Reconnect.
async fn note_ai_failure(app: &AppHandle, error: &AppError) {
    if let AppError::AiConnection {
        reason: AiConnectionReason::Expired,
        provider,
        ..
    } = error
    {
        if provider == CHATGPT_PROVIDER {
            let app = app.clone();
            let _ = run_blocking(move || {
                let connection = open_app_connection(&app)?;
                record_chatgpt_status(&connection, ChatgptStatus::Expired)
            })
            .await;
        }
    }
}

#[tauri::command]
#[tracing::instrument(skip(app, input))]
pub(crate) async fn test_ai_provider_connection(
    app: AppHandle,
    input: SaveAiSettingsInput,
) -> Result<AiConnectionTestResult, AppError> {
    let normalized = normalize_ai_settings_input(input).map_err(AppError::validation)?;
    let resolve_app = app.clone();
    let target = run_blocking(move || {
        let connection = open_app_connection(&resolve_app)?;

        resolve_ai_target_for_test(&resolve_app, &connection, normalized)
    })
    .await?;
    let started_at = now_ms();
    let store = SecureCredentialStore(&app);
    let endpoints = ChatgptEndpoints::default();
    let guard = ai_registry(&app).register(Some("connection-test".to_string()));
    let execution = AiExecution {
        store: &store,
        endpoints: &endpoints,
        token: guard.token.clone(),
    };

    let result = execute_ai_target(
        &target,
        &execution,
        "Reply with the single word ok.",
        Some("You are validating provider connectivity. Reply with the single word ok."),
    )
    .await;
    if let ResolvedAiTarget::ClaudeCode(_) = &target {
        let ready = result.is_ok();
        let record_app = app.clone();
        let _ = run_blocking(move || {
            let connection = open_app_connection(&record_app)?;
            record_claude_code_ready(&connection, ready)
        })
        .await;
    }
    if let Err(error) = &result {
        note_ai_failure(&app, error).await;
    }
    result?;

    let label = match &target {
        ResolvedAiTarget::Api(_) => "Connected",
        ResolvedAiTarget::Chatgpt { .. } => "Using ChatGPT plan",
        ResolvedAiTarget::ClaudeCode(_) => "Using Claude plan",
    };
    Ok(AiConnectionTestResult {
        detail: format!("{} · {}ms", target.model(), now_ms() - started_at),
        label: label.to_string(),
    })
}

#[tauri::command]
#[tracing::instrument(skip(app, input))]
pub(crate) async fn generate_cards(
    app: AppHandle,
    input: GenerateCardsInput,
) -> Result<Vec<GeneratedCardPayload>, AppError> {
    let request_id = input.request_id.clone();
    let normalized = normalize_generate_cards_input(input).map_err(AppError::validation)?;
    let resolve_app = app.clone();
    let target = run_blocking(move || {
        let connection = open_app_connection(&resolve_app)?;

        load_resolved_ai_target(&resolve_app, &connection)
    })
    .await?;
    let prompt = build_generate_cards_prompt(
        &normalized.topic,
        normalized.count,
        &normalized.difficulty,
        &normalized.style,
    );
    let store = SecureCredentialStore(&app);
    let endpoints = ChatgptEndpoints::default();
    let guard = ai_registry(&app).register(request_id);
    let execution = AiExecution {
        store: &store,
        endpoints: &endpoints,
        token: guard.token.clone(),
    };
    let response_text =
        match execute_ai_target(&target, &execution, &prompt, Some(AI_SYSTEM_PROMPT)).await {
            Ok(text) => text,
            Err(error) => {
                note_ai_failure(&app, &error).await;
                return Err(error);
            }
        };

    parse_generated_cards_response(&response_text, normalized.count)
}

/// Cancels a running generation or explanation by the ID the frontend gave
/// it. Returns whether something was running under that ID.
#[tauri::command]
#[tracing::instrument(skip(app))]
pub(crate) fn cancel_ai_request(app: AppHandle, request_id: String) -> bool {
    ai_registry(&app).cancel(&request_id)
}

/// Checks the local Claude Code install and its sign-in. With no path, the
/// saved one (or automatic discovery) is used and the result is remembered
/// for the AI gates.
#[tauri::command]
#[tracing::instrument(skip(app))]
pub(crate) async fn get_claude_code_status(
    app: AppHandle,
    path: Option<String>,
) -> Result<ClaudeCodeStatus, AppError> {
    let load_app = app.clone();
    let (saved_path, workdir) = run_blocking(move || {
        let connection = open_app_connection(&load_app)?;
        let state = load_ai_settings_state(&load_app, &connection)?;
        Ok((state.claude_code.path, claude_code_workdir(&load_app)?))
    })
    .await?;
    let use_saved = path.is_none();
    let probe_path = path.unwrap_or(saved_path);
    let status = probe_claude_code_status(Some(&probe_path), &workdir).await;
    if use_saved {
        let usable = status.usable;
        run_blocking(move || {
            let connection = open_app_connection(&app)?;
            record_claude_code_ready(&connection, usable)
        })
        .await?;
    }
    Ok(status)
}

/// Opens the system browser for OpenAI's ChatGPT plan-usage sign-in and
/// waits (bounded) for the loopback redirect.
#[tauri::command]
#[tracing::instrument(skip(app))]
pub(crate) async fn start_chatgpt_sign_in(app: AppHandle) -> Result<AiSettingsState, AppError> {
    let load_app = app.clone();
    let inputs = run_blocking(move || {
        let connection = open_app_connection(&load_app)?;
        load_sign_in_inputs(&connection)
    })
    .await?;
    let endpoints = ChatgptEndpoints::default();
    let browser_app = app.clone();
    let credentials = run_chatgpt_sign_in(
        &endpoints,
        sign_in_control(),
        inputs,
        move |url| {
            browser_app
                .opener()
                .open_url(url, None::<&str>)
                .map_err(|_| AppError::internal_message("Couldn't open your web browser."))
        },
        Duration::from_secs(CHATGPT_SIGN_IN_TIMEOUT_SECS),
        now_ms,
    )
    .await?;
    run_blocking(move || {
        let mut connection = open_app_connection(&app)?;
        record_sign_in(&mut connection, &SecureCredentialStore(&app), &credentials)?;
        load_ai_settings_state(&app, &connection)
    })
    .await
}

#[tauri::command]
#[tracing::instrument]
pub(crate) fn cancel_chatgpt_sign_in() -> bool {
    sign_in_control().cancel()
}

#[tauri::command]
#[tracing::instrument(skip(app))]
pub(crate) async fn disconnect_chatgpt_account(
    app: AppHandle,
) -> Result<ChatgptDisconnectResult, AppError> {
    let endpoints = ChatgptEndpoints::default();
    let remote_revoked = disconnect_chatgpt(&endpoints, &SecureCredentialStore(&app)).await?;
    let settings = run_blocking(move || {
        let connection = open_app_connection(&app)?;
        record_chatgpt_status(&connection, ChatgptStatus::Disconnected)?;
        load_ai_settings_state(&app, &connection)
    })
    .await?;
    Ok(ChatgptDisconnectResult {
        remote_revoked,
        settings,
    })
}

/// The models the signed-in ChatGPT account can use, from OpenAI's catalog.
#[tauri::command]
#[tracing::instrument(skip(app))]
pub(crate) async fn list_chatgpt_account_models(
    app: AppHandle,
) -> Result<Vec<ChatgptModel>, AppError> {
    let endpoints = ChatgptEndpoints::default();
    let result = list_chatgpt_models(&endpoints, &SecureCredentialStore(&app), &now_ms).await;
    if let Err(error) = &result {
        note_ai_failure(&app, error).await;
    }
    result
}

enum ExplainPrep {
    Cached {
        payload: ExplainCardPayload,
        generated_at: i64,
    },
    NeedsGeneration {
        front: String,
        back: String,
        target: ResolvedAiTarget,
    },
}

#[tauri::command]
#[tracing::instrument(skip(app, input), fields(card_id = %input.card_id))]
pub(crate) async fn explain_card(
    app: AppHandle,
    input: ExplainCardInput,
) -> Result<ExplainCardResult, AppError> {
    let card_id = input.card_id.trim().to_string();

    if card_id.is_empty() {
        return Err(AppError::validation_field(
            "Card identifier is required.",
            "cardId",
        ));
    }

    let force = input.force.unwrap_or(false);
    let request_id = input.request_id.clone();
    let prep_card_id = card_id.clone();
    let prep_app = app.clone();

    let prep = run_blocking(move || {
        let connection = open_app_connection(&prep_app)?;
        let source = fetch_card_explanation_source(&connection, &prep_card_id)
            .map_err(AppError::from_card_storage)?;

        if !force {
            if let (Some(serialized), Some(generated_at)) = (
                source.explanation_payload.as_ref(),
                source.explanation_generated_at,
            ) {
                if let Ok(payload) = crate::types::parse_persisted_explain_card_payload(serialized)
                {
                    return Ok(ExplainPrep::Cached {
                        payload,
                        generated_at,
                    });
                }
            }
        }

        let target = load_resolved_ai_target(&prep_app, &connection)?;

        Ok(ExplainPrep::NeedsGeneration {
            front: source.front,
            back: source.back,
            target,
        })
    })
    .await?;

    let (front, back, target) = match prep {
        ExplainPrep::Cached {
            payload,
            generated_at,
        } => {
            return Ok(ExplainCardResult {
                payload,
                generated_at,
                cached: true,
            });
        }
        ExplainPrep::NeedsGeneration {
            front,
            back,
            target,
        } => (front, back, target),
    };

    let store = SecureCredentialStore(&app);
    let endpoints = ChatgptEndpoints::default();
    let guard = ai_registry(&app).register(request_id);
    let execution = AiExecution {
        store: &store,
        endpoints: &endpoints,
        token: guard.token.clone(),
    };
    let settings = (&target, &execution);
    let user_prompt = build_explain_card_prompt(&front, &back);
    let response_text =
        match execute_explain_completion_with_retries(settings.0, settings.1, &user_prompt).await {
            Ok(text) => text,
            Err(error) => {
                note_ai_failure(&app, &error).await;
                return Err(error);
            }
        };
    let payload = match parse_explain_card_response(&response_text) {
        Ok(payload) => payload,
        Err(first_error) => {
            let repair_prompt = build_explain_repair_prompt(&response_text, &first_error);
            match execute_explain_completion_with_retries(settings.0, settings.1, &repair_prompt)
                .await
            {
                Ok(repaired) => match parse_explain_card_response(&repaired) {
                    Ok(payload) => payload,
                    Err(_) => {
                        let fallback = execute_explain_completion_with_retries(
                            settings.0,
                            settings.1,
                            build_explain_prose_fallback_prompt(),
                        )
                        .await?;
                        let mut payload = parse_explain_card_response(&fallback)?;
                        payload.visual = None;
                        payload
                    }
                },
                Err(_) => {
                    let fallback = execute_explain_completion_with_retries(
                        settings.0,
                        settings.1,
                        build_explain_prose_fallback_prompt(),
                    )
                    .await?;
                    let mut payload = parse_explain_card_response(&fallback)?;
                    payload.visual = None;
                    payload
                }
            }
        }
    };
    let serialized_payload = serde_json::to_string(&payload)
        .map_err(|error| AppError::internal_message(error.to_string()))?;

    let generated_at = now_ms();
    let persist_card_id = card_id.clone();
    let persist_payload = serialized_payload;

    run_blocking(move || {
        let connection = open_app_connection(&app)?;
        save_card_explanation(
            &connection,
            &persist_card_id,
            &persist_payload,
            generated_at,
        )
        .map_err(AppError::from_card_storage)
    })
    .await?;

    Ok(ExplainCardResult {
        payload,
        generated_at,
        cached: false,
    })
}

#[tauri::command]
#[tracing::instrument(skip(app))]
pub(crate) fn list_recent_activity(app: AppHandle) -> Result<Vec<RecentActivityEntry>, AppError> {
    let connection = open_app_connection(&app)?;

    load_recent_activity(&connection, 5).map_err(AppError::from)
}

#[tauri::command]
#[tracing::instrument(skip(app))]
pub(crate) async fn get_settings_data_summary(
    app: AppHandle,
) -> Result<SettingsDataSummary, AppError> {
    run_blocking(move || {
        let connection = open_app_connection(&app)?;
        let database_path = database_path(&app)?;

        load_settings_data_summary(&connection, &database_path).map_err(AppError::from)
    })
    .await
}

#[tauri::command]
#[tracing::instrument(skip(app))]
pub(crate) fn export_database_copy(app: AppHandle) -> Result<ExportDataResult, AppError> {
    let database_path = database_path(&app)?;
    let export_dir = export_dir(&app)?;
    fs::create_dir_all(&export_dir)?;

    let export_path = export_dir.join(format!("pupil-export-{}.db", now_ms()));
    fs::copy(&database_path, &export_path)?;

    Ok(ExportDataResult {
        path: export_path.display().to_string(),
        record_count: 1,
    })
}

#[tauri::command]
#[tracing::instrument(skip(app))]
pub(crate) fn export_review_logs_csv(app: AppHandle) -> Result<ExportDataResult, AppError> {
    let connection = open_app_connection(&app)?;
    let export_dir = export_dir(&app)?;
    fs::create_dir_all(&export_dir)?;
    let export_path = export_dir.join(format!("pupil-review-logs-{}.csv", now_ms()));
    let record_count = write_review_logs_csv(&connection, &export_path)?;

    Ok(ExportDataResult {
        path: export_path.display().to_string(),
        record_count,
    })
}

#[tauri::command]
#[tracing::instrument(skip(app))]
pub(crate) fn reset_all_data(app: AppHandle) -> Result<(), AppError> {
    let mut connection = open_app_connection(&app)?;

    reset_all_data_rows(&app, &mut connection)
}

#[tauri::command]
#[tracing::instrument(skip(app))]
pub(crate) fn refresh_tray_status(app: AppHandle) -> Result<(), AppError> {
    tray::refresh_tray(&app)
}

/// Records a renderer log line into the backend's rotating log file. Levels
/// other than `error`/`warn` fall through to `info` rather than being rejected,
/// because dropping a diagnostic is worse than filing it slightly too low.
#[tauri::command]
pub(crate) fn log_frontend_event(input: FrontendLogInput) {
    let message = truncate_chars(&input.message, FRONTEND_LOG_MAX_MESSAGE_CHARS);
    let context = input
        .context
        .as_deref()
        .map(|value| truncate_chars(value, FRONTEND_LOG_MAX_CONTEXT_CHARS))
        .unwrap_or_default();

    match input.level.as_str() {
        "error" => tracing::error!(target: "frontend", context = %context, "{message}"),
        "warn" => tracing::warn!(target: "frontend", context = %context, "{message}"),
        _ => tracing::info!(target: "frontend", context = %context, "{message}"),
    }
}

#[tauri::command]
#[tracing::instrument(skip(app))]
pub(crate) fn get_study_settings(app: AppHandle) -> Result<StudySettingsState, AppError> {
    let connection = open_app_connection(&app)?;
    let new_cards_limit = load_new_cards_limit(&connection)?;
    let new_cards_today = load_today_new_card_count(&connection)?;

    Ok(StudySettingsState {
        new_cards_limit,
        new_cards_today,
    })
}

#[tauri::command]
#[tracing::instrument(skip(app))]
pub(crate) fn save_study_settings(
    app: AppHandle,
    new_cards_limit: Option<i64>,
) -> Result<StudySettingsState, AppError> {
    let connection = open_app_connection(&app)?;
    save_new_cards_limit(&connection, new_cards_limit)?;
    let new_cards_today = load_today_new_card_count(&connection)?;

    Ok(StudySettingsState {
        new_cards_limit,
        new_cards_today,
    })
}
