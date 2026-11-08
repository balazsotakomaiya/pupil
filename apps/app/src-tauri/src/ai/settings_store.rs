//! Small helpers for the key/value `settings` table shared by the AI modules.

use rusqlite::{params, Connection};

pub(crate) fn load_string_setting(
    connection: &Connection,
    key: &str,
    default: &str,
) -> rusqlite::Result<String> {
    connection
        .query_row("SELECT value FROM settings WHERE key = ?1", [key], |row| {
            row.get::<_, String>(0)
        })
        .or_else(|error| match error {
            rusqlite::Error::QueryReturnedNoRows => Ok(default.to_string()),
            other => Err(other),
        })
}

pub(crate) fn load_bool_setting(
    connection: &Connection,
    key: &str,
    default: bool,
) -> rusqlite::Result<bool> {
    let raw = load_string_setting(connection, key, if default { "1" } else { "0" })?;
    Ok(matches!(raw.as_str(), "1" | "true" | "yes"))
}

/// Works on a plain connection or, through deref, inside a transaction.
pub(crate) fn upsert_setting_on(
    connection: &Connection,
    key: &str,
    value: &str,
) -> rusqlite::Result<()> {
    connection.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}

pub(crate) fn delete_setting(connection: &Connection, key: &str) -> rusqlite::Result<()> {
    connection.execute("DELETE FROM settings WHERE key = ?1", [key])?;
    Ok(())
}
