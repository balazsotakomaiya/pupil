use nanoid::nanoid;
use rusqlite::{ffi::ErrorCode, params, Connection};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::menu::{MenuBuilder, SubmenuBuilder};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};

type AppResult<T> = Result<T, Box<dyn std::error::Error>>;

#[derive(Clone)]
struct Migration {
    id: &'static str,
    sql: &'static str,
}

#[derive(Clone)]
struct SpaceIdentity {
    id: String,
    name: String,
    created_at: i64,
    updated_at: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BootstrapState {
    app_data_dir: String,
    database_path: String,
    applied_migrations: Vec<String>,
    pending_migrations: Vec<String>,
    backup_created: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SpaceSummary {
    id: String,
    name: String,
    card_count: i64,
    due_today_count: i64,
    streak: i64,
    created_at: i64,
    updated_at: i64,
}

const SPACE_NAME_MAX_LENGTH: usize = 80;

const MIGRATIONS: &[Migration] = &[Migration {
    id: "0001_init",
    sql: include_str!("../migrations/0001_init.sql"),
}];

#[tauri::command]
fn get_bootstrap_state(app: AppHandle) -> Result<BootstrapState, String> {
    let app_data_dir = app_data_dir(&app)?;
    let database_path = database_path(&app)?;
    let bootstrap_status = app.state::<BootstrapStatus>();

    let connection = open_connection(&database_path).map_err(|error| error.to_string())?;
    ensure_schema_migrations_table(&connection).map_err(|error| error.to_string())?;

    let applied_migrations =
        load_applied_migrations(&connection).map_err(|error| error.to_string())?;
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
fn list_spaces(app: AppHandle) -> Result<Vec<SpaceSummary>, String> {
    let connection = open_app_connection(&app).map_err(|error| error.to_string())?;

    list_space_summaries(&connection).map_err(|error| error.to_string())
}

#[tauri::command]
fn create_space(app: AppHandle, name: String) -> Result<SpaceSummary, String> {
    let normalized_name = normalize_space_name(&name)?;
    let connection = open_app_connection(&app).map_err(|error| error.to_string())?;

    create_space_row(&connection, &normalized_name).map_err(map_storage_error)
}

#[tauri::command]
fn rename_space(app: AppHandle, id: String, name: String) -> Result<SpaceSummary, String> {
    let normalized_name = normalize_space_name(&name)?;
    let connection = open_app_connection(&app).map_err(|error| error.to_string())?;

    rename_space_row(&connection, &id, &normalized_name).map_err(map_storage_error)
}

#[tauri::command]
fn delete_space(app: AppHandle, id: String) -> Result<(), String> {
    let connection = open_app_connection(&app).map_err(|error| error.to_string())?;

    delete_space_row(&connection, &id).map_err(map_storage_error)
}

pub fn run() {
    tauri::Builder::default()
        .menu(|app| build_app_menu(app))
        .setup(|app| {
            let database_path = database_path(app.handle())?;
            let backup_created = run_migrations(app.handle(), &database_path)?;

            app.manage(BootstrapStatus { backup_created });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_bootstrap_state,
            list_spaces,
            create_space,
            rename_space,
            delete_space
        ])
        .run(tauri::generate_context!())
        .expect("error while running pupil app");
}

fn build_app_menu(app: &AppHandle) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
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

    let mut builder = MenuBuilder::new(app);

    #[cfg(target_os = "macos")]
    if let Some(app_menu) = &app_menu {
        builder = builder.item(app_menu);
    }

    builder
        .item(&edit_menu)
        .item(&window_menu)
        .build()
}

struct BootstrapStatus {
    backup_created: bool,
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .resolve(".", BaseDirectory::AppData)
        .map_err(|error| error.to_string())
}

fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_data_dir(app)?;

    Ok(app_data_dir.join("pupil.db"))
}

fn open_app_connection(app: &AppHandle) -> AppResult<Connection> {
    let path = database_path(app)?;

    open_connection(&path)
}

fn open_connection(path: &Path) -> AppResult<Connection> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let connection = Connection::open(path)?;
    connection.busy_timeout(Duration::from_secs(5))?;
    connection.execute_batch("PRAGMA foreign_keys = ON;")?;

    Ok(connection)
}

fn ensure_schema_migrations_table(connection: &Connection) -> rusqlite::Result<()> {
    connection.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id TEXT PRIMARY KEY,
          applied_at INTEGER NOT NULL
        );
        ",
    )
}

fn load_applied_migrations(connection: &Connection) -> rusqlite::Result<Vec<String>> {
    let mut statement = connection.prepare("SELECT id FROM schema_migrations ORDER BY id ASC")?;
    let rows = statement.query_map([], |row| row.get::<_, String>(0))?;

    rows.collect()
}

fn pending_migrations(applied_migrations: &[String]) -> Vec<String> {
    MIGRATIONS
        .iter()
        .filter(|migration| !applied_migrations.iter().any(|id| id == migration.id))
        .map(|migration| migration.id.to_string())
        .collect()
}

fn run_migrations(app: &AppHandle, path: &Path) -> AppResult<bool> {
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

fn list_space_summaries(connection: &Connection) -> rusqlite::Result<Vec<SpaceSummary>> {
    let mut statement = connection.prepare(
        "
        SELECT id, name, created_at, updated_at
        FROM spaces
        ORDER BY updated_at DESC, created_at DESC, name COLLATE NOCASE ASC
        ",
    )?;
    let rows = statement.query_map([], |row| {
        Ok(SpaceIdentity {
            id: row.get(0)?,
            name: row.get(1)?,
            created_at: row.get(2)?,
            updated_at: row.get(3)?,
        })
    })?;
    let spaces = rows.collect::<rusqlite::Result<Vec<_>>>()?;
    let current_time = now_ms();

    spaces
        .into_iter()
        .map(|space| hydrate_space_summary(connection, space, current_time))
        .collect()
}

fn hydrate_space_summary(
    connection: &Connection,
    space: SpaceIdentity,
    current_time: i64,
) -> rusqlite::Result<SpaceSummary> {
    let (card_count, due_today_count) = load_space_counts(connection, &space.id, current_time)?;
    let streak = load_space_streak(connection, &space.id)?;

    Ok(SpaceSummary {
        id: space.id,
        name: space.name,
        card_count,
        due_today_count,
        streak,
        created_at: space.created_at,
        updated_at: space.updated_at,
    })
}

fn load_space_counts(
    connection: &Connection,
    space_id: &str,
    current_time: i64,
) -> rusqlite::Result<(i64, i64)> {
    connection.query_row(
        "
        SELECT COUNT(*),
               COALESCE(SUM(CASE WHEN due <= ?2 THEN 1 ELSE 0 END), 0)
        FROM cards
        WHERE space_id = ?1
        ",
        params![space_id, current_time],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )
}

fn load_space_streak(connection: &Connection, space_id: &str) -> rusqlite::Result<i64> {
    connection.query_row(
        "
        WITH ordered_days AS (
          SELECT day,
                 ROW_NUMBER() OVER (ORDER BY day DESC) AS row_number,
                 CAST(julianday(date('now', 'localtime')) - julianday(day) AS INTEGER) AS day_offset
          FROM study_days
          WHERE space_id = ?1
            AND day <= date('now', 'localtime')
        ),
        anchor AS (
          SELECT CASE
            WHEN EXISTS (
              SELECT 1 FROM ordered_days WHERE day = date('now', 'localtime')
            ) THEN 0
            WHEN EXISTS (
              SELECT 1 FROM ordered_days WHERE day = date('now', 'localtime', '-1 day')
            ) THEN 1
            ELSE NULL
          END AS start_offset
        )
        SELECT COALESCE(
          (
            SELECT COUNT(*)
            FROM ordered_days, anchor
            WHERE anchor.start_offset IS NOT NULL
              AND ordered_days.day_offset >= anchor.start_offset
              AND ordered_days.day_offset = ordered_days.row_number - 1 + anchor.start_offset
          ),
          0
        )
        ",
        [space_id],
        |row| row.get(0),
    )
}

fn fetch_space_identity(connection: &Connection, id: &str) -> rusqlite::Result<SpaceIdentity> {
    connection.query_row(
        "
        SELECT id, name, created_at, updated_at
        FROM spaces
        WHERE id = ?1
        ",
        [id],
        |row| {
            Ok(SpaceIdentity {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        },
    )
}

fn create_space_row(connection: &Connection, name: &str) -> rusqlite::Result<SpaceSummary> {
    let id = nanoid!(12);
    let timestamp = now_ms();
    connection.execute(
        "
        INSERT INTO spaces (id, name, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4)
        ",
        params![id, name, timestamp, timestamp],
    )?;
    let space = fetch_space_identity(connection, &id)?;

    hydrate_space_summary(connection, space, timestamp)
}

fn rename_space_row(
    connection: &Connection,
    id: &str,
    name: &str,
) -> rusqlite::Result<SpaceSummary> {
    let timestamp = now_ms();
    let updated_rows = connection.execute(
        "
        UPDATE spaces
        SET name = ?1,
            updated_at = ?2
        WHERE id = ?3
        ",
        params![name, timestamp, id],
    )?;

    if updated_rows == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }

    let space = fetch_space_identity(connection, id)?;

    hydrate_space_summary(connection, space, timestamp)
}

fn delete_space_row(connection: &Connection, id: &str) -> rusqlite::Result<()> {
    let deleted_rows = connection.execute("DELETE FROM spaces WHERE id = ?1", [id])?;

    if deleted_rows == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }

    Ok(())
}

fn normalize_space_name(name: &str) -> Result<String, String> {
    let trimmed = name.trim();

    if trimmed.is_empty() {
        return Err("Space name can't be empty.".to_string());
    }

    if trimmed.chars().count() > SPACE_NAME_MAX_LENGTH {
        return Err(format!(
            "Space names must be {} characters or fewer.",
            SPACE_NAME_MAX_LENGTH
        ));
    }

    Ok(trimmed.to_string())
}

fn map_storage_error(error: rusqlite::Error) -> String {
    match error {
        rusqlite::Error::SqliteFailure(sqlite_error, _)
            if sqlite_error.code == ErrorCode::ConstraintViolation
                && sqlite_error.extended_code == 2067 =>
        {
            "A space with that name already exists.".to_string()
        }
        rusqlite::Error::SqliteFailure(sqlite_error, _)
            if sqlite_error.code == ErrorCode::ConstraintViolation =>
        {
            "The requested change violates a database constraint.".to_string()
        }
        rusqlite::Error::QueryReturnedNoRows => "Space not found.".to_string(),
        other => other.to_string(),
    }
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock drifted backwards")
        .as_millis() as i64
}
