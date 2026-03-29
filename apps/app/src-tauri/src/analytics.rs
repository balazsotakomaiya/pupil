use rusqlite::{params, Connection};

use crate::spaces::load_all_space_identities;
use crate::types::{DashboardStats, SpaceStats};
use crate::util::now_ms;

pub(crate) fn load_space_counts(
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

pub(crate) fn load_space_streak(connection: &Connection, space_id: &str) -> rusqlite::Result<i64> {
    load_streak(connection, Some(space_id))
}

pub(crate) fn load_dashboard_stats(
    connection: &Connection,
    now: i64,
) -> rusqlite::Result<DashboardStats> {
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

pub(crate) fn list_space_stats_rows(
    connection: &Connection,
    now: i64,
) -> rusqlite::Result<Vec<SpaceStats>> {
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
