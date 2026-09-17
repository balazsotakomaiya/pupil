use std::time::{SystemTime, UNIX_EPOCH};

pub(crate) fn encode_tags(tags: &[String]) -> rusqlite::Result<Option<String>> {
    if tags.is_empty() {
        return Ok(None);
    }

    serde_json::to_string(tags)
        .map(Some)
        .map_err(|error| rusqlite::Error::ToSqlConversionFailure(Box::new(error)))
}

pub(crate) fn decode_tags(tags_json: Option<String>) -> rusqlite::Result<Vec<String>> {
    match tags_json {
        Some(json) if !json.trim().is_empty() => serde_json::from_str(&json).map_err(|error| {
            rusqlite::Error::FromSqlConversionFailure(
                json.len(),
                rusqlite::types::Type::Text,
                Box::new(error),
            )
        }),
        _ => Ok(Vec::new()),
    }
}

/// Clamps a string to `max_chars` characters, appending an ellipsis when it had
/// to cut. Operates on characters rather than bytes so it cannot split a
/// multi-byte sequence and panic.
pub(crate) fn truncate_chars(value: &str, max_chars: usize) -> String {
    let mut chars = value.chars();
    let truncated = chars.by_ref().take(max_chars).collect::<String>();

    if chars.next().is_some() {
        format!("{truncated}…")
    } else {
        truncated
    }
}

pub(crate) fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock drifted backwards")
        .as_millis() as i64
}
