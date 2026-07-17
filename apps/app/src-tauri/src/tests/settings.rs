use std::fs;

use crate::settings::{
    load_new_cards_limit, load_recent_activity, load_settings_data_summary,
    load_today_new_card_count, save_new_cards_limit, write_review_logs_csv,
};
use crate::tests::support::{
    open_test_connection, seed_card, seed_review_log, seed_space, TEST_NOW,
};

#[test]
fn study_settings_round_trip_and_count_new_cards_reviewed_today() {
    let connection = open_test_connection();
    assert_eq!(load_new_cards_limit(&connection).unwrap(), None);
    save_new_cards_limit(&connection, Some(12)).expect("save limit");
    assert_eq!(load_new_cards_limit(&connection).unwrap(), Some(12));
    save_new_cards_limit(&connection, None).expect("clear limit");
    assert_eq!(load_new_cards_limit(&connection).unwrap(), None);

    seed_space(&connection, "space-a", "Space A", 1);
    seed_card(
        &connection,
        "card-a",
        "space-a",
        "Front",
        "Back",
        0,
        TEST_NOW,
        false,
        1,
    );
    seed_review_log(
        &connection,
        "log-a",
        "card-a",
        "space-a",
        3,
        0,
        crate::util::now_ms(),
    );
    assert_eq!(load_today_new_card_count(&connection).unwrap(), 1);
}

#[test]
fn settings_summary_activity_and_csv_export_use_persisted_rows() {
    let connection = open_test_connection();
    seed_space(&connection, "space-a", "Comma, \"Quote\"", 1);
    seed_card(
        &connection,
        "card-a",
        "space-a",
        "Line one\nLine two",
        "Back",
        2,
        TEST_NOW,
        false,
        1,
    );
    seed_review_log(&connection, "log-a", "card-a", "space-a", 3, 2, TEST_NOW);

    let summary =
        load_settings_data_summary(&connection, std::path::Path::new("/tmp/pupil.sqlite")).unwrap();
    assert_eq!(summary.review_log_count, 1);
    assert_eq!(
        load_recent_activity(&connection, 1).unwrap()[0].review_count,
        1
    );

    let path = std::env::temp_dir().join(format!("pupil-review-log-{}.csv", std::process::id()));
    assert_eq!(write_review_logs_csv(&connection, &path).unwrap(), 1);
    let csv = fs::read_to_string(&path).expect("read CSV");
    fs::remove_file(&path).expect("remove temporary CSV");
    assert!(csv.contains("\"Comma, \"\"Quote\"\"\""));
    assert!(csv.contains("\"Line one\nLine two\""));
}

#[test]
fn recent_activity_groups_nearby_reviews_and_keeps_distinct_sessions() {
    let connection = open_test_connection();
    seed_space(&connection, "space-a", "Space A", 1);
    seed_space(&connection, "space-b", "Space B", 1);
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
    seed_card(
        &connection,
        "card-b",
        "space-b",
        "Front",
        "Back",
        2,
        TEST_NOW,
        false,
        1,
    );
    seed_review_log(&connection, "log-a-1", "card-a", "space-a", 3, 2, TEST_NOW);
    seed_review_log(
        &connection,
        "log-a-2",
        "card-a",
        "space-a",
        3,
        2,
        TEST_NOW - 60_000,
    );
    seed_review_log(
        &connection,
        "log-b",
        "card-b",
        "space-b",
        3,
        2,
        TEST_NOW - 120_000,
    );
    seed_review_log(
        &connection,
        "log-a-old",
        "card-a",
        "space-a",
        3,
        2,
        TEST_NOW - 60 * 60 * 1000,
    );

    let sessions = load_recent_activity(&connection, 3).expect("load sessions");
    assert_eq!(sessions.len(), 3);
    assert!(sessions.iter().any(|session| {
        session.space_id == "space-a"
            && session.review_time == TEST_NOW
            && session.review_count == 2
    }));
    assert!(sessions.iter().any(|session| {
        session.space_id == "space-b"
            && session.review_time == TEST_NOW - 120_000
            && session.review_count == 1
    }));
    assert!(sessions.iter().any(|session| {
        session.space_id == "space-a"
            && session.review_time == TEST_NOW - 60 * 60 * 1000
            && session.review_count == 1
    }));
}
