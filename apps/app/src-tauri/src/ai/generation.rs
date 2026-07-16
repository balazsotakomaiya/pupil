use serde_json::Value;

use super::validation::{
    ai_difficulty_description, ai_style_description, normalize_ai_difficulty, normalize_ai_style,
    normalize_non_empty_text,
};
use crate::error::{AppError, AppResult};
use crate::types::{GenerateCardsInput, GeneratedCardPayload, NormalizedGenerateCardsInput};

pub(crate) fn normalize_generate_cards_input(
    input: GenerateCardsInput,
) -> Result<NormalizedGenerateCardsInput, String> {
    let topic = normalize_non_empty_text(&input.topic, "Topic")?;
    let count = match input.count {
        Some(value) if !(1..=30).contains(&value) => {
            return Err("Card count must be between 1 and 30.".to_string());
        }
        Some(value) => Some(value),
        None => None,
    };
    let difficulty = normalize_ai_difficulty(&input.difficulty)?;
    let style = normalize_ai_style(&input.style)?;

    Ok(NormalizedGenerateCardsInput {
        topic,
        count,
        difficulty,
        style,
    })
}

pub(crate) fn build_generate_cards_prompt(
    topic: &str,
    count: Option<i64>,
    difficulty: &str,
    style: &str,
) -> String {
    let request_line = match count {
        Some(value) => format!("Generate exactly {value} flashcards about \"{topic}\"."),
        None => format!(
            "Generate the smallest complete set of flashcards about \"{topic}\". Return between 6 and 20 cards."
        ),
    };

    format!(
        "{request_line}\n\nDifficulty: {}\nCard style: {}\n\nReturn only the JSON array.",
        ai_difficulty_description(difficulty),
        ai_style_description(style)
    )
}

pub(crate) fn parse_generated_cards_response(
    response_text: &str,
    requested_count: Option<i64>,
) -> AppResult<Vec<GeneratedCardPayload>> {
    let candidate = extract_json_array_candidate(response_text);
    let payload: Value = serde_json::from_str(&candidate).map_err(|error| {
        AppError::ai_provider("Failed to parse AI JSON.", Some(error.to_string()))
    })?;
    let Some(items) = payload.as_array() else {
        return Err(AppError::ai_provider(
            "The AI response was not a JSON array.",
            None::<String>,
        ));
    };

    let cards = items
        .iter()
        .filter_map(|item| {
            let front = item.get("front")?.as_str()?.trim();
            let back = item.get("back")?.as_str()?.trim();

            if front.is_empty() || back.is_empty() {
                return None;
            }

            Some(GeneratedCardPayload {
                back: back.to_string(),
                front: front.to_string(),
            })
        })
        .collect::<Vec<_>>();

    if cards.is_empty() {
        return Err(AppError::ai_provider(
            "The AI response did not contain any valid cards.",
            None::<String>,
        ));
    }

    if let Some(count) = requested_count {
        let parsed_total = cards.len() as i64;

        if parsed_total > count {
            tracing::warn!(
                requested = count,
                returned = parsed_total,
                "AI provider returned more cards than requested; truncating"
            );
        }
    }

    Ok(match requested_count {
        Some(count) if cards.len() > count as usize => {
            cards.into_iter().take(count as usize).collect()
        }
        _ => cards,
    })
}

fn extract_json_array_candidate(response_text: &str) -> String {
    let trimmed = response_text.trim();
    let unfenced = if trimmed.starts_with("```") {
        let mut lines = trimmed.lines();
        let _ = lines.next();
        let body = lines.collect::<Vec<_>>().join("\n");

        if let Some(index) = body.rfind("```") {
            body[..index].trim().to_string()
        } else {
            body.trim().to_string()
        }
    } else {
        trimmed.to_string()
    };

    let first_bracket = unfenced.find('[');
    let last_bracket = unfenced.rfind(']');

    match (first_bracket, last_bracket) {
        (Some(start), Some(end)) if start <= end => unfenced[start..=end].to_string(),
        _ => unfenced,
    }
}
