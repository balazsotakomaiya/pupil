use rusqlite::{params, Connection, Transaction};

use crate::error::{AppError, AppResult};
use crate::util::now_ms;

#[derive(Clone, Copy)]
pub(crate) enum MigrationAction {
    Sql(&'static str),
    Rust(fn(&Transaction<'_>) -> AppResult<()>),
}

#[derive(Clone, Copy)]
pub(crate) struct Migration {
    pub(crate) id: &'static str,
    pub(crate) requires_backup: bool,
    pub(crate) action: MigrationAction,
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

pub(crate) fn pending_migrations<'a>(
    migrations: &'a [Migration],
    applied_migrations: &[String],
) -> Vec<&'a Migration> {
    migrations
        .iter()
        .filter(|migration| !applied_migrations.iter().any(|id| id == migration.id))
        .collect()
}

pub(crate) fn pending_migration_ids(
    migrations: &[Migration],
    applied_migrations: &[String],
) -> Vec<String> {
    pending_migrations(migrations, applied_migrations)
        .into_iter()
        .map(|migration| migration.id.to_string())
        .collect()
}

/// Applies all pending migrations in registry order. The actions and ledger
/// entries commit together, so a failed startup safely retries from the last
/// committed migration state.
pub(crate) fn apply_migrations(
    connection: &mut Connection,
    migrations: &[Migration],
) -> AppResult<()> {
    ensure_schema_migrations_table(connection)?;
    let applied_migrations = load_applied_migrations(connection)?;
    let pending = pending_migrations(migrations, &applied_migrations);

    if pending.is_empty() {
        return Ok(());
    }

    let transaction = connection.transaction()?;
    for migration in pending {
        tracing::info!(migration_id = migration.id, "applying migration");
        apply_migration_action(&transaction, migration)
            .map_err(|error| AppError::migration_failed(format!("{}: {error}", migration.id)))?;
        transaction
            .execute(
                "INSERT INTO schema_migrations (id, applied_at) VALUES (?1, ?2)",
                params![migration.id, now_ms()],
            )
            .map_err(|error| AppError::migration_failed(format!("{}: {error}", migration.id)))?;
    }
    transaction
        .commit()
        .map_err(|error| AppError::migration_failed(error.to_string()))
}

fn apply_migration_action(transaction: &Transaction<'_>, migration: &Migration) -> AppResult<()> {
    match migration.action {
        MigrationAction::Sql(sql) => transaction.execute_batch(sql).map_err(AppError::from),
        MigrationAction::Rust(action) => action(transaction),
    }
}
