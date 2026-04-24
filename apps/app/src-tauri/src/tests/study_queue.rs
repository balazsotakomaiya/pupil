use rusqlite::Connection;

use crate::study_queue::load_study_queue_snapshot;
use crate::types::{StudyQueueSnapshot, StudyQueueSpaceCount};

#[test]
fn study_queue_snapshot_uses_shared_actionable_rules() {
    let connection = Connection::open_in_memory().expect("open in-memory db");
    connection
        .execute_batch(
            "
            CREATE TABLE cards (
              id TEXT NOT NULL,
              space_id TEXT NOT NULL,
              state INTEGER NOT NULL,
              due INTEGER NOT NULL,
              updated_at INTEGER NOT NULL,
              created_at INTEGER NOT NULL,
              front TEXT NOT NULL,
              is_suspended INTEGER NOT NULL DEFAULT 0
            );

            INSERT INTO cards (id, space_id, state, due, updated_at, created_at, front, is_suspended) VALUES
              ('review-a', 'space-a', 1, 100, 10, 10, 'Review A', 0),
              ('review-b', 'space-b', 1, -300000000, 10, 10, 'Review B', 0),
              ('new-a-1', 'space-a', 0, 100, 30, 30, 'New A 1', 0),
              ('new-b-1', 'space-b', 0, 100, 20, 20, 'New B 1', 0),
              ('new-b-2', 'space-b', 0, 100, 10, 10, 'New B 2', 0),
              ('new-a-suspended', 'space-a', 0, 100, 40, 40, 'New A Suspended', 1);
            ",
        )
        .expect("seed study queue cards");

    assert_eq!(
        load_study_queue_snapshot(&connection, 1_000, Some(2), 0)
            .expect("load study queue snapshot"),
        StudyQueueSnapshot {
            actionable_due_by_space: vec![
                StudyQueueSpaceCount {
                    space_id: "space-a".to_string(),
                    due_count: 2,
                },
                StudyQueueSpaceCount {
                    space_id: "space-b".to_string(),
                    due_count: 2,
                },
            ],
            actionable_due_count: 4,
            gated_new_count: 1,
            overdue_review_count: 1,
        }
    );
}

#[test]
fn study_queue_snapshot_breaks_new_card_ties_deterministically() {
    let connection = Connection::open_in_memory().expect("open in-memory db");
    connection
        .execute_batch(
            "
            CREATE TABLE cards (
              id TEXT NOT NULL,
              space_id TEXT NOT NULL,
              state INTEGER NOT NULL,
              due INTEGER NOT NULL,
              updated_at INTEGER NOT NULL,
              created_at INTEGER NOT NULL,
              front TEXT NOT NULL,
              is_suspended INTEGER NOT NULL DEFAULT 0
            );

            INSERT INTO cards (id, space_id, state, due, updated_at, created_at, front, is_suspended) VALUES
              ('a', 'space-a', 0, 100, 50, 200, 'A', 0),
              ('b', 'space-b', 0, 100, 50, 300, 'B', 0),
              ('c', 'space-c', 0, 100, 50, 100, 'C', 0);
            ",
        )
        .expect("seed tied new cards");

    assert_eq!(
        load_study_queue_snapshot(&connection, 1_000, Some(2), 0)
            .expect("load tied study queue snapshot"),
        StudyQueueSnapshot {
            actionable_due_by_space: vec![
                StudyQueueSpaceCount {
                    space_id: "space-a".to_string(),
                    due_count: 1,
                },
                StudyQueueSpaceCount {
                    space_id: "space-b".to_string(),
                    due_count: 1,
                },
            ],
            actionable_due_count: 2,
            gated_new_count: 1,
            overdue_review_count: 0,
        }
    );
}
