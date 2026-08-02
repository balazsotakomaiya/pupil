use crate::error::AppError;
use crate::util::{decode_tags, encode_tags, now_ms, truncate_chars};
use rusqlite::ffi::{Error, ErrorCode};
use std::time::{SystemTime, UNIX_EPOCH};

#[test]
fn encode_and_decode_tags_round_trip() {
    let tags = vec!["rust".to_string(), "fsrs".to_string()];

    let encoded = encode_tags(&tags)
        .expect("expected encoded tags")
        .expect("expected json payload");
    let decoded = decode_tags(Some(encoded)).expect("expected decoded tags");

    assert_eq!(decoded, tags);
}

#[test]
fn encode_tags_returns_none_for_empty_input() {
    assert_eq!(
        encode_tags(&[]).expect("expected empty tags to encode cleanly"),
        None
    );
}

#[test]
fn decode_tags_treats_empty_values_as_no_tags() {
    assert_eq!(
        decode_tags(None).expect("expected empty tag list"),
        Vec::<String>::new()
    );
    assert_eq!(
        decode_tags(Some("   ".to_string())).expect("expected empty tag list"),
        Vec::<String>::new()
    );
}

#[test]
fn decode_tags_rejects_invalid_json() {
    assert!(decode_tags(Some("{not-json}".to_string())).is_err());
}

#[test]
fn app_error_maps_known_sqlite_cases() {
    let duplicate = rusqlite::Error::SqliteFailure(
        Error {
            code: ErrorCode::ConstraintViolation,
            extended_code: 2067,
        },
        None,
    );
    let constraint = rusqlite::Error::SqliteFailure(
        Error {
            code: ErrorCode::ConstraintViolation,
            extended_code: ErrorCode::ConstraintViolation as i32,
        },
        None,
    );

    assert_eq!(
        AppError::from_space_storage(duplicate).to_string(),
        "Space already exists"
    );
    assert_eq!(
        AppError::from_space_storage(constraint).to_string(),
        "Storage error: The requested change violates a database constraint."
    );
    assert_eq!(
        AppError::from_space_storage(rusqlite::Error::QueryReturnedNoRows).to_string(),
        "Space not found"
    );
    assert_eq!(
        AppError::from_card_storage(rusqlite::Error::QueryReturnedNoRows).to_string(),
        "Card not found"
    );
    assert_eq!(
        AppError::from_card_storage(rusqlite::Error::SqliteFailure(
            Error {
                code: ErrorCode::ConstraintViolation,
                extended_code: ErrorCode::ConstraintViolation as i32,
            },
            None
        ))
        .to_string(),
        "Storage error: The requested change violates a database constraint."
    );
}

#[test]
fn app_error_falls_back_to_the_original_message() {
    let error = rusqlite::Error::InvalidColumnName("missing".to_string());

    assert_eq!(
        AppError::from_space_storage(error).to_string(),
        "Storage error: Invalid column name: missing"
    );
}

#[test]
fn app_error_serializes_every_renderer_facing_variant() {
    let cases = [
        AppError::validation("bad input"),
        AppError::validation_field("bad field", "name"),
        AppError::storage_message("disk issue"),
        AppError::internal_message("unexpected"),
        AppError::ai_provider("bad response", Some("detail")),
        AppError::migration_failed("failed migration"),
        AppError::NotFound {
            entity: "Card".to_string(),
        },
        AppError::Duplicate {
            entity: "Space".to_string(),
        },
    ];

    for error in cases {
        let value = serde_json::to_value(error).expect("serialize app error");
        assert!(value.get("code").is_some());
    }
}

#[test]
fn now_ms_returns_a_current_timestamp() {
    let before = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("expected current time")
        .as_millis() as i64;
    let current = now_ms();
    let after = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("expected current time")
        .as_millis() as i64;

    assert!(current >= before);
    assert!(current <= after);
}

#[test]
fn truncate_chars_leaves_input_within_the_limit_unchanged() {
    assert_eq!(truncate_chars("mitochondria", 32), "mitochondria");
}

#[test]
fn truncate_chars_appends_an_ellipsis_when_it_cuts() {
    assert_eq!(truncate_chars("abcdef", 3), "abc…");
}

#[test]
fn truncate_chars_counts_characters_rather_than_bytes() {
    // A byte-based cut would split one of these multi-byte characters and panic.
    assert_eq!(truncate_chars("ααααα", 3), "ααα…");
}

#[test]
fn truncate_chars_keeps_input_of_exactly_the_limit_intact() {
    assert_eq!(truncate_chars("abc", 3), "abc");
}
