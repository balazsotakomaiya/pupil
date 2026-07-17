use crate::cards::{
    create_card_row, delete_card_row, list_card_summaries, review_card_row, suspend_card_row,
    undo_review_card_row, update_card_row,
};
use crate::tests::support::{
    open_test_connection, seed_card, seed_review_log, seed_space, TEST_NOW,
};
use crate::types::{
    NormalizedCardInput, NormalizedCardUpdateInput, NormalizedReviewCardInput,
    NormalizedReviewCardLogInput, NormalizedUndoReviewCardInput,
};

fn open_seeded_connection() -> rusqlite::Connection {
    let connection = open_test_connection();
    seed_space(&connection, "space-a", "Space A", 1);
    seed_card(
        &connection,
        "card-a",
        "space-a",
        "Front",
        "Back",
        0,
        1000,
        false,
        1,
    );
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

#[test]
fn cards_create_and_list_persisted_data() {
    let mut connection = open_test_connection();
    seed_space(&connection, "space-a", "Space A", 1);

    let created = create_card_row(
        &mut connection,
        NormalizedCardInput {
            space_id: "space-a".to_string(),
            front: "Question".to_string(),
            back: "Answer".to_string(),
            tags: vec!["tag-a".to_string(), "tag-b".to_string()],
            source: "manual".to_string(),
        },
    )
    .expect("create card");
    assert_eq!(created.tags, ["tag-a", "tag-b"]);
    assert_eq!(list_card_summaries(&connection, None).unwrap().len(), 1);
    assert_eq!(
        list_card_summaries(&connection, Some("space-a"))
            .unwrap()
            .len(),
        1
    );
}

#[test]
fn cards_update_moves_a_card_between_spaces() {
    let mut connection = open_test_connection();
    seed_space(&connection, "space-a", "Space A", 1);
    seed_space(&connection, "space-b", "Space B", 1);
    seed_card(
        &connection,
        "card-a",
        "space-a",
        "Question",
        "Answer",
        0,
        TEST_NOW,
        false,
        1,
    );

    let updated = update_card_row(
        &mut connection,
        NormalizedCardUpdateInput {
            id: "card-a".to_string(),
            space_id: "space-b".to_string(),
            front: "Updated question".to_string(),
            back: "Updated answer".to_string(),
            tags: vec!["moved".to_string()],
        },
    )
    .expect("move card");
    assert_eq!(updated.space_id, "space-b");
    assert_eq!(updated.tags, ["moved"]);
    assert_eq!(
        list_card_summaries(&connection, Some("space-a"))
            .unwrap()
            .len(),
        0
    );
    assert_eq!(
        list_card_summaries(&connection, Some("space-b"))
            .unwrap()
            .len(),
        1
    );

    assert!(
        connection
            .query_row(
                "SELECT updated_at FROM spaces WHERE id = 'space-a'",
                [],
                |row| row.get::<_, i64>(0)
            )
            .unwrap()
            > 1
    );
    assert!(
        connection
            .query_row(
                "SELECT updated_at FROM spaces WHERE id = 'space-b'",
                [],
                |row| row.get::<_, i64>(0)
            )
            .unwrap()
            > 1
    );
}

#[test]
fn cards_suspend_and_resume_a_card() {
    let mut connection = open_seeded_connection();
    assert!(
        suspend_card_row(&mut connection, "card-a", true)
            .unwrap()
            .is_suspended
    );
    assert!(
        !suspend_card_row(&mut connection, "card-a", false)
            .unwrap()
            .is_suspended
    );
    assert!(suspend_card_row(&mut connection, "missing", true).is_err());
}

#[test]
fn cards_delete_cascades_their_review_logs() {
    let mut connection = open_seeded_connection();
    seed_review_log(&connection, "log-a", "card-a", "space-a", 3, 0, TEST_NOW);
    delete_card_row(&mut connection, "card-a").expect("delete card");
    assert_eq!(
        connection
            .query_row("SELECT COUNT(*) FROM review_logs", [], |row| row
                .get::<_, i64>(0))
            .unwrap(),
        0
    );
}

#[test]
fn review_persists_fsrs_fields_log_and_global_and_space_study_days() {
    let mut connection = open_seeded_connection();
    let review_time = crate::util::now_ms();
    let mut input = build_review_input(review_time);
    input.state = 2;
    input.stability = 13.5;
    input.difficulty = 4.2;
    input.reps = 3;

    let reviewed = review_card_row(&mut connection, input).expect("persist review");
    assert_eq!(reviewed.state, 2);
    assert_eq!(reviewed.stability, 13.5);
    assert_eq!(reviewed.difficulty, 4.2);
    assert_eq!(reviewed.reps, 3);
    assert_eq!(
        connection
            .query_row(
                "SELECT COUNT(*) FROM review_logs WHERE card_id = 'card-a'",
                [],
                |row| row.get::<_, i64>(0)
            )
            .unwrap(),
        1
    );
    assert_eq!(
        connection
            .query_row(
                "SELECT COUNT(*) FROM study_days WHERE space_id = 'space-a'",
                [],
                |row| row.get::<_, i64>(0)
            )
            .unwrap(),
        1
    );
    assert_eq!(
        connection
            .query_row(
                "SELECT COUNT(*) FROM study_days WHERE space_id IS NULL",
                [],
                |row| row.get::<_, i64>(0)
            )
            .unwrap(),
        1
    );
}
