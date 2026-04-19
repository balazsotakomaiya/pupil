use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use rusqlite::Connection;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};

use crate::ai::clear_ai_api_key;
use crate::app::app_data_dir;
use crate::constants::{
    MIN_RECENT_ACTIVITY_FETCH_LIMIT, RECENT_ACTIVITY_FETCH_MULTIPLIER,
    RECENT_ACTIVITY_SESSION_GAP_MS,
};
use crate::error::AppResult;
use crate::types::{RecentActivityEntry, SettingsDataSummary};

pub(crate) fn load_recent_activity(
    connection: &Connection,
    limit: i64,
) -> rusqlite::Result<Vec<RecentActivityEntry>> {
    if limit <= 0 {
        return Ok(Vec::new());
    }

    let fetch_limit =
        (limit * RECENT_ACTIVITY_FETCH_MULTIPLIER).max(MIN_RECENT_ACTIVITY_FETCH_LIMIT);
    let mut statement = connection.prepare(
        "
        SELECT review_logs.space_id,
               spaces.name,
               review_logs.review_time
        FROM review_logs
        INNER JOIN spaces ON spaces.id = review_logs.space_id
        ORDER BY review_logs.review_time DESC
        LIMIT ?1
        ",
    )?;
    let mut rows = statement.query([fetch_limit])?;
    let mut sessions: Vec<RecentActivityEntry> = Vec::new();

    while let Some(row) = rows.next()? {
        let space_id: String = row.get(0)?;
        let space_name: String = row.get(1)?;
        let review_time: i64 = row.get(2)?;

        let belongs_to_last_session = sessions.last().is_some_and(|current| {
            current.space_id == space_id
                && current.review_time - review_time <= RECENT_ACTIVITY_SESSION_GAP_MS
        });

        if belongs_to_last_session {
            if let Some(current) = sessions.last_mut() {
                current.review_count += 1;
            }
            continue;
        }

        if sessions.len() >= limit as usize {
            break;
        }

        sessions.push(RecentActivityEntry {
            id: format!("{space_id}:{review_time}"),
            review_count: 1,
            review_time,
            space_id,
            space_name,
        });
    }

    Ok(sessions)
}

pub(crate) fn load_settings_data_summary(
    connection: &Connection,
    database_path: &Path,
) -> rusqlite::Result<SettingsDataSummary> {
    let review_log_count = connection.query_row("SELECT COUNT(*) FROM review_logs", [], |row| {
        row.get::<_, i64>(0)
    })?;

    Ok(SettingsDataSummary {
        database_path: database_path.display().to_string(),
        review_log_count,
    })
}

pub(crate) fn export_dir(app: &AppHandle) -> AppResult<PathBuf> {
    match app.path().resolve("Pupil", BaseDirectory::Download) {
        Ok(path) => Ok(path),
        Err(_) => Ok(app_data_dir(app)?.join("exports")),
    }
}

pub(crate) fn write_review_logs_csv(connection: &Connection, path: &Path) -> AppResult<i64> {
    let mut statement = connection.prepare(
        "
        SELECT review_logs.review_time,
               review_logs.space_id,
               spaces.name,
               review_logs.card_id,
               cards.front,
               review_logs.grade,
               review_logs.state,
               review_logs.due,
               review_logs.elapsed_days,
               review_logs.scheduled_days
        FROM review_logs
        INNER JOIN spaces ON spaces.id = review_logs.space_id
        INNER JOIN cards ON cards.id = review_logs.card_id
        ORDER BY review_logs.review_time DESC
        ",
    )?;
    let mut rows = statement.query([])?;
    let mut file = fs::File::create(path)?;
    let mut count = 0_i64;

    writeln!(
        file,
        "review_time,space_id,space_name,card_id,card_front,grade,state,due,elapsed_days,scheduled_days"
    )?;

    while let Some(row) = rows.next()? {
        writeln!(
            file,
            "{},{},{},{},{},{},{},{},{},{}",
            csv_escape(&row.get::<_, i64>(0)?.to_string()),
            csv_escape(&row.get::<_, String>(1)?),
            csv_escape(&row.get::<_, String>(2)?),
            csv_escape(&row.get::<_, String>(3)?),
            csv_escape(&row.get::<_, String>(4)?),
            csv_escape(&row.get::<_, i64>(5)?.to_string()),
            csv_escape(&row.get::<_, i64>(6)?.to_string()),
            csv_escape(&row.get::<_, i64>(7)?.to_string()),
            csv_escape(
                &row.get::<_, Option<i64>>(8)?
                    .map(|value| value.to_string())
                    .unwrap_or_default()
            ),
            csv_escape(
                &row.get::<_, Option<i64>>(9)?
                    .map(|value| value.to_string())
                    .unwrap_or_default()
            ),
        )?;
        count += 1;
    }

    Ok(count)
}

pub(crate) fn load_new_cards_limit(connection: &Connection) -> rusqlite::Result<Option<i64>> {
    let result: rusqlite::Result<String> = connection.query_row(
        "SELECT value FROM settings WHERE key = 'study.new_cards_limit'",
        [],
        |row| row.get(0),
    );

    match result {
        Ok(value) => Ok(value.parse::<i64>().ok().filter(|&v| v > 0)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(error) => Err(error),
    }
}

pub(crate) fn save_new_cards_limit(
    connection: &Connection,
    limit: Option<i64>,
) -> rusqlite::Result<()> {
    match limit {
        Some(value) => {
            connection.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES ('study.new_cards_limit', ?1)",
                [value.to_string()],
            )?;
        }
        None => {
            connection.execute(
                "DELETE FROM settings WHERE key = 'study.new_cards_limit'",
                [],
            )?;
        }
    }

    Ok(())
}

pub(crate) fn load_today_new_card_count(connection: &Connection) -> rusqlite::Result<i64> {
    connection.query_row(
        "
        SELECT COUNT(DISTINCT card_id)
        FROM review_logs
        WHERE state = 0
          AND date(review_time / 1000, 'unixepoch', 'localtime') = date('now', 'localtime')
        ",
        [],
        |row| row.get(0),
    )
}

pub(crate) fn reset_all_data_rows(app: &AppHandle, connection: &mut Connection) -> AppResult<()> {
    clear_ai_api_key(app)?;

    let transaction = connection.transaction()?;
    transaction.execute_batch(
        "
        DELETE FROM review_logs;
        DELETE FROM study_days;
        DELETE FROM cards;
        DELETE FROM spaces;
        DELETE FROM settings;
        ",
    )?;
    transaction.commit()?;

    Ok(())
}

fn csv_escape(value: &str) -> String {
    let escaped = value.replace('"', "\"\"");

    format!("\"{escaped}\"")
}
