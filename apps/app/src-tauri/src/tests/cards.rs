use rusqlite::Connection;

use crate::cards::{review_card_row, undo_review_card_row};
use crate::constants::MIGRATIONS;
use crate::types::{
    NormalizedReviewCardInput, NormalizedReviewCardLogInput, NormalizedUndoReviewCardInput,
};

fn open_seeded_connection() -> Connection {
    let mut connection = Connection::open_in_memory().expect("open in-memory db");

    {
        let transaction = connection
            .transaction()
            .expect("begin migration transaction");
        for migration in MIGRATIONS {
            transaction
                .execute_batch(migration.sql)
                .unwrap_or_else(|error| panic!("apply migration {}: {error}", migration.id));
        }
        transaction.commit().expect("commit migration transaction");
    }

    connection
        .execute(
            "INSERT INTO spaces (id, name, created_at, updated_at) VALUES ('space-a', 'Space A', 1, 1)",
            [],
        )
        .expect("seed space");

    connection
        .execute(
            "
            INSERT INTO cards (
              id, space_id, front, back, tags, source,
              state, due, stability, difficulty,
              elapsed_days, scheduled_days, learning_steps,
              reps, lapses, last_review,
              created_at, updated_at, is_suspended
            )
            VALUES (
              'card-a', 'space-a', 'Front', 'Back', NULL, 'manual',
              0, 1000, 0.0, 0.0,
              0, 0, 0,
              0, 0, NULL,
              1, 1, 0
            )
            ",
            [],
        )
        .expect("seed card");

    connection
}

fn build_review_input(now: i64) -> NormalizedReviewCardInput {
    NormalizedReviewCardInput {
        id: "card-a".to_string(),
        grade: 3,
        state: 2,
        due: now + 4 * 24 * 60 * 60 * 1000,
        stability: 12.5,
        difficulty: 5.0,
        elapsed_days: 0,
        scheduled_days: 4,
        learning_steps: 0,
        reps: 1,
        lapses: 0,
        last_review: now,
        review_log: NormalizedReviewCardLogInput {
            state: 0,
            due: 1000,
            elapsed_days: Some(0),
            scheduled_days: 4,
            review_time: now,
        },
    }
}

#[test]
fn undo_review_card_row_restores_card_and_removes_latest_log() {
    let mut connection = open_seeded_connection();
    let now = 10_000_000_000;

    review_card_row(&mut connection, build_review_input(now)).expect("apply review");

    let snapshot = NormalizedUndoReviewCardInput {
        id: "card-a".to_string(),
        state: 0,
        due: 1000,
        stability: 0.0,
        difficulty: 0.0,
        elapsed_days: 0,
        scheduled_days: 0,
        learning_steps: 0,
        reps: 0,
        lapses: 0,
        last_review: None,
    };

    let restored = undo_review_card_row(&mut connection, snapshot).expect("undo review");

    assert_eq!(restored.state, 0);
    assert_eq!(restored.due, 1000);
    assert_eq!(restored.stability, 0.0);
    assert_eq!(restored.difficulty, 0.0);
    assert_eq!(restored.elapsed_days, 0);
    assert_eq!(restored.scheduled_days, 0);
    assert_eq!(restored.learning_steps, 0);
    assert_eq!(restored.reps, 0);
    assert_eq!(restored.lapses, 0);
    assert_eq!(restored.last_review, None);

    let log_count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM review_logs WHERE card_id = 'card-a'",
            [],
            |row| row.get(0),
        )
        .expect("count review logs");

    assert_eq!(log_count, 0, "the only review log should be removed");
}

#[test]
fn undo_review_card_row_only_removes_the_most_recent_log_for_the_card() {
    let mut connection = open_seeded_connection();

    let first_review_time = 1_000_000_000;
    review_card_row(&mut connection, build_review_input(first_review_time))
        .expect("apply first review");

    let mut second_review = build_review_input(2_000_000_000);
    second_review.reps = 2;
    second_review.grade = 4;
    review_card_row(&mut connection, second_review).expect("apply second review");

    let snapshot_after_first_review = NormalizedUndoReviewCardInput {
        id: "card-a".to_string(),
        state: 2,
        due: first_review_time + 4 * 24 * 60 * 60 * 1000,
        stability: 12.5,
        difficulty: 5.0,
        elapsed_days: 0,
        scheduled_days: 4,
        learning_steps: 0,
        reps: 1,
        lapses: 0,
        last_review: Some(first_review_time),
    };

    let restored = undo_review_card_row(&mut connection, snapshot_after_first_review)
        .expect("undo most recent review");

    assert_eq!(restored.reps, 1);
    assert_eq!(restored.last_review, Some(first_review_time));

    let remaining_logs: Vec<i64> = connection
        .prepare(
            "SELECT review_time FROM review_logs WHERE card_id = 'card-a' ORDER BY review_time ASC",
        )
        .expect("prepare select")
        .query_map([], |row| row.get(0))
        .expect("execute select")
        .collect::<rusqlite::Result<Vec<_>>>()
        .expect("collect log times");

    assert_eq!(
        remaining_logs,
        vec![first_review_time],
        "the earlier review log should be untouched"
    );
}
