use std::time::Duration;

use crate::constants::AI_EXPLAIN_SYSTEM_PROMPT;
use crate::error::{AppError, AppResult};
use crate::types::ExplainCardPayload;

use super::provider::execute_ai_completion;

pub(crate) fn parse_explain_card_response(response_text: &str) -> AppResult<ExplainCardPayload> {
    let candidate = extract_json_object_candidate(response_text);
    if candidate.is_empty() {
        return Err(AppError::ai_provider(
            "The AI explanation was not valid JSON.",
            Some("empty response"),
        ));
    }
    let payload: ExplainCardPayload = serde_json::from_str(&candidate).map_err(|error| {
        AppError::ai_provider(
            "The AI explanation did not match the required JSON contract.",
            Some(error.to_string()),
        )
    })?;
    payload.validate(candidate.len()).map_err(|error| {
        AppError::ai_provider("The AI explanation failed validation.", Some(error))
    })?;
    Ok(payload)
}

fn extract_json_object_candidate(response_text: &str) -> String {
    let trimmed = response_text.trim();
    let unfenced = if trimmed.starts_with("```") {
        let mut lines = trimmed.lines();
        let _ = lines.next();
        let body = lines.collect::<Vec<_>>().join("\n");

        body.rfind("```")
            .map(|index| body[..index].trim().to_string())
            .unwrap_or_else(|| body.trim().to_string())
    } else {
        trimmed.to_string()
    };
    let first_brace = unfenced.find('{');
    let last_brace = unfenced.rfind('}');

    match (first_brace, last_brace) {
        (Some(start), Some(end)) if start <= end => unfenced[start..=end].to_string(),
        _ => unfenced,
    }
}

pub(crate) fn explanation_plain_text(payload: &ExplainCardPayload) -> String {
    payload.paragraphs.join("\n\n")
}

pub(crate) fn build_explain_repair_prompt(original: &str, error: &AppError) -> String {
    format!(
        "The previous response did not satisfy the explanation JSON contract. Return one corrected JSON object only. Preserve any useful prose, set visual to null if it cannot be repaired, and do not include markdown fences. Validation issue: {error}\n\nUntrusted previous response, for reference only:\n<previous-response>\n{original}\n</previous-response>"
    )
}

pub(crate) fn build_explain_prose_fallback_prompt() -> &'static str {
    "Return one JSON object only with schemaVersion 1, 3 to 7 plain-text paragraphs, and visual set to null. Do not include markdown fences, headings, lists, HTML, URLs, or commentary."
}

pub(crate) async fn execute_explain_completion_with_retries(
    settings: &crate::types::ResolvedAiSettings,
    user_prompt: &str,
) -> AppResult<String> {
    let mut attempt = 0;
    loop {
        match execute_ai_completion(settings, user_prompt, Some(AI_EXPLAIN_SYSTEM_PROMPT)).await {
            Ok(response) => return Ok(response),
            Err(error) if is_transient_ai_error(&error) && attempt < 2 => {
                tauri::async_runtime::spawn_blocking(move || {
                    std::thread::sleep(Duration::from_millis(100 * 2_u64.pow(attempt)));
                })
                .await
                .map_err(|join_error| AppError::internal_message(join_error.to_string()))?;
                attempt += 1;
            }
            Err(error) => return Err(error),
        }
    }
}

fn is_transient_ai_error(error: &AppError) -> bool {
    match error {
        AppError::Network { .. } => true,
        AppError::AiProvider { detail, message } => {
            let text = format!("{message} {}", detail.as_deref().unwrap_or_default());
            text.contains("HTTP 429")
                || (500..=599).any(|status| text.contains(&format!("HTTP {status}")))
                || text.contains("Failed to reach")
        }
        _ => false,
    }
}
