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

pub(crate) fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock drifted backwards")
        .as_millis() as i64
}
