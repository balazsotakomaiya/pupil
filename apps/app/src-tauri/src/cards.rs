use nanoid::nanoid;
use rusqlite::{params, Connection};

use crate::spaces::{fetch_space_identity, touch_space};
use crate::types::{
    CardIdentity, CardSummary, NormalizedCardInput, NormalizedCardUpdateInput,
    NormalizedReviewCardInput,
};
use crate::util::{decode_tags, encode_tags, now_ms};

pub(crate) fn list_card_summaries(
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
               cards.updated_at,
               cards.is_suspended
        FROM cards
        INNER JOIN spaces ON spaces.id = cards.space_id
        WHERE (?1 IS NULL OR cards.space_id = ?1)
        ORDER BY cards.updated_at DESC, cards.created_at DESC, cards.front COLLATE NOCASE ASC
        ",
    )?;
    let rows = statement.query_map([space_id], map_card_summary_row)?;

    rows.collect()
}

pub(crate) fn create_card_row(
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

pub(crate) fn update_card_row(
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

pub(crate) fn delete_card_row(connection: &mut Connection, id: &str) -> rusqlite::Result<()> {
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

pub(crate) fn suspend_card_row(
    connection: &mut Connection,
    id: &str,
    suspended: bool,
) -> rusqlite::Result<CardSummary> {
    let timestamp = now_ms();
    let is_suspended: i64 = if suspended { 1 } else { 0 };
    let updated_rows = connection.execute(
        "UPDATE cards SET is_suspended = ?1, updated_at = ?2 WHERE id = ?3",
        params![is_suspended, timestamp, id],
    )?;

    if updated_rows == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }

    fetch_card_summary(connection, id)
}

pub(crate) fn review_card_row(
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
               cards.updated_at,
               cards.is_suspended
        FROM cards
        INNER JOIN spaces ON spaces.id = cards.space_id
        WHERE cards.id = ?1
        ",
        [id],
        map_card_summary_row,
    )
}

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
        is_suspended: row.get::<_, i64>(19).unwrap_or(0) != 0,
    })
}

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
