use std::fs;

use tauri::{AppHandle, Manager};

use crate::ai::{
    build_generate_cards_prompt, execute_ai_completion, load_ai_settings_state,
    load_resolved_ai_settings, normalize_ai_settings_input, normalize_generate_cards_input,
    parse_generated_cards_response, resolve_ai_settings_for_test, save_ai_settings_rows,
};
use crate::analytics::{list_space_stats_rows, load_dashboard_stats};
use crate::app::{
    app_data_dir, database_path, ensure_schema_migrations_table, load_applied_migrations,
    open_app_connection, open_connection, pending_migrations, BootstrapStatus,
};
use crate::cards::{
    create_card_row, delete_card_row, list_card_summaries, review_card_row, suspend_card_row,
    update_card_row,
};
use crate::constants::AI_SYSTEM_PROMPT;
use crate::error::{AppError, AppResult};
use crate::imports::import_anki_cards_row;
use crate::normalize::{
    normalize_card_input, normalize_card_update_input, normalize_import_anki_input,
    normalize_review_card_input, normalize_space_name,
};
use crate::settings::{
    export_dir, load_new_cards_limit, load_recent_activity, load_settings_data_summary,
    load_today_new_card_count, reset_all_data_rows, save_new_cards_limit, write_review_logs_csv,
};
use crate::spaces::{create_space_row, delete_space_row, list_space_summaries, rename_space_row};
use crate::tray;
use crate::types::{
    AiConnectionTestResult, AiSettingsState, BootstrapState, CardSummary, CreateCardInput,
    DashboardStats, ExportDataResult, GenerateCardsInput, GeneratedCardPayload, ImportAnkiInput,
    ImportAnkiResult, RecentActivityEntry, ReviewCardInput, SaveAiSettingsInput,
    SettingsDataSummary, SpaceStats, SpaceSummary, StudySettingsState, SuspendCardInput,
    UpdateCardInput,
};
use crate::util::now_ms;

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
    let pending_migrations = pending_migrations(&applied_migrations);

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
pub(crate) async fn test_ai_provider_connection(
    app: AppHandle,
    input: SaveAiSettingsInput,
) -> Result<AiConnectionTestResult, AppError> {
    let normalized = normalize_ai_settings_input(input).map_err(AppError::validation)?;
    let settings = run_blocking(move || {
        let connection = open_app_connection(&app)?;

        resolve_ai_settings_for_test(&app, &connection, normalized)
    })
    .await?;
    let started_at = now_ms();

    execute_ai_completion(
        &settings,
        "Reply with the single word ok.",
        Some("You are validating provider connectivity. Reply with the single word ok."),
    )
    .await?;

    Ok(AiConnectionTestResult {
        detail: format!("{} · {}ms", settings.model, now_ms() - started_at),
        label: "Connected".to_string(),
    })
}

#[tauri::command]
#[tracing::instrument(skip(app, input))]
pub(crate) async fn generate_cards(
    app: AppHandle,
    input: GenerateCardsInput,
) -> Result<Vec<GeneratedCardPayload>, AppError> {
    let normalized = normalize_generate_cards_input(input).map_err(AppError::validation)?;
    let settings = run_blocking(move || {
        let connection = open_app_connection(&app)?;

        load_resolved_ai_settings(&app, &connection)
    })
    .await?;
    let prompt = build_generate_cards_prompt(
        &normalized.topic,
        normalized.count,
        &normalized.difficulty,
        &normalized.style,
    );
    let response_text = execute_ai_completion(&settings, &prompt, Some(AI_SYSTEM_PROMPT)).await?;

    parse_generated_cards_response(&response_text)
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
