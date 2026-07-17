use crate::analytics::{list_space_stats_rows, load_dashboard_stats};
use crate::tests::support::{
    open_test_connection, seed_card, seed_review_log, seed_space, TEST_NOW,
};

#[test]
fn dashboard_counts_cards_due_at_the_supplied_time() {
    let connection = open_test_connection();
    seed_space(&connection, "space-a", "Space A", 1);
    seed_card(
        &connection,
        "due",
        "space-a",
        "Due",
        "Back",
        1,
        TEST_NOW,
        false,
        1,
    );
    seed_card(
        &connection,
        "future",
        "space-a",
        "Future",
        "Back",
        1,
        TEST_NOW + 1,
        false,
        1,
    );

    let stats = load_dashboard_stats(&connection, TEST_NOW).expect("load dashboard stats");
    assert_eq!(stats.total_cards, 2);
    assert_eq!(stats.due_today, 1);
}

#[test]
fn space_stats_returns_retention_and_seven_days_of_activity() {
    let connection = open_test_connection();
    seed_space(&connection, "space-a", "Space A", 1);
    seed_card(
        &connection,
        "card-a",
        "space-a",
        "Front",
        "Back",
        2,
        TEST_NOW,
        false,
        1,
    );
    seed_review_log(&connection, "good", "card-a", "space-a", 3, 2, TEST_NOW);
    seed_review_log(
        &connection,
        "again",
        "card-a",
        "space-a",
        1,
        2,
        TEST_NOW - 24 * 60 * 60 * 1000,
    );

    let stats = list_space_stats_rows(&connection, TEST_NOW).expect("load space stats");
    assert_eq!(stats.len(), 1);
    assert_eq!(stats[0].retention_30d, Some(50.0));
    assert_eq!(stats[0].review_activity_7d.len(), 7);
    assert_eq!(stats[0].review_activity_7d.iter().sum::<i64>(), 2);
    assert_eq!(
        stats[0]
            .review_activity_7d
            .iter()
            .filter(|&&count| count == 1)
            .count(),
        2
    );
}
