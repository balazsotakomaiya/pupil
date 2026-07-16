use rusqlite::Connection;

use crate::error::{AppError, AppResult};
use crate::migration_runner::{
    apply_migrations, load_applied_migrations, Migration, MigrationAction,
};
use crate::migrations::MIGRATIONS;
use crate::types::parse_persisted_explain_card_payload;

fn insert_seed(transaction: &rusqlite::Transaction<'_>) -> AppResult<()> {
    transaction.execute("INSERT INTO migration_test VALUES ('rust')", [])?;
    Ok(())
}

fn failing_action(transaction: &rusqlite::Transaction<'_>) -> AppResult<()> {
    transaction.execute("INSERT INTO migration_test VALUES ('uncommitted')", [])?;
    Err(AppError::internal_message("intentional test failure"))
}

#[test]
fn mixed_migrations_run_in_order_and_record_each_id() {
    let mut connection = Connection::open_in_memory().expect("open in-memory database");
    let migrations = [
        Migration {
            id: "test_001",
            requires_backup: false,
            action: MigrationAction::Sql("CREATE TABLE migration_test (value TEXT NOT NULL);"),
        },
        Migration {
            id: "test_002",
            requires_backup: true,
            action: MigrationAction::Rust(insert_seed),
        },
        Migration {
            id: "test_003",
            requires_backup: false,
            action: MigrationAction::Sql("INSERT INTO migration_test VALUES ('sql');"),
        },
    ];

    apply_migrations(&mut connection, &migrations).expect("apply migrations");

    let values = connection
        .prepare("SELECT value FROM migration_test ORDER BY rowid")
        .expect("prepare values")
        .query_map([], |row| row.get::<_, String>(0))
        .expect("query values")
        .collect::<rusqlite::Result<Vec<_>>>()
        .expect("collect values");
    assert_eq!(values, ["rust", "sql"]);
    assert_eq!(
        load_applied_migrations(&connection).expect("load ledger"),
        ["test_001", "test_002", "test_003"]
    );
    assert!(migrations[1].requires_backup);
}

#[test]
fn failed_migration_rolls_back_its_writes_and_the_ledger() {
    let mut connection = Connection::open_in_memory().expect("open in-memory database");
    let migrations = [
        Migration {
            id: "test_001",
            requires_backup: false,
            action: MigrationAction::Sql("CREATE TABLE migration_test (value TEXT NOT NULL);"),
        },
        Migration {
            id: "test_002",
            requires_backup: true,
            action: MigrationAction::Rust(failing_action),
        },
    ];

    let error = apply_migrations(&mut connection, &migrations).expect_err("migration fails");

    assert!(error.to_string().contains("test_002"));
    assert!(connection
        .prepare("SELECT value FROM migration_test")
        .is_err());
    assert!(load_applied_migrations(&connection)
        .expect("load ledger")
        .is_empty());
}

fn valid_payload() -> String {
    serde_json::json!({
        "schemaVersion": 1,
        "paragraphs": [
            "The first paragraph gives context.",
            "The second paragraph explains the relationship.",
            "The third paragraph closes the explanation."
        ],
        "visual": null
    })
    .to_string()
}

fn connection_through_0005() -> Connection {
    let mut connection = Connection::open_in_memory().expect("open in-memory database");
    apply_migrations(&mut connection, &MIGRATIONS[..5]).expect("apply schema migrations");
    connection
        .execute(
            "INSERT INTO spaces (id, name, created_at, updated_at) VALUES ('space-a', 'Space A', 1, 1)",
            [],
        )
        .expect("seed space");
    for id in ["legacy", "valid", "invalid"] {
        connection
            .execute(
                "INSERT INTO cards (id, space_id, front, back, tags, source, state, due, stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses, last_review, created_at, updated_at, is_suspended) VALUES (?1, 'space-a', 'Front', 'Back', NULL, 'manual', 0, 1, 0, 0, 0, 0, 0, 0, 0, NULL, 1, 1, 0)",
                [id],
            )
            .expect("seed card");
    }
    connection
        .execute(
            "UPDATE cards SET explanation = ?1, explanation_generated_at = 42 WHERE id = 'legacy'",
            ["First paragraph.\n\nSecond paragraph.\n\nThird paragraph."],
        )
        .expect("seed legacy cache");
    connection
        .execute(
            "UPDATE cards SET explanation = 'obsolete prose', explanation_payload = ?1, explanation_generated_at = 43 WHERE id = 'valid'",
            [valid_payload()],
        )
        .expect("seed valid payload");
    connection
        .execute(
            "UPDATE cards SET explanation = 'unsafe legacy', explanation_payload = 'not JSON', explanation_generated_at = 44 WHERE id = 'invalid'",
            [],
        )
        .expect("seed invalid cache");
    connection
}

#[test]
fn explanation_cache_migration_converts_preserves_clears_and_is_idempotent() {
    let mut connection = connection_through_0005();

    apply_migrations(&mut connection, MIGRATIONS).expect("apply payload migration");

    let (legacy_explanation, legacy_payload, legacy_timestamp): (Option<String>, String, Option<i64>) =
        connection
            .query_row(
                "SELECT explanation, explanation_payload, explanation_generated_at FROM cards WHERE id = 'legacy'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .expect("read converted cache");
    assert!(legacy_explanation.is_none());
    assert_eq!(legacy_timestamp, Some(42));
    assert_eq!(
        parse_persisted_explain_card_payload(&legacy_payload)
            .expect("valid converted payload")
            .visual,
        None
    );

    let (valid_explanation, stored_valid_payload, valid_timestamp): (Option<String>, String, Option<i64>) =
        connection
            .query_row(
                "SELECT explanation, explanation_payload, explanation_generated_at FROM cards WHERE id = 'valid'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .expect("read valid cache");
    assert!(valid_explanation.is_none());
    assert_eq!(stored_valid_payload, valid_payload());
    assert_eq!(valid_timestamp, Some(43));

    let invalid_cache: (Option<String>, Option<String>, Option<i64>) = connection
        .query_row(
            "SELECT explanation, explanation_payload, explanation_generated_at FROM cards WHERE id = 'invalid'",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .expect("read invalid cache");
    assert_eq!(invalid_cache, (None, None, None));

    assert!(parse_persisted_explain_card_payload(&format!("prefix {}", valid_payload())).is_err());
    apply_migrations(&mut connection, MIGRATIONS).expect("skip applied migration");
    assert_eq!(
        connection
            .query_row(
                "SELECT explanation_payload FROM cards WHERE id = 'legacy'",
                [],
                |row| row.get::<_, String>(0),
            )
            .expect("read unchanged payload"),
        legacy_payload
    );
    assert_eq!(
        load_applied_migrations(&connection).expect("load ledger"),
        [
            "0001_init",
            "0002_add_learning_steps",
            "0003_add_suspended",
            "0004_add_card_explanation",
            "0005_add_card_explanation_payload",
            "0006_migrate_card_explanation_payloads",
        ]
    );
}
