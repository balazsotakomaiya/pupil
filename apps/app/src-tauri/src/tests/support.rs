use rusqlite::{params, Connection};

use crate::migration_runner::apply_migrations;
use crate::migrations::MIGRATIONS;

pub(crate) const TEST_NOW: i64 = 1_700_000_000_000;

pub(crate) fn open_test_connection() -> Connection {
    let mut connection = Connection::open_in_memory().expect("open in-memory database");
    apply_migrations(&mut connection, MIGRATIONS).expect("apply migrations");
    connection
}

pub(crate) fn seed_space(connection: &Connection, id: &str, name: &str, timestamp: i64) {
    connection
        .execute(
            "INSERT INTO spaces (id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?3)",
            params![id, name, timestamp],
        )
        .expect("seed space");
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn seed_card(
    connection: &Connection,
    id: &str,
    space_id: &str,
    front: &str,
    back: &str,
    state: i64,
    due: i64,
    suspended: bool,
    timestamp: i64,
) {
    connection
        .execute(
            "
            INSERT INTO cards (
              id, space_id, front, back, tags, source, state, due, stability, difficulty,
              elapsed_days, scheduled_days, learning_steps, reps, lapses, last_review,
              created_at, updated_at, is_suspended
            )
            VALUES (?1, ?2, ?3, ?4, NULL, 'manual', ?5, ?6, 0, 0, 0, 0, 0, 0, 0, NULL, ?7, ?7, ?8)
            ",
            params![
                id,
                space_id,
                front,
                back,
                state,
                due,
                timestamp,
                i64::from(suspended)
            ],
        )
        .expect("seed card");
}

pub(crate) fn seed_review_log(
    connection: &Connection,
    id: &str,
    card_id: &str,
    space_id: &str,
    grade: i64,
    state: i64,
    review_time: i64,
) {
    connection
        .execute(
            "
            INSERT INTO review_logs (id, card_id, space_id, grade, state, due, elapsed_days, scheduled_days, review_time)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, 1, ?7)
            ",
            params![id, card_id, space_id, grade, state, review_time, review_time],
        )
        .expect("seed review log");
}
