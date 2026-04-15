use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use rusqlite::Connection;
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};

use crate::constants::{
    DEVELOPER_OPEN_DEVTOOLS_MENU_ID, DEVELOPER_RESET_ONBOARDING_MENU_ID, MIGRATIONS,
};
use crate::types::AppResult;
use crate::util::now_ms;

pub(crate) struct BootstrapStatus {
    pub(crate) backup_created: bool,
}

pub(crate) fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .resolve(".", BaseDirectory::AppData)
        .map_err(|error| error.to_string())
}

pub(crate) fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_data_dir(app)?;

    Ok(app_data_dir.join("pupil.db"))
}

pub(crate) fn open_app_connection(app: &AppHandle) -> AppResult<Connection> {
    let path = database_path(app)?;

    open_connection(&path)
}

pub(crate) fn open_connection(path: &Path) -> AppResult<Connection> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let connection = Connection::open(path)?;
    connection.busy_timeout(Duration::from_secs(5))?;
    connection.execute_batch("PRAGMA foreign_keys = ON;")?;

    Ok(connection)
}

pub(crate) fn ensure_schema_migrations_table(connection: &Connection) -> rusqlite::Result<()> {
    connection.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id TEXT PRIMARY KEY,
          applied_at INTEGER NOT NULL
        );
        ",
    )
}

pub(crate) fn load_applied_migrations(connection: &Connection) -> rusqlite::Result<Vec<String>> {
    let mut statement = connection.prepare("SELECT id FROM schema_migrations ORDER BY id ASC")?;
    let rows = statement.query_map([], |row| row.get::<_, String>(0))?;

    rows.collect()
}

pub(crate) fn pending_migrations(applied_migrations: &[String]) -> Vec<String> {
    MIGRATIONS
        .iter()
        .filter(|migration| !applied_migrations.iter().any(|id| id == migration.id))
        .map(|migration| migration.id.to_string())
        .collect()
}

pub(crate) fn build_app_menu(app: &AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    #[cfg(target_os = "macos")]
    let app_menu = Some(
        SubmenuBuilder::new(app, "Pupil")
            .about(None)
            .separator()
            .services()
            .separator()
            .hide()
            .hide_others()
            .show_all()
            .separator()
            .quit()
            .build()?,
    );

    #[cfg(not(target_os = "macos"))]
    let app_menu: Option<tauri::menu::Submenu<tauri::Wry>> = None;

    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let window_menu = SubmenuBuilder::new(app, "Window")
        .minimize()
        .maximize()
        .separator()
        .close_window()
        .build()?;

    #[cfg(debug_assertions)]
    let developer_menu = {
        let open_devtools =
            MenuItemBuilder::with_id(DEVELOPER_OPEN_DEVTOOLS_MENU_ID, "Open DevTools")
                .accelerator("CmdOrCtrl+Shift+I")
                .build(app)?;
        let reset_onboarding =
            MenuItemBuilder::with_id(DEVELOPER_RESET_ONBOARDING_MENU_ID, "Reset Onboarding")
                .accelerator("CmdOrCtrl+Shift+O")
                .build(app)?;

        Some(
            SubmenuBuilder::new(app, "Developer")
                .item(&open_devtools)
                .separator()
                .item(&reset_onboarding)
                .build()?,
        )
    };

    #[cfg(not(debug_assertions))]
    let developer_menu: Option<tauri::menu::Submenu<tauri::Wry>> = None;

    let mut builder = MenuBuilder::new(app);

    #[cfg(target_os = "macos")]
    if let Some(app_menu) = &app_menu {
        builder = builder.item(app_menu);
    }

    if let Some(developer_menu) = &developer_menu {
        builder = builder.item(developer_menu);
    }

    builder.item(&edit_menu).item(&window_menu).build()
}

pub(crate) fn run_migrations(app: &AppHandle, path: &Path) -> AppResult<bool> {
    let mut connection = open_connection(path)?;
    ensure_schema_migrations_table(&connection)?;
    let applied_migrations = load_applied_migrations(&connection)?;
    let pending = MIGRATIONS
        .iter()
        .filter(|migration| !applied_migrations.iter().any(|id| id == migration.id))
        .collect::<Vec<_>>();

    if pending.is_empty() {
        return Ok(false);
    }

    let should_backup = pending
        .iter()
        .any(|migration| migration_needs_backup(migration.sql));
    let backup_created = if should_backup {
        create_backup_if_database_exists(app, path)?
    } else {
        false
    };

    let transaction = connection.transaction()?;

    for migration in pending {
        transaction.execute_batch(migration.sql)?;
        transaction.execute(
            "INSERT INTO schema_migrations (id, applied_at) VALUES (?1, ?2)",
            (migration.id, now_ms()),
        )?;
    }

    transaction.commit()?;

    Ok(backup_created)
}

fn migration_needs_backup(sql: &str) -> bool {
    let normalized = sql.to_ascii_uppercase();

    normalized.contains("DROP TABLE")
        || normalized.contains("ALTER TABLE")
        || normalized.contains("DELETE FROM")
        || normalized.contains("UPDATE ")
}

fn create_backup_if_database_exists(app: &AppHandle, database_path: &Path) -> AppResult<bool> {
    if !database_path.exists() {
        return Ok(false);
    }

    let backups_dir = app_data_dir(app)?.join("backups");
    fs::create_dir_all(&backups_dir)?;

    let backup_path = backups_dir.join(format!("pupil-{}.db", now_ms()));
    fs::copy(database_path, backup_path)?;

    Ok(true)
}
