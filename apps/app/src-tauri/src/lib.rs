mod ai;
mod analytics;
mod app;
mod cards;
mod commands;
mod constants;
mod error;
mod imports;
mod normalize;
mod settings;
mod spaces;
mod study_queue;
#[cfg(test)]
mod tests;
mod tray;
mod types;
mod util;

use std::fs;
use std::sync::OnceLock;

#[cfg(debug_assertions)]
use tauri::Emitter;
use tauri::Manager;
use tracing_appender::non_blocking::WorkerGuard;

use crate::ai::StrongholdState;
use crate::app::{build_app_menu, database_path, run_migrations, BootstrapStatus};
use crate::commands::{
    create_card, create_space, delete_card, delete_space, export_database_copy,
    export_review_logs_csv, generate_cards, get_ai_settings, get_bootstrap_state,
    get_dashboard_stats, get_settings_data_summary, get_study_queue_snapshot, get_study_settings,
    import_anki_cards, list_cards, list_recent_activity, list_space_stats, list_spaces,
    refresh_tray_status, rename_space, reset_all_data, review_card, save_ai_settings,
    save_study_settings, suspend_card, test_ai_provider_connection, update_card,
};
#[cfg(debug_assertions)]
use crate::constants::{
    DEVELOPER_OPEN_DEVTOOLS_MENU_ID, DEVELOPER_RESET_ONBOARDING_EVENT,
    DEVELOPER_RESET_ONBOARDING_MENU_ID,
};
use crate::error::AppError;

static PANIC_HOOK_INSTALLED: OnceLock<()> = OnceLock::new();

struct LoggingState {
    _guard: WorkerGuard,
}

/// Installs a single global panic hook so unexpected backend crashes land in the
/// tracing log instead of disappearing into stderr only.
fn install_panic_hook() {
    let _ = PANIC_HOOK_INSTALLED.get_or_init(|| {
        std::panic::set_hook(Box::new(|panic_info| {
            let location = panic_info
                .location()
                .map(|location| format!("{}:{}", location.file(), location.line()))
                .unwrap_or_else(|| "unknown location".to_string());
            let message = panic_info
                .payload()
                .downcast_ref::<&str>()
                .map(|payload| payload.to_string())
                .or_else(|| {
                    panic_info
                        .payload()
                        .downcast_ref::<String>()
                        .map(ToOwned::to_owned)
                })
                .unwrap_or_else(|| "panic payload unavailable".to_string());

            tracing::error!(location, message, "unhandled panic");
        }));
    });
}

/// Configures file-backed tracing for the desktop app before any commands or
/// migrations run so startup failures are still captured locally.
fn init_logging(app: &tauri::AppHandle) -> Result<LoggingState, AppError> {
    let logs_dir = app::app_data_dir(app)?.join("logs");
    fs::create_dir_all(&logs_dir)?;
    let file_appender = tracing_appender::rolling::daily(logs_dir, "pupil.log");
    let (writer, guard) = tracing_appender::non_blocking(file_appender);
    let subscriber = tracing_subscriber::fmt()
        .with_ansi(false)
        .with_writer(writer)
        .with_target(true)
        .finish();

    tracing::subscriber::set_global_default(subscriber)
        .map_err(|error| AppError::internal_message(error.to_string()))?;
    install_panic_hook();

    Ok(LoggingState { _guard: guard })
}

/// Builds and runs the Tauri application with all plugins, commands, logging,
/// and database bootstrap wired in one place.
pub fn run() {
    #[cfg(debug_assertions)]
    let mcp_plugin = tauri_plugin_mcp_bridge::Builder::new()
        .bind_address("127.0.0.1")
        .build();

    let builder = tauri::Builder::default()
        .manage(StrongholdState::default())
        .menu(build_app_menu);

    #[cfg(debug_assertions)]
    let builder = builder.plugin(mcp_plugin);

    #[cfg(debug_assertions)]
    let builder = builder.on_menu_event(|app, event| {
        if event.id().as_ref() == DEVELOPER_OPEN_DEVTOOLS_MENU_ID {
            if let Some(webview) = app.get_webview_window("main") {
                webview.open_devtools();
            }
        }
        if event.id().as_ref() == DEVELOPER_RESET_ONBOARDING_MENU_ID {
            let _ = app.emit(DEVELOPER_RESET_ONBOARDING_EVENT, ());
        }
    });

    builder
        .setup(|app| {
            app.manage(init_logging(app.handle())?);

            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

            app.handle().plugin(tauri_plugin_opener::init())?;

            let database_path = database_path(app.handle())?;
            let backup_created = run_migrations(app.handle(), &database_path)?;

            app.manage(BootstrapStatus { backup_created });
            tray::setup_tray(app.handle())?;
            if let Err(error) = tray::refresh_tray(app.handle()) {
                tracing::warn!("failed to refresh tray during startup: {error}");
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_bootstrap_state,
            list_spaces,
            create_space,
            rename_space,
            delete_space,
            list_cards,
            create_card,
            update_card,
            delete_card,
            suspend_card,
            review_card,
            import_anki_cards,
            get_dashboard_stats,
            get_study_queue_snapshot,
            list_space_stats,
            get_ai_settings,
            save_ai_settings,
            test_ai_provider_connection,
            generate_cards,
            list_recent_activity,
            get_settings_data_summary,
            export_database_copy,
            export_review_logs_csv,
            reset_all_data,
            refresh_tray_status,
            get_study_settings,
            save_study_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running pupil app");
}
