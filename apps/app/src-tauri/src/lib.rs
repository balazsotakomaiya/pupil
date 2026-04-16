mod ai;
mod analytics;
mod app;
mod cards;
mod commands;
mod constants;
mod imports;
mod normalize;
mod settings;
mod spaces;
mod tray;
mod types;
mod util;

#[cfg(debug_assertions)]
use tauri::Emitter;
use tauri::Manager;

use crate::ai::StrongholdState;
use crate::app::{build_app_menu, database_path, run_migrations, BootstrapStatus};
use crate::commands::{
    create_card, create_space, delete_card, delete_space, export_database_copy,
    export_review_logs_csv, generate_cards, get_ai_settings, get_bootstrap_state,
    get_dashboard_stats, get_settings_data_summary, get_study_settings, import_anki_cards,
    list_cards, list_recent_activity, list_space_stats, list_spaces, refresh_tray_status,
    rename_space, reset_all_data, review_card, save_ai_settings, save_study_settings,
    suspend_card, test_ai_provider_connection, update_card,
};
#[cfg(debug_assertions)]
use crate::constants::{
    DEVELOPER_OPEN_DEVTOOLS_MENU_ID, DEVELOPER_RESET_ONBOARDING_EVENT,
    DEVELOPER_RESET_ONBOARDING_MENU_ID,
};

pub fn run() {
    let builder = tauri::Builder::default()
        .manage(StrongholdState::default())
        .menu(build_app_menu);

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
            let database_path = database_path(app.handle())?;
            let backup_created = run_migrations(app.handle(), &database_path)?;

            app.manage(BootstrapStatus { backup_created });
            tray::setup_tray(app.handle())?;

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
