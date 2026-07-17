use crate::spaces::{create_space_row, delete_space_row, list_space_summaries, rename_space_row};
use crate::tests::support::{
    open_test_connection, seed_card, seed_review_log, seed_space, TEST_NOW,
};

#[test]
fn spaces_create_list_rename_and_reject_unknown_ids() {
    let connection = open_test_connection();
    seed_space(&connection, "older", "Older", 1);
    seed_space(&connection, "newer", "Newer", 2);
    seed_card(
        &connection,
        "due",
        "newer",
        "Front",
        "Back",
        0,
        TEST_NOW - 1,
        false,
        2,
    );

    let created = create_space_row(&connection, "Created").expect("create space");
    assert_eq!(created.name, "Created");
    assert_eq!(created.card_count, 0);

    let listed = list_space_summaries(&connection).expect("list spaces");
    assert_eq!(listed.len(), 3);
    assert_eq!(
        listed
            .iter()
            .find(|space| space.id == "newer")
            .unwrap()
            .card_count,
        1
    );
    assert_eq!(
        listed
            .iter()
            .find(|space| space.id == "newer")
            .unwrap()
            .due_today_count,
        1
    );

    let renamed = rename_space_row(&connection, "older", "Renamed").expect("rename space");
    assert_eq!(renamed.name, "Renamed");
    assert!(rename_space_row(&connection, "missing", "Nope").is_err());
}

#[test]
fn delete_space_cascades_cards_and_review_logs() {
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
    seed_review_log(&connection, "log-a", "card-a", "space-a", 3, 2, TEST_NOW);

    delete_space_row(&connection, "space-a").expect("delete space");
    assert_eq!(
        connection
            .query_row("SELECT COUNT(*) FROM cards", [], |row| row.get::<_, i64>(0))
            .unwrap(),
        0
    );
    assert_eq!(
        connection
            .query_row("SELECT COUNT(*) FROM review_logs", [], |row| row
                .get::<_, i64>(0))
            .unwrap(),
        0
    );
    assert!(delete_space_row(&connection, "space-a").is_err());
}
