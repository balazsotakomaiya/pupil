use crate::error::AppError;
use crate::util::{decode_tags, encode_tags, now_ms};
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
        "space already exists"
    );
    assert_eq!(
        AppError::from_space_storage(constraint).to_string(),
        "Storage error: The requested change violates a database constraint."
    );
    assert_eq!(
        AppError::from_space_storage(rusqlite::Error::QueryReturnedNoRows).to_string(),
        "space not found"
    );
    assert_eq!(
        AppError::from_card_storage(rusqlite::Error::QueryReturnedNoRows).to_string(),
        "card not found"
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
