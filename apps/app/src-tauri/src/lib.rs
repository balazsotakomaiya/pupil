use nanoid::nanoid;
use rusqlite::{ffi::ErrorCode, params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Emitter, Manager};

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

#[derive(Clone)]
struct CardIdentity {
    space_id: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CardSummary {
    id: String,
    space_id: String,
    space_name: String,
    front: String,
    back: String,
    tags: Vec<String>,
    source: String,
    state: i64,
    due: i64,
    stability: f64,
    difficulty: f64,
    elapsed_days: i64,
    scheduled_days: i64,
    learning_steps: i64,
    reps: i64,
    lapses: i64,
    last_review: Option<i64>,
    created_at: i64,
    updated_at: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateCardInput {
    space_id: String,
    front: String,
    back: String,
    tags: Vec<String>,
    source: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateCardInput {
    id: String,
    space_id: String,
    front: String,
    back: String,
    tags: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReviewCardInput {
    id: String,
    grade: i64,
    state: i64,
    due: i64,
    stability: f64,
    difficulty: f64,
    elapsed_days: i64,
    scheduled_days: i64,
    learning_steps: i64,
    reps: i64,
    lapses: i64,
    last_review: i64,
    review_log: ReviewCardLogInput,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReviewCardLogInput {
    state: i64,
    due: i64,
    elapsed_days: Option<i64>,
    scheduled_days: i64,
    review_time: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ImportAnkiInput {
    source_file_name: String,
    cards: Vec<ImportAnkiCardInput>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ImportAnkiCardInput {
    deck_name: String,
    front: String,
    back: String,
    tags: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ImportAnkiResult {
    created_space_count: i64,
    deck_count: i64,
    decks: Vec<ImportDeckResult>,
    duplicate_count: i64,
    imported_count: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ImportDeckResult {
    deck_name: String,
    imported_count: i64,
    skipped_count: i64,
    space_id: String,
    space_name: String,
    total_count: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DashboardStats {
    due_today: i64,
    global_streak: i64,
    studied_today: i64,
    study_days: Vec<String>,
    total_cards: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SpaceStats {
    retention_30d: Option<f64>,
    review_activity_7d: Vec<i64>,
    space_id: String,
}

const SPACE_NAME_MAX_LENGTH: usize = 80;
const DEVELOPER_RESET_ONBOARDING_MENU_ID: &str = "developer.reset_onboarding";
const DEVELOPER_RESET_ONBOARDING_EVENT: &str = "developer://reset-onboarding";

const MIGRATIONS: &[Migration] = &[
    Migration {
        id: "0001_init",
        sql: include_str!("../migrations/0001_init.sql"),
    },
    Migration {
        id: "0002_add_learning_steps",
        sql: include_str!("../migrations/0002_add_learning_steps.sql"),
    },
];

#[tauri::command]
/// Gives the frontend a plain-language snapshot of local app setup so onboarding
/// and debugging can explain where data lives and whether bootstrapping finished cleanly.
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
/// Lists spaces in the same enriched shape the UI renders, so the frontend does
/// not need to stitch together counts, due cards, and streaks on its own.
fn list_spaces(app: AppHandle) -> Result<Vec<SpaceSummary>, String> {
    let connection = open_app_connection(&app).map_err(|error| error.to_string())?;

    list_space_summaries(&connection).map_err(|error| error.to_string())
}

#[tauri::command]
/// Creates a new study space after applying the same naming rules the rest of the
/// app expects, keeping space creation consistent no matter where it starts.
fn create_space(app: AppHandle, name: String) -> Result<SpaceSummary, String> {
    let normalized_name = normalize_space_name(&name)?;
    let connection = open_app_connection(&app).map_err(|error| error.to_string())?;

    create_space_row(&connection, &normalized_name).map_err(map_storage_error)
}

#[tauri::command]
/// Renames an existing space while preserving the same validation and summary
/// payload shape that the UI uses for fresh data.
fn rename_space(app: AppHandle, id: String, name: String) -> Result<SpaceSummary, String> {
    let normalized_name = normalize_space_name(&name)?;
    let connection = open_app_connection(&app).map_err(|error| error.to_string())?;

    rename_space_row(&connection, &id, &normalized_name).map_err(map_storage_error)
}

#[tauri::command]
/// Deletes a space as a single backend operation so the UI only has to care about
/// intent, not the storage details behind removing it.
fn delete_space(app: AppHandle, id: String) -> Result<(), String> {
    let connection = open_app_connection(&app).map_err(|error| error.to_string())?;

    delete_space_row(&connection, &id).map_err(map_storage_error)
}

#[tauri::command]
/// Returns cards in the display-ready format the library views use, with an
/// optional space filter for scoped browsing.
fn list_cards(app: AppHandle, space_id: Option<String>) -> Result<Vec<CardSummary>, String> {
    let connection = open_app_connection(&app).map_err(|error| error.to_string())?;

    list_card_summaries(&connection, space_id.as_deref()).map_err(map_card_storage_error)
}

#[tauri::command]
/// Creates a card only after normalizing free-form user input into the stricter
/// shape the database and scheduler expect.
fn create_card(app: AppHandle, input: CreateCardInput) -> Result<CardSummary, String> {
    let mut connection = open_app_connection(&app).map_err(|error| error.to_string())?;
    let normalized = normalize_card_input(
        &input.space_id,
        &input.front,
        &input.back,
        &input.tags,
        input.source.as_deref(),
    )?;

    create_card_row(&mut connection, normalized).map_err(map_card_storage_error)
}

#[tauri::command]
/// Updates card content and placement while keeping validation at the backend
/// boundary instead of trusting every caller to do it correctly.
fn update_card(app: AppHandle, input: UpdateCardInput) -> Result<CardSummary, String> {
    let mut connection = open_app_connection(&app).map_err(|error| error.to_string())?;
    let normalized = normalize_card_update_input(&input)?;

    update_card_row(&mut connection, normalized).map_err(map_card_storage_error)
}

#[tauri::command]
/// Removes a card and lets the backend take care of any follow-up bookkeeping
/// such as refreshing the owning space timestamp.
fn delete_card(app: AppHandle, id: String) -> Result<(), String> {
    let mut connection = open_app_connection(&app).map_err(|error| error.to_string())?;

    delete_card_row(&mut connection, &id).map_err(map_card_storage_error)
}

#[tauri::command]
/// Applies the scheduler result for one review and records the matching review log
/// so card state, history, and streak data stay in sync.
fn review_card(app: AppHandle, input: ReviewCardInput) -> Result<CardSummary, String> {
    let mut connection = open_app_connection(&app).map_err(|error| error.to_string())?;
    let normalized = normalize_review_card_input(&input)?;

    review_card_row(&mut connection, normalized).map_err(map_card_storage_error)
}

#[tauri::command]
/// Imports an Anki payload in one backend transaction so deck creation, duplicate
/// detection, and card inserts either land together or fail together.
fn import_anki_cards(app: AppHandle, input: ImportAnkiInput) -> Result<ImportAnkiResult, String> {
    let mut connection = open_app_connection(&app).map_err(|error| error.to_string())?;
    let normalized_cards = normalize_import_anki_cards(&input.cards)?;

    import_anki_cards_row(&mut connection, &input.source_file_name, normalized_cards)
        .map_err(map_card_storage_error)
}

#[tauri::command]
/// Builds the top-level dashboard numbers from the source tables so the frontend
/// can render the home view without duplicating reporting logic.
fn get_dashboard_stats(app: AppHandle) -> Result<DashboardStats, String> {
    let connection = open_app_connection(&app).map_err(|error| error.to_string())?;
    let now = now_ms();

    load_dashboard_stats(&connection, now).map_err(|error| error.to_string())
}

#[tauri::command]
/// Returns per-space trend data for the overview screens that compare activity and
/// retention across the learner's collection.
fn list_space_stats(app: AppHandle) -> Result<Vec<SpaceStats>, String> {
    let connection = open_app_connection(&app).map_err(|error| error.to_string())?;
    let now = now_ms();

    list_space_stats_rows(&connection, now).map_err(|error| error.to_string())
}

/// Wires together the desktop shell, database bootstrapping, and Tauri commands.
/// This is the backend entry point the tiny `main.rs` hands off to.
pub fn run() {
    tauri::Builder::default()
        .menu(|app| build_app_menu(app))
        .on_menu_event(|app, event| {
            if event.id().as_ref() == DEVELOPER_RESET_ONBOARDING_MENU_ID {
                let _ = app.emit(DEVELOPER_RESET_ONBOARDING_EVENT, ());
            }
        })
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
            delete_space,
            list_cards,
            create_card,
            update_card,
            delete_card,
            review_card,
            import_anki_cards,
            get_dashboard_stats,
            list_space_stats
        ])
        .run(tauri::generate_context!())
        .expect("error while running pupil app");
}

/// Builds a native-feeling app menu while keeping the developer-only affordances
/// separate from the menus end users see in production.
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

    #[cfg(debug_assertions)]
    let developer_menu = {
        let reset_onboarding =
            MenuItemBuilder::with_id(DEVELOPER_RESET_ONBOARDING_MENU_ID, "Reset Onboarding")
                .accelerator("CmdOrCtrl+Shift+O")
                .build(app)?;

        Some(
            SubmenuBuilder::new(app, "Developer")
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

struct BootstrapStatus {
    backup_created: bool,
}

/// Resolves the directory where this app keeps its durable local data, giving the
/// rest of the backend one canonical base path to build from.
fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .resolve(".", BaseDirectory::AppData)
        .map_err(|error| error.to_string())
}

/// Chooses the single SQLite file the app treats as its source of truth.
fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app_data_dir(app)?;

    Ok(app_data_dir.join("pupil.db"))
}

/// Opens the application's main database connection so command handlers do not
/// need to repeat path resolution on every call.
fn open_app_connection(app: &AppHandle) -> AppResult<Connection> {
    let path = database_path(app)?;

    open_connection(&path)
}

/// Opens SQLite with the small set of guarantees this app relies on everywhere:
/// the parent directory exists, writes wait briefly, and foreign keys are enforced.
fn open_connection(path: &Path) -> AppResult<Connection> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let connection = Connection::open(path)?;
    connection.busy_timeout(Duration::from_secs(5))?;
    connection.execute_batch("PRAGMA foreign_keys = ON;")?;

    Ok(connection)
}

/// Makes sure the migration ledger exists before any code tries to inspect or
/// apply schema changes.
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

/// Reads which migrations have already run so startup can tell completed work
/// from pending work.
fn load_applied_migrations(connection: &Connection) -> rusqlite::Result<Vec<String>> {
    let mut statement = connection.prepare("SELECT id FROM schema_migrations ORDER BY id ASC")?;
    let rows = statement.query_map([], |row| row.get::<_, String>(0))?;

    rows.collect()
}

/// Computes the migrations still waiting to be applied, which powers both startup
/// behavior and the bootstrap diagnostics shown in the UI.
fn pending_migrations(applied_migrations: &[String]) -> Vec<String> {
    MIGRATIONS
        .iter()
        .filter(|migration| !applied_migrations.iter().any(|id| id == migration.id))
        .map(|migration| migration.id.to_string())
        .collect()
}

/// Applies pending schema changes during startup, creating a backup first when the
/// SQL looks like it could destructively reshape existing data.
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

/// Uses a conservative text check to decide whether a migration deserves a safety
/// backup before it runs.
fn migration_needs_backup(sql: &str) -> bool {
    let normalized = sql.to_ascii_uppercase();

    normalized.contains("DROP TABLE")
        || normalized.contains("ALTER TABLE")
        || normalized.contains("DELETE FROM")
        || normalized.contains("UPDATE ")
}

/// Creates a timestamped copy of the live database before risky migrations so the
/// app has a simple rollback artifact if something goes wrong.
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

/// Loads the base list of spaces, then hydrates each one with the counts the UI
/// actually shows next to its name.
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

/// Turns a bare `spaces` row into the richer summary object used across the app's
/// navigation and overview screens.
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

/// Collects the two headline space counts together so space summaries can answer
/// both "how many cards exist?" and "how many need attention now?".
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
    load_streak(connection, Some(space_id))
}

/// Calculates a consecutive-day streak from the normalized `study_days` table.
/// Both the global dashboard and per-space views rely on the same definition.
fn load_streak(connection: &Connection, space_id: Option<&str>) -> rusqlite::Result<i64> {
    connection.query_row(
        "
        WITH ordered_days AS (
          SELECT day,
                 ROW_NUMBER() OVER (ORDER BY day DESC) AS row_number,
                 CAST(julianday(date('now', 'localtime')) - julianday(day) AS INTEGER) AS day_offset
          FROM study_days
          WHERE ((?1 IS NULL AND space_id IS NULL) OR space_id = ?1)
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

/// Gathers the home-screen metrics in one place so the UI can stay focused on
/// presentation rather than reporting queries.
fn load_dashboard_stats(connection: &Connection, now: i64) -> rusqlite::Result<DashboardStats> {
    let (total_cards, due_today) = connection.query_row(
        "
        SELECT COUNT(*),
               COALESCE(SUM(CASE WHEN due <= ?1 THEN 1 ELSE 0 END), 0)
        FROM cards
        ",
        [now],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;
    let studied_today = connection.query_row(
        "
        SELECT COUNT(*)
        FROM review_logs
        WHERE date(review_time / 1000, 'unixepoch', 'localtime') = date('now', 'localtime')
        ",
        [],
        |row| row.get(0),
    )?;
    let global_streak = load_streak(connection, None)?;
    let study_days = load_recent_study_days(connection, None, 112)?;

    Ok(DashboardStats {
        due_today,
        global_streak,
        studied_today,
        study_days,
        total_cards,
    })
}

/// Builds the analytics payload for each space by pairing identities with the
/// lightweight time-based stats shown in overview cards.
fn list_space_stats_rows(connection: &Connection, now: i64) -> rusqlite::Result<Vec<SpaceStats>> {
    let spaces = load_all_space_identities(connection)?;

    spaces
        .into_iter()
        .map(|space| {
            Ok(SpaceStats {
                retention_30d: load_retention_30d(connection, &space.id)?,
                review_activity_7d: load_review_activity_7d(connection, &space.id, now)?,
                space_id: space.id,
            })
        })
        .collect()
}

/// Estimates recent retention from review logs so the app can show whether a space
/// is holding up over the last month without re-running scheduler logic.
fn load_retention_30d(connection: &Connection, space_id: &str) -> rusqlite::Result<Option<f64>> {
    let since = now_ms() - (30 * 24 * 60 * 60 * 1000);

    connection.query_row(
        "
        SELECT COUNT(*),
               COALESCE(SUM(CASE WHEN grade IN (3, 4) THEN 1 ELSE 0 END), 0)
        FROM review_logs
        WHERE space_id = ?1
          AND review_time >= ?2
        ",
        params![space_id, since],
        |row| {
            let total: i64 = row.get(0)?;
            let successful: i64 = row.get(1)?;

            if total == 0 {
                return Ok(None);
            }

            Ok(Some((successful as f64 / total as f64) * 100.0))
        },
    )
}

/// Produces a seven-day activity series for charts, including empty days so the
/// frontend gets a stable shape every time.
fn load_review_activity_7d(
    connection: &Connection,
    space_id: &str,
    now: i64,
) -> rusqlite::Result<Vec<i64>> {
    let mut statement = connection.prepare(
        "
        WITH RECURSIVE offsets(value) AS (
          SELECT 0
          UNION ALL
          SELECT value + 1 FROM offsets WHERE value < 6
        )
        SELECT COALESCE(
          (
            SELECT COUNT(*)
            FROM review_logs
            WHERE space_id = ?1
              AND date(review_time / 1000, 'unixepoch', 'localtime') =
                  date(?2 / 1000, 'unixepoch', 'localtime', printf('-%d day', 6 - offsets.value))
          ),
          0
        ) AS review_count
        FROM offsets
        ORDER BY offsets.value ASC
        ",
    )?;
    let rows = statement.query_map(params![space_id, now], |row| row.get::<_, i64>(0))?;

    rows.collect()
}

/// Returns the most recent study days for either one space or the whole app.
/// This feeds the heatmap-style history used in dashboard views.
fn load_recent_study_days(
    connection: &Connection,
    space_id: Option<&str>,
    limit: i64,
) -> rusqlite::Result<Vec<String>> {
    let mut statement = connection.prepare(
        "
        SELECT day
        FROM study_days
        WHERE ((?1 IS NULL AND space_id IS NULL) OR space_id = ?1)
        ORDER BY day DESC
        LIMIT ?2
        ",
    )?;
    let rows = statement.query_map(params![space_id, limit], |row| row.get::<_, String>(0))?;

    rows.collect()
}

/// Fetches the canonical row for a space before downstream code enriches or edits it.
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

/// Inserts a new space and immediately returns it as a summary so callers can
/// update the UI from the backend's source of truth.
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

/// Renames a space and returns the refreshed summary the UI should render next.
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

/// Deletes a space and surfaces "not found" at the storage layer so command
/// handlers can convert it into a user-facing message.
fn delete_space_row(connection: &Connection, id: &str) -> rusqlite::Result<()> {
    let deleted_rows = connection.execute("DELETE FROM spaces WHERE id = ?1", [id])?;

    if deleted_rows == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }

    Ok(())
}

/// Reads cards in the exact shape the UI wants, including the joined space name
/// and decoded scheduler fields.
fn list_card_summaries(
    connection: &Connection,
    space_id: Option<&str>,
) -> rusqlite::Result<Vec<CardSummary>> {
    let mut statement = connection.prepare(
        "
        SELECT cards.id,
               cards.space_id,
               spaces.name,
               cards.front,
               cards.back,
               cards.tags,
               cards.source,
               cards.state,
               cards.due,
               cards.stability,
               cards.difficulty,
               cards.elapsed_days,
               cards.scheduled_days,
               cards.learning_steps,
               cards.reps,
               cards.lapses,
               cards.last_review,
               cards.created_at,
               cards.updated_at
        FROM cards
        INNER JOIN spaces ON spaces.id = cards.space_id
        WHERE (?1 IS NULL OR cards.space_id = ?1)
        ORDER BY cards.updated_at DESC, cards.created_at DESC, cards.front COLLATE NOCASE ASC
        ",
    )?;
    let rows = statement.query_map([space_id], map_card_summary_row)?;

    rows.collect()
}

/// Fetches just enough card information to support follow-up writes, such as
/// touching the old space after a move or delete.
fn fetch_card_identity(connection: &Connection, id: &str) -> rusqlite::Result<CardIdentity> {
    connection.query_row(
        "
        SELECT space_id
        FROM cards
        WHERE id = ?1
        ",
        [id],
        |row| {
            Ok(CardIdentity {
                space_id: row.get(0)?,
            })
        },
    )
}

/// Reloads one card in display form after a write so callers always get the final
/// stored state back from SQLite.
fn fetch_card_summary(connection: &Connection, id: &str) -> rusqlite::Result<CardSummary> {
    connection.query_row(
        "
        SELECT cards.id,
               cards.space_id,
               spaces.name,
               cards.front,
               cards.back,
               cards.tags,
               cards.source,
               cards.state,
               cards.due,
               cards.stability,
               cards.difficulty,
               cards.elapsed_days,
               cards.scheduled_days,
               cards.learning_steps,
               cards.reps,
               cards.lapses,
               cards.last_review,
               cards.created_at,
               cards.updated_at
        FROM cards
        INNER JOIN spaces ON spaces.id = cards.space_id
        WHERE cards.id = ?1
        ",
        [id],
        map_card_summary_row,
    )
}

/// Centralizes the mapping from a joined cards query into the response model the
/// frontend expects, especially around tag decoding.
fn map_card_summary_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<CardSummary> {
    let tags_json = row.get::<_, Option<String>>(5)?;

    Ok(CardSummary {
        id: row.get(0)?,
        space_id: row.get(1)?,
        space_name: row.get(2)?,
        front: row.get(3)?,
        back: row.get(4)?,
        tags: decode_tags(tags_json)?,
        source: row.get(6)?,
        state: row.get(7)?,
        due: row.get(8)?,
        stability: row.get(9)?,
        difficulty: row.get(10)?,
        elapsed_days: row.get(11)?,
        scheduled_days: row.get(12)?,
        learning_steps: row.get(13)?,
        reps: row.get(14)?,
        lapses: row.get(15)?,
        last_review: row.get(16)?,
        created_at: row.get(17)?,
        updated_at: row.get(18)?,
    })
}

/// Creates a card inside a transaction so the insert and the owning space's
/// timestamp update succeed or fail together.
fn create_card_row(
    connection: &mut Connection,
    input: NormalizedCardInput,
) -> rusqlite::Result<CardSummary> {
    fetch_space_identity(connection, &input.space_id)?;

    let id = nanoid!(12);
    let timestamp = now_ms();
    let tags_json = encode_tags(&input.tags)?;
    let transaction = connection.transaction()?;

    transaction.execute(
        "
        INSERT INTO cards (
          id,
          space_id,
          front,
          back,
          tags,
          source,
          state,
          due,
          stability,
          difficulty,
          elapsed_days,
          scheduled_days,
          learning_steps,
          reps,
          lapses,
          last_review,
          created_at,
          updated_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7, 0, 0, 0, 0, 0, 0, 0, NULL, ?7, ?7)
        ",
        params![
            id,
            input.space_id,
            input.front,
            input.back,
            tags_json,
            input.source,
            timestamp
        ],
    )?;
    touch_space(&transaction, &input.space_id, timestamp)?;
    transaction.commit()?;

    fetch_card_summary(connection, &id)
}

/// Updates card content, handles cross-space moves, and refreshes whichever space
/// records were affected so list ordering stays accurate.
fn update_card_row(
    connection: &mut Connection,
    input: NormalizedCardUpdateInput,
) -> rusqlite::Result<CardSummary> {
    let existing = fetch_card_identity(connection, &input.id)?;
    fetch_space_identity(connection, &input.space_id)?;

    let timestamp = now_ms();
    let tags_json = encode_tags(&input.tags)?;
    let transaction = connection.transaction()?;
    let updated_rows = transaction.execute(
        "
        UPDATE cards
        SET space_id = ?1,
            front = ?2,
            back = ?3,
            tags = ?4,
            updated_at = ?5
        WHERE id = ?6
        ",
        params![
            input.space_id,
            input.front,
            input.back,
            tags_json,
            timestamp,
            input.id
        ],
    )?;

    if updated_rows == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }

    touch_space(&transaction, &existing.space_id, timestamp)?;
    if existing.space_id != input.space_id {
        touch_space(&transaction, &input.space_id, timestamp)?;
    }

    transaction.commit()?;

    fetch_card_summary(connection, &input.id)
}

/// Deletes a card and bumps the parent space afterward so the rest of the app can
/// notice that the collection changed.
fn delete_card_row(connection: &mut Connection, id: &str) -> rusqlite::Result<()> {
    let existing = fetch_card_identity(connection, id)?;
    let timestamp = now_ms();
    let transaction = connection.transaction()?;
    let deleted_rows = transaction.execute("DELETE FROM cards WHERE id = ?1", [id])?;

    if deleted_rows == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }

    touch_space(&transaction, &existing.space_id, timestamp)?;
    transaction.commit()?;

    Ok(())
}

/// Commits the result of a study action: it updates the card, appends a review
/// history row, records the study day, and refreshes the touched space.
fn review_card_row(
    connection: &mut Connection,
    input: NormalizedReviewCardInput,
) -> rusqlite::Result<CardSummary> {
    let existing = fetch_card_identity(connection, &input.id)?;
    let transaction = connection.transaction()?;
    let updated_rows = transaction.execute(
        "
        UPDATE cards
        SET state = ?1,
            due = ?2,
            stability = ?3,
            difficulty = ?4,
            elapsed_days = ?5,
            scheduled_days = ?6,
            learning_steps = ?7,
            reps = ?8,
            lapses = ?9,
            last_review = ?10,
            updated_at = ?11
        WHERE id = ?12
        ",
        params![
            input.state,
            input.due,
            input.stability,
            input.difficulty,
            input.elapsed_days,
            input.scheduled_days,
            input.learning_steps,
            input.reps,
            input.lapses,
            input.last_review,
            input.review_log.review_time,
            input.id
        ],
    )?;

    if updated_rows == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }

    transaction.execute(
        "
        INSERT INTO review_logs (
          id,
          card_id,
          space_id,
          grade,
          state,
          due,
          elapsed_days,
          scheduled_days,
          review_time
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
        ",
        params![
            nanoid!(12),
            input.id,
            existing.space_id,
            input.grade,
            input.review_log.state,
            input.review_log.due,
            input.review_log.elapsed_days,
            input.review_log.scheduled_days,
            input.review_log.review_time
        ],
    )?;
    upsert_study_day(
        &transaction,
        Some(&existing.space_id),
        input.review_log.review_time,
    )?;
    upsert_study_day(&transaction, None, input.review_log.review_time)?;
    touch_space(
        &transaction,
        &existing.space_id,
        input.review_log.review_time,
    )?;
    transaction.commit()?;

    fetch_card_summary(connection, &input.id)
}

/// Updates a space timestamp whenever something inside that space changes, which
/// lets the UI sort by recent activity without extra bookkeeping elsewhere.
fn touch_space(connection: &Connection, space_id: &str, timestamp: i64) -> rusqlite::Result<()> {
    let touched_rows = connection.execute(
        "
        UPDATE spaces
        SET updated_at = ?1
        WHERE id = ?2
        ",
        params![timestamp, space_id],
    )?;

    if touched_rows == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }

    Ok(())
}

/// Records that a study session happened on a given calendar day, collapsing many
/// reviews into a single "studied on this day" marker.
fn upsert_study_day(
    connection: &Connection,
    space_id: Option<&str>,
    review_time: i64,
) -> rusqlite::Result<()> {
    connection.execute(
        "
        INSERT OR IGNORE INTO study_days (space_id, day)
        VALUES (?1, date(?2 / 1000, 'unixepoch', 'localtime'))
        ",
        params![space_id, review_time],
    )?;

    Ok(())
}

/// Applies the shared naming rules for spaces so the rest of the backend can work
/// with clean, bounded values.
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

struct NormalizedCardInput {
    space_id: String,
    front: String,
    back: String,
    tags: Vec<String>,
    source: String,
}

struct NormalizedCardUpdateInput {
    id: String,
    space_id: String,
    front: String,
    back: String,
    tags: Vec<String>,
}

struct NormalizedReviewCardInput {
    id: String,
    grade: i64,
    state: i64,
    due: i64,
    stability: f64,
    difficulty: f64,
    elapsed_days: i64,
    scheduled_days: i64,
    learning_steps: i64,
    reps: i64,
    lapses: i64,
    last_review: i64,
    review_log: NormalizedReviewCardLogInput,
}

struct NormalizedReviewCardLogInput {
    state: i64,
    due: i64,
    elapsed_days: Option<i64>,
    scheduled_days: i64,
    review_time: i64,
}

struct NormalizedImportAnkiCardInput {
    deck_name: String,
    front: String,
    back: String,
    tags: Vec<String>,
}

struct ImportDeckAccumulator {
    deck_name: String,
    imported_count: i64,
    skipped_count: i64,
    space_id: String,
    space_name: String,
    total_count: i64,
}

/// Normalizes card creation input right at the boundary between the UI and storage,
/// turning loose user input into something safe to persist.
fn normalize_card_input(
    space_id: &str,
    front: &str,
    back: &str,
    tags: &[String],
    source: Option<&str>,
) -> Result<NormalizedCardInput, String> {
    let normalized_space_id = normalize_required_identifier(space_id, "Space")?;

    Ok(NormalizedCardInput {
        space_id: normalized_space_id,
        front: normalize_card_text(front, "Front")?,
        back: normalize_card_text(back, "Back")?,
        tags: normalize_tags(tags),
        source: normalize_card_source(source)?,
    })
}

/// Keeps card origin values constrained to the small set of sources the app knows
/// how to reason about.
fn normalize_card_source(source: Option<&str>) -> Result<String, String> {
    match source.unwrap_or("manual") {
        "manual" | "ai" | "anki" => Ok(source.unwrap_or("manual").to_string()),
        _ => Err("Card source must be manual, ai, or anki.".to_string()),
    }
}

/// Reuses the same normalization rules for card edits so updating a card cannot
/// sneak around the invariants enforced at creation time.
fn normalize_card_update_input(
    input: &UpdateCardInput,
) -> Result<NormalizedCardUpdateInput, String> {
    Ok(NormalizedCardUpdateInput {
        id: normalize_required_identifier(&input.id, "Card")?,
        space_id: normalize_required_identifier(&input.space_id, "Space")?,
        front: normalize_card_text(&input.front, "Front")?,
        back: normalize_card_text(&input.back, "Back")?,
        tags: normalize_tags(&input.tags),
    })
}

/// Validates scheduler data coming back from the frontend before it becomes the
/// app's persisted study history.
fn normalize_review_card_input(
    input: &ReviewCardInput,
) -> Result<NormalizedReviewCardInput, String> {
    Ok(NormalizedReviewCardInput {
        id: normalize_required_identifier(&input.id, "Card")?,
        grade: normalize_grade(input.grade)?,
        state: normalize_card_state(input.state)?,
        due: normalize_timestamp(input.due, "Due")?,
        stability: normalize_non_negative_number(input.stability, "Stability")?,
        difficulty: normalize_non_negative_number(input.difficulty, "Difficulty")?,
        elapsed_days: normalize_non_negative_integer(input.elapsed_days, "Elapsed days")?,
        scheduled_days: normalize_non_negative_integer(input.scheduled_days, "Scheduled days")?,
        learning_steps: normalize_non_negative_integer(input.learning_steps, "Learning steps")?,
        reps: normalize_non_negative_integer(input.reps, "Reps")?,
        lapses: normalize_non_negative_integer(input.lapses, "Lapses")?,
        last_review: normalize_timestamp(input.last_review, "Last review")?,
        review_log: NormalizedReviewCardLogInput {
            state: normalize_card_state(input.review_log.state)?,
            due: normalize_timestamp(input.review_log.due, "Review due")?,
            elapsed_days: match input.review_log.elapsed_days {
                Some(value) => Some(normalize_non_negative_integer(
                    value,
                    "Review elapsed days",
                )?),
                None => None,
            },
            scheduled_days: normalize_non_negative_integer(
                input.review_log.scheduled_days,
                "Review scheduled days",
            )?,
            review_time: normalize_timestamp(input.review_log.review_time, "Review time")?,
        },
    })
}

/// Cleans imported Anki cards before any transaction starts so import failures
/// happen early and with user-friendly validation messages.
fn normalize_import_anki_cards(
    cards: &[ImportAnkiCardInput],
) -> Result<Vec<NormalizedImportAnkiCardInput>, String> {
    cards
        .iter()
        .map(|card| {
            Ok(NormalizedImportAnkiCardInput {
                deck_name: normalize_space_name(&card.deck_name)?,
                front: normalize_card_text(&card.front, "Front")?,
                back: normalize_card_text(&card.back, "Back")?,
                tags: normalize_tags(&card.tags),
            })
        })
        .collect()
}

fn normalize_required_identifier(value: &str, label: &str) -> Result<String, String> {
    let trimmed = value.trim();

    if trimmed.is_empty() {
        return Err(format!("{label} identifier is required."));
    }

    Ok(trimmed.to_string())
}

fn normalize_grade(value: i64) -> Result<i64, String> {
    if (1..=4).contains(&value) {
        return Ok(value);
    }

    Err("Grade must be between 1 and 4.".to_string())
}

fn normalize_card_state(value: i64) -> Result<i64, String> {
    if (0..=3).contains(&value) {
        return Ok(value);
    }

    Err("Card state must be between 0 and 3.".to_string())
}

fn normalize_timestamp(value: i64, label: &str) -> Result<i64, String> {
    if value > 0 {
        return Ok(value);
    }

    Err(format!("{label} must be a positive timestamp."))
}

fn normalize_non_negative_integer(value: i64, label: &str) -> Result<i64, String> {
    if value >= 0 {
        return Ok(value);
    }

    Err(format!("{label} must be zero or greater."))
}

fn normalize_non_negative_number(value: f64, label: &str) -> Result<f64, String> {
    if value.is_finite() && value >= 0.0 {
        return Ok(value);
    }

    Err(format!("{label} must be a finite non-negative number."))
}

fn normalize_card_text(value: &str, label: &str) -> Result<String, String> {
    let trimmed = value.trim();

    if trimmed.is_empty() {
        return Err(format!("{label} can't be empty."));
    }

    Ok(trimmed.to_string())
}

/// Drops empty tags and duplicates so tag storage stays tidy no matter how messy
/// the incoming UI or import payload was.
fn normalize_tags(tags: &[String]) -> Vec<String> {
    let mut normalized = Vec::new();

    for tag in tags {
        let trimmed = tag.trim();

        if trimmed.is_empty() || normalized.iter().any(|existing| existing == trimmed) {
            continue;
        }

        normalized.push(trimmed.to_string());
    }

    normalized
}

/// Imports Anki cards in bulk while mapping decks to spaces, skipping duplicates,
/// and returning a summary the UI can explain back to the user.
fn import_anki_cards_row(
    connection: &mut Connection,
    _source_file_name: &str,
    cards: Vec<NormalizedImportAnkiCardInput>,
) -> rusqlite::Result<ImportAnkiResult> {
    let timestamp = now_ms();
    let transaction = connection.transaction()?;
    let existing_spaces = load_all_space_identities(&transaction)?;
    let mut spaces_by_name = existing_spaces
        .into_iter()
        .map(|space| (space.name.to_ascii_lowercase(), space))
        .collect::<HashMap<_, _>>();
    let mut existing_pairs_by_space = HashMap::<String, HashSet<String>>::new();
    let mut deck_order = Vec::<String>::new();
    let mut deck_stats = HashMap::<String, ImportDeckAccumulator>::new();
    let mut created_space_count = 0_i64;
    let mut touched_space_ids = HashSet::<String>::new();

    for card in cards {
        let deck_key = card.deck_name.to_ascii_lowercase();
        let space = match spaces_by_name.get(&deck_key) {
            Some(existing) => existing.clone(),
            None => {
                let created = insert_space_identity(&transaction, &card.deck_name, timestamp)?;
                spaces_by_name.insert(deck_key.clone(), created.clone());
                created_space_count += 1;
                created
            }
        };

        let existing_pairs = match existing_pairs_by_space.entry(space.id.clone()) {
            std::collections::hash_map::Entry::Occupied(entry) => entry.into_mut(),
            std::collections::hash_map::Entry::Vacant(entry) => {
                entry.insert(load_space_card_pairs(&transaction, &space.id)?)
            }
        };

        let stats = deck_stats.entry(deck_key.clone()).or_insert_with(|| {
            deck_order.push(deck_key.clone());
            ImportDeckAccumulator {
                deck_name: card.deck_name.clone(),
                imported_count: 0,
                skipped_count: 0,
                space_id: space.id.clone(),
                space_name: space.name.clone(),
                total_count: 0,
            }
        });

        stats.total_count += 1;

        let pair_key = card_pair_key(&card.front, &card.back);

        if existing_pairs.contains(&pair_key) {
            stats.skipped_count += 1;
            continue;
        }

        insert_imported_anki_card(
            &transaction,
            &space.id,
            &card.front,
            &card.back,
            &card.tags,
            timestamp,
        )?;
        existing_pairs.insert(pair_key);
        touched_space_ids.insert(space.id.clone());
        stats.imported_count += 1;
    }

    for space_id in touched_space_ids {
        touch_space(&transaction, &space_id, timestamp)?;
    }

    transaction.commit()?;

    let mut decks = Vec::new();

    for deck_key in deck_order {
        if let Some(deck) = deck_stats.remove(&deck_key) {
            decks.push(ImportDeckResult {
                deck_name: deck.deck_name,
                imported_count: deck.imported_count,
                skipped_count: deck.skipped_count,
                space_id: deck.space_id,
                space_name: deck.space_name,
                total_count: deck.total_count,
            });
        }
    }

    let imported_count = decks.iter().map(|deck| deck.imported_count).sum();
    let duplicate_count = decks.iter().map(|deck| deck.skipped_count).sum();

    Ok(ImportAnkiResult {
        created_space_count,
        deck_count: decks.len() as i64,
        decks,
        duplicate_count,
        imported_count,
    })
}

/// Loads all spaces in a lightweight shape for backend workflows that need to
/// reason about identities before building richer summaries.
fn load_all_space_identities(connection: &Connection) -> rusqlite::Result<Vec<SpaceIdentity>> {
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

    rows.collect()
}

/// Creates a bare space row inside an existing transaction, which is useful during
/// import where space creation is only one step in a larger unit of work.
fn insert_space_identity(
    transaction: &rusqlite::Transaction<'_>,
    name: &str,
    timestamp: i64,
) -> rusqlite::Result<SpaceIdentity> {
    let id = nanoid!(12);
    transaction.execute(
        "
        INSERT INTO spaces (id, name, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4)
        ",
        params![id, name, timestamp, timestamp],
    )?;

    Ok(SpaceIdentity {
        id,
        name: name.to_string(),
        created_at: timestamp,
        updated_at: timestamp,
    })
}

/// Builds an in-memory set of front/back pairs so import can cheaply detect
/// duplicates without querying for every incoming card.
fn load_space_card_pairs(
    transaction: &rusqlite::Transaction<'_>,
    space_id: &str,
) -> rusqlite::Result<HashSet<String>> {
    let mut statement = transaction.prepare(
        "
        SELECT front, back
        FROM cards
        WHERE space_id = ?1
        ",
    )?;
    let rows = statement.query_map([space_id], |row| {
        let front: String = row.get(0)?;
        let back: String = row.get(1)?;
        Ok(card_pair_key(&front, &back))
    })?;

    rows.collect()
}

/// Inserts a card with the app's default scheduler fields for freshly imported
/// Anki content.
fn insert_imported_anki_card(
    transaction: &rusqlite::Transaction<'_>,
    space_id: &str,
    front: &str,
    back: &str,
    tags: &[String],
    timestamp: i64,
) -> rusqlite::Result<()> {
    let id = nanoid!(12);
    let tags_json = encode_tags(tags)?;

    transaction.execute(
        "
        INSERT INTO cards (
          id,
          space_id,
          front,
          back,
          tags,
          source,
          state,
          due,
          stability,
          difficulty,
          elapsed_days,
          scheduled_days,
          learning_steps,
          reps,
          lapses,
          last_review,
          created_at,
          updated_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, 'anki', 0, ?6, 0, 0, 0, 0, 0, 0, 0, NULL, ?6, ?6)
        ",
        params![id, space_id, front, back, tags_json, timestamp],
    )?;

    Ok(())
}

/// Creates a stable duplicate-detection key from a card's visible content.
fn card_pair_key(front: &str, back: &str) -> String {
    format!("{front}\u{001f}{back}")
}

/// Stores tags as JSON so SQLite keeps one nullable column while the Rust side
/// keeps working with a plain vector.
fn encode_tags(tags: &[String]) -> rusqlite::Result<Option<String>> {
    if tags.is_empty() {
        return Ok(None);
    }

    serde_json::to_string(tags)
        .map(Some)
        .map_err(|error| rusqlite::Error::ToSqlConversionFailure(Box::new(error)))
}

/// Reverses `encode_tags`, defaulting to an empty list when the column is unset.
fn decode_tags(tags_json: Option<String>) -> rusqlite::Result<Vec<String>> {
    match tags_json {
        Some(json) if !json.trim().is_empty() => serde_json::from_str(&json).map_err(|error| {
            rusqlite::Error::FromSqlConversionFailure(
                json.len(),
                rusqlite::types::Type::Text,
                Box::new(error),
            )
        }),
        _ => Ok(Vec::new()),
    }
}

/// Translates low-level SQLite errors about spaces into messages that make sense
/// to a person using the app.
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

/// Gives card-related commands the same friendlier error surface instead of
/// exposing raw database wording.
fn map_card_storage_error(error: rusqlite::Error) -> String {
    match error {
        rusqlite::Error::SqliteFailure(sqlite_error, _)
            if sqlite_error.code == ErrorCode::ConstraintViolation =>
        {
            "The requested change violates a database constraint.".to_string()
        }
        rusqlite::Error::QueryReturnedNoRows => "Card or space not found.".to_string(),
        other => other.to_string(),
    }
}

/// Provides a single millisecond timestamp helper so all persisted times are
/// captured in the same format.
fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock drifted backwards")
        .as_millis() as i64
}
