use crate::constants::SPACE_NAME_MAX_LENGTH;
use crate::normalize::{
    normalize_card_input, normalize_import_anki_input, normalize_review_card_input,
    normalize_space_name,
};
use crate::types::{ImportAnkiCardInput, ImportAnkiInput, ReviewCardInput, ReviewCardLogInput};

#[test]
fn normalize_space_name_trims_and_rejects_empty_values() {
    assert_eq!(
        normalize_space_name("  Rust  ").expect("expected normalized space name"),
        "Rust"
    );
    assert_eq!(
        normalize_space_name("   ").expect_err("expected empty name error"),
        "Space name can't be empty."
    );
}

#[test]
fn normalize_space_name_enforces_length_limit() {
    let max_length_name = "a".repeat(SPACE_NAME_MAX_LENGTH);
    let too_long_name = "a".repeat(SPACE_NAME_MAX_LENGTH + 1);

    assert_eq!(
        normalize_space_name(&max_length_name).expect("expected max length name to pass"),
        max_length_name
    );
    assert_eq!(
        normalize_space_name(&too_long_name).expect_err("expected length validation error"),
        format!(
            "Space names must be {} characters or fewer.",
            SPACE_NAME_MAX_LENGTH
        )
    );
}

#[test]
fn normalize_card_input_deduplicates_and_trims_tags() {
    let tags = vec![
        " rust ".to_string(),
        "".to_string(),
        "rust".to_string(),
        " spaced repetition ".to_string(),
    ];

    let normalized = normalize_card_input("space-1", " Front ", " Back ", &tags, None)
        .expect("expected normalized card input");

    assert_eq!(normalized.space_id, "space-1");
    assert_eq!(normalized.front, "Front");
    assert_eq!(normalized.back, "Back");
    assert_eq!(
        normalized.tags,
        vec!["rust".to_string(), "spaced repetition".to_string()]
    );
    assert_eq!(normalized.source, "manual");
}

#[test]
fn normalize_card_input_rejects_invalid_identifiers_and_sources() {
    let blank_space_error = normalize_card_input("   ", "Front", "Back", &[], None)
        .err()
        .expect("expected blank space identifier to fail");
    let invalid_source_error = normalize_card_input("space-1", "Front", "Back", &[], Some("csv"))
        .err()
        .expect("expected invalid card source to fail");

    assert_eq!(blank_space_error, "Space identifier is required.");
    assert_eq!(
        invalid_source_error,
        "Card source must be manual, ai, or anki."
    );
}

#[test]
fn normalize_import_anki_input_trims_target_space_and_card_fields() {
    let input = ImportAnkiInput {
        source_file_name: "deck.apkg".to_string(),
        target_space_id: Some("  target-space  ".to_string()),
        cards: vec![ImportAnkiCardInput {
            deck_name: "  Deck Name  ".to_string(),
            front: "  Front  ".to_string(),
            back: "  Back  ".to_string(),
            tags: vec![
                " rust ".to_string(),
                "".to_string(),
                "rust".to_string(),
                " spaced repetition ".to_string(),
            ],
        }],
    };

    let normalized = normalize_import_anki_input(&input).expect("expected normalized import input");

    assert_eq!(normalized.target_space_id, Some("target-space".to_string()));
    assert_eq!(normalized.cards.len(), 1);
    assert_eq!(normalized.cards[0].deck_name, "Deck Name");
    assert_eq!(normalized.cards[0].front, "Front");
    assert_eq!(normalized.cards[0].back, "Back");
    assert_eq!(
        normalized.cards[0].tags,
        vec!["rust".to_string(), "spaced repetition".to_string()]
    );
}

#[test]
fn normalize_review_card_input_rejects_invalid_values() {
    let invalid_input = ReviewCardInput {
        id: "card-1".to_string(),
        grade: 5,
        state: 0,
        due: 1,
        stability: 2.5,
        difficulty: 3.0,
        elapsed_days: 0,
        scheduled_days: 0,
        learning_steps: 0,
        reps: 0,
        lapses: 0,
        last_review: 1,
        review_log: ReviewCardLogInput {
            state: 0,
            due: 1,
            elapsed_days: Some(0),
            scheduled_days: 0,
            review_time: 1,
        },
    };

    let error = normalize_review_card_input(&invalid_input)
        .err()
        .expect("expected invalid grade error");

    assert_eq!(error, "Grade must be between 1 and 4.");
}

#[test]
fn normalize_review_card_input_rejects_invalid_review_time() {
    let invalid_input = ReviewCardInput {
        id: "card-1".to_string(),
        grade: 3,
        state: 0,
        due: 1,
        stability: 2.5,
        difficulty: 3.0,
        elapsed_days: 0,
        scheduled_days: 0,
        learning_steps: 0,
        reps: 0,
        lapses: 0,
        last_review: 1,
        review_log: ReviewCardLogInput {
            state: 0,
            due: 1,
            elapsed_days: Some(0),
            scheduled_days: 0,
            review_time: 0,
        },
    };

    let error = normalize_review_card_input(&invalid_input)
        .err()
        .expect("expected invalid review time error");

    assert_eq!(error, "Review time must be a positive timestamp.");
}
