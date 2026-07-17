use crate::tests::support::{open_test_connection, seed_card, seed_space};
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
    let connection = open_test_connection();
    seed_space(&connection, "space-a", "Space A", 1);
    for (id, state, due, suspended) in [
        ("new-a", 0, 100, false),
        ("new-b", 0, 100, false),
        ("new-c", 0, 100, false),
        ("new-suspended", 0, 100, true),
        ("review-a", 1, 100, false),
        ("review-b", 1, 100, false),
        ("review-suspended", 1, 100, true),
        ("overdue", 1, -300_000_000, false),
        ("overdue-suspended", 1, -300_000_000, true),
    ] {
        seed_card(
            &connection,
            id,
            "space-a",
            "Front",
            "Back",
            state,
            due,
            suspended,
            1,
        );
    }

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
