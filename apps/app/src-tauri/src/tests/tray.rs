use rusqlite::Connection;

use crate::tray::{
    build_tray_queue_counts, load_tray_queue_counts, tray_status, TrayQueueCounts, TrayStatus,
};

#[test]
fn tray_status_is_empty_when_no_cards_exist() {
    assert_eq!(tray_status(0, 0, 0), TrayStatus::Empty);
}

#[test]
fn tray_status_is_caught_up_when_cards_exist_but_nothing_is_due() {
    assert_eq!(tray_status(24, 0, 0), TrayStatus::CaughtUp);
}

#[test]
fn tray_status_prefers_due_over_caught_up() {
    assert_eq!(tray_status(24, 3, 0), TrayStatus::DueToday);
}

#[test]
fn tray_status_prefers_overdue_over_all_other_states() {
    assert_eq!(tray_status(24, 3, 2), TrayStatus::Overdue);
}

#[test]
fn tray_queue_counts_respect_remaining_new_card_budget() {
    assert_eq!(
        build_tray_queue_counts(202, 8, 2, Some(20), 0),
        TrayQueueCounts {
            admitted_new: 20,
            due_new: 202,
            due_review: 8,
            effective_due: 28,
            gated_new: 182,
            overdue_review: 2,
        }
    );
}

#[test]
fn tray_queue_counts_catch_up_for_today_when_new_budget_is_exhausted() {
    assert_eq!(
        build_tray_queue_counts(14, 0, 0, Some(20), 20),
        TrayQueueCounts {
            admitted_new: 0,
            due_new: 14,
            due_review: 0,
            effective_due: 0,
            gated_new: 14,
            overdue_review: 0,
        }
    );
}

#[test]
fn load_tray_queue_counts_ignores_suspended_cards() {
    let connection = Connection::open_in_memory().expect("open in-memory db");
    connection
        .execute_batch(
            "
            CREATE TABLE cards (
              state INTEGER NOT NULL,
              due INTEGER NOT NULL,
              is_suspended INTEGER NOT NULL DEFAULT 0
            );

            INSERT INTO cards (state, due, is_suspended) VALUES
              (0, 100, 0),
              (0, 100, 0),
              (0, 100, 0),
              (0, 100, 1),
              (1, 100, 0),
              (1, 100, 0),
              (1, 100, 1),
              (1, -300000000, 0),
              (1, -300000000, 1);
            ",
        )
        .expect("seed tray cards");

    assert_eq!(
        load_tray_queue_counts(&connection, 1_000, Some(2), 0).expect("load tray counts"),
        TrayQueueCounts {
            admitted_new: 2,
            due_new: 3,
            due_review: 3,
            effective_due: 5,
            gated_new: 1,
            overdue_review: 1,
        }
    );
}
