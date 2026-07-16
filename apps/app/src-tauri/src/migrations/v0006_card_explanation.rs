use rusqlite::{params, Transaction};

use crate::constants::{EXPLAIN_MAX_PAYLOAD_BYTES, EXPLAIN_SCHEMA_VERSION};
use crate::error::{AppError, AppResult};
use crate::types::{parse_persisted_explain_card_payload, ExplainCardPayload};

pub(super) fn migrate_card_explanation_payloads(transaction: &Transaction<'_>) -> AppResult<()> {
    let cached_rows = {
        let mut statement = transaction.prepare(
            "
            SELECT id, explanation, explanation_payload, explanation_generated_at
            FROM cards
            WHERE explanation IS NOT NULL
               OR explanation_payload IS NOT NULL
               OR explanation_generated_at IS NOT NULL
            ",
        )?;
        let rows = statement.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<i64>>(3)?,
            ))
        })?;
        rows.collect::<rusqlite::Result<Vec<_>>>()?
    };

    for (card_id, explanation, payload, generated_at) in cached_rows {
        match payload {
            Some(payload) if parse_persisted_explain_card_payload(&payload).is_ok() => {
                transaction.execute(
                    "UPDATE cards SET explanation = NULL WHERE id = ?1",
                    [card_id],
                )?;
            }
            Some(_) => clear_explanation_cache(transaction, &card_id, "invalid_payload")?,
            None => match explanation {
                Some(explanation) => match convert_legacy_explanation_cache(&explanation) {
                    Ok(payload) => {
                        let payload = serde_json::to_string(&payload)
                            .map_err(|error| AppError::internal_message(error.to_string()))?;
                        transaction.execute(
                            "UPDATE cards SET explanation = NULL, explanation_payload = ?1, explanation_generated_at = ?2 WHERE id = ?3",
                            params![payload, generated_at, card_id],
                        )?;
                    }
                    Err(category) => clear_explanation_cache(transaction, &card_id, category)?,
                },
                None => clear_explanation_cache(transaction, &card_id, "incomplete_cache")?,
            },
        }
    }

    Ok(())
}

fn convert_legacy_explanation_cache(explanation: &str) -> Result<ExplainCardPayload, &'static str> {
    if explanation.len() > EXPLAIN_MAX_PAYLOAD_BYTES {
        return Err("oversized_legacy_text");
    }

    let mut paragraphs = Vec::new();
    let mut paragraph_lines = Vec::new();
    for line in explanation.lines() {
        let line = line.trim();
        if line.is_empty() {
            if !paragraph_lines.is_empty() {
                paragraphs.push(paragraph_lines.join(" "));
                paragraph_lines.clear();
            }
        } else {
            paragraph_lines.push(line);
        }
    }
    if !paragraph_lines.is_empty() {
        paragraphs.push(paragraph_lines.join(" "));
    }

    let payload = ExplainCardPayload {
        schema_version: EXPLAIN_SCHEMA_VERSION,
        paragraphs,
        visual: None,
    };
    let serialized_len = serde_json::to_vec(&payload)
        .map_err(|_| "serialization_failure")?
        .len();
    payload
        .validate(serialized_len)
        .map_err(|_| "invalid_legacy_text")?;

    Ok(payload)
}

fn clear_explanation_cache(
    transaction: &Transaction<'_>,
    card_id: &str,
    category: &'static str,
) -> AppResult<()> {
    transaction.execute(
        "UPDATE cards SET explanation = NULL, explanation_payload = NULL, explanation_generated_at = NULL WHERE id = ?1",
        [card_id],
    )?;
    tracing::warn!(
        card_id,
        category,
        "cleared invalid explanation cache during migration"
    );

    Ok(())
}
