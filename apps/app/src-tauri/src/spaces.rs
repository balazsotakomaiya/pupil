use nanoid::nanoid;
use rusqlite::{params, Connection};

use crate::analytics::{load_space_counts, load_space_streak};
use crate::types::{SpaceIdentity, SpaceSummary};
use crate::util::now_ms;

pub(crate) fn list_space_summaries(connection: &Connection) -> rusqlite::Result<Vec<SpaceSummary>> {
    let spaces = load_all_space_identities(connection)?;
    let current_time = now_ms();

    spaces
        .into_iter()
        .map(|space| hydrate_space_summary(connection, space, current_time))
        .collect()
}

pub(crate) fn fetch_space_identity(
    connection: &Connection,
    id: &str,
) -> rusqlite::Result<SpaceIdentity> {
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

pub(crate) fn create_space_row(
    connection: &Connection,
    name: &str,
) -> rusqlite::Result<SpaceSummary> {
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

pub(crate) fn rename_space_row(
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

pub(crate) fn delete_space_row(connection: &Connection, id: &str) -> rusqlite::Result<()> {
    let deleted_rows = connection.execute("DELETE FROM spaces WHERE id = ?1", [id])?;

    if deleted_rows == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }

    Ok(())
}

pub(crate) fn load_all_space_identities(
    connection: &Connection,
) -> rusqlite::Result<Vec<SpaceIdentity>> {
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

pub(crate) fn insert_space_identity(
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

pub(crate) fn touch_space(
    connection: &Connection,
    space_id: &str,
    timestamp: i64,
) -> rusqlite::Result<()> {
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
