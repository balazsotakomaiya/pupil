use crate::constants::SPACE_NAME_MAX_LENGTH;
use crate::types::{
    ImportAnkiCardInput, NormalizedCardInput, NormalizedCardUpdateInput,
    NormalizedImportAnkiCardInput, NormalizedImportAnkiInput, NormalizedReviewCardInput,
    NormalizedReviewCardLogInput, ReviewCardInput, UpdateCardInput, ImportAnkiInput,
};

pub(crate) fn normalize_space_name(name: &str) -> Result<String, String> {
    let trimmed = name.trim();

    if trimmed.is_empty() {
        return Err("Space name can't be empty.".to_string());
    }

    if trimmed.chars().count() > SPACE_NAME_MAX_LENGTH {
        return Err(format!(
            "Space names must be {} characters or fewer.",
            SPACE_NAME_MAX_LENGTH
        ));
    }

    Ok(trimmed.to_string())
}

pub(crate) fn normalize_card_input(
    space_id: &str,
    front: &str,
    back: &str,
    tags: &[String],
    source: Option<&str>,
) -> Result<NormalizedCardInput, String> {
    let normalized_space_id = normalize_required_identifier(space_id, "Space")?;

    Ok(NormalizedCardInput {
        space_id: normalized_space_id,
        front: normalize_card_text(front, "Front")?,
        back: normalize_card_text(back, "Back")?,
        tags: normalize_tags(tags),
        source: normalize_card_source(source)?,
    })
}

pub(crate) fn normalize_card_update_input(
    input: &UpdateCardInput,
) -> Result<NormalizedCardUpdateInput, String> {
    Ok(NormalizedCardUpdateInput {
        id: normalize_required_identifier(&input.id, "Card")?,
        space_id: normalize_required_identifier(&input.space_id, "Space")?,
        front: normalize_card_text(&input.front, "Front")?,
        back: normalize_card_text(&input.back, "Back")?,
        tags: normalize_tags(&input.tags),
    })
}

pub(crate) fn normalize_review_card_input(
    input: &ReviewCardInput,
) -> Result<NormalizedReviewCardInput, String> {
    Ok(NormalizedReviewCardInput {
        id: normalize_required_identifier(&input.id, "Card")?,
        grade: normalize_grade(input.grade)?,
        state: normalize_card_state(input.state)?,
        due: normalize_timestamp(input.due, "Due")?,
        stability: normalize_non_negative_number(input.stability, "Stability")?,
        difficulty: normalize_non_negative_number(input.difficulty, "Difficulty")?,
        elapsed_days: normalize_non_negative_integer(input.elapsed_days, "Elapsed days")?,
        scheduled_days: normalize_non_negative_integer(input.scheduled_days, "Scheduled days")?,
        learning_steps: normalize_non_negative_integer(input.learning_steps, "Learning steps")?,
        reps: normalize_non_negative_integer(input.reps, "Reps")?,
        lapses: normalize_non_negative_integer(input.lapses, "Lapses")?,
        last_review: normalize_timestamp(input.last_review, "Last review")?,
        review_log: NormalizedReviewCardLogInput {
            state: normalize_card_state(input.review_log.state)?,
            due: normalize_timestamp(input.review_log.due, "Review due")?,
            elapsed_days: match input.review_log.elapsed_days {
                Some(value) => Some(normalize_non_negative_integer(
                    value,
                    "Review elapsed days",
                )?),
                None => None,
            },
            scheduled_days: normalize_non_negative_integer(
                input.review_log.scheduled_days,
                "Review scheduled days",
            )?,
            review_time: normalize_timestamp(input.review_log.review_time, "Review time")?,
        },
    })
}

pub(crate) fn normalize_import_anki_input(
    input: &ImportAnkiInput,
) -> Result<NormalizedImportAnkiInput, String> {
    let cards = input
        .cards
        .iter()
        .map(|card| normalize_import_anki_card(card))
        .collect::<Result<Vec<_>, _>>()?;

    Ok(NormalizedImportAnkiInput {
        target_space_id: match input.target_space_id.as_deref() {
            Some(space_id) => Some(normalize_required_identifier(space_id, "Space")?),
            None => None,
        },
        cards,
    })
}

fn normalize_import_anki_card(
    card: &ImportAnkiCardInput,
) -> Result<NormalizedImportAnkiCardInput, String> {
    Ok(NormalizedImportAnkiCardInput {
        deck_name: normalize_space_name(&card.deck_name)?,
        front: normalize_card_text(&card.front, "Front")?,
        back: normalize_card_text(&card.back, "Back")?,
        tags: normalize_tags(&card.tags),
    })
}

fn normalize_card_source(source: Option<&str>) -> Result<String, String> {
    match source.unwrap_or("manual") {
        "manual" | "ai" | "anki" => Ok(source.unwrap_or("manual").to_string()),
        _ => Err("Card source must be manual, ai, or anki.".to_string()),
    }
}

fn normalize_required_identifier(value: &str, label: &str) -> Result<String, String> {
    let trimmed = value.trim();

    if trimmed.is_empty() {
        return Err(format!("{label} identifier is required."));
    }

    Ok(trimmed.to_string())
}

fn normalize_grade(value: i64) -> Result<i64, String> {
    if (1..=4).contains(&value) {
        return Ok(value);
    }

    Err("Grade must be between 1 and 4.".to_string())
}

fn normalize_card_state(value: i64) -> Result<i64, String> {
    if (0..=3).contains(&value) {
        return Ok(value);
    }

    Err("Card state must be between 0 and 3.".to_string())
}

fn normalize_timestamp(value: i64, label: &str) -> Result<i64, String> {
    if value > 0 {
        return Ok(value);
    }

    Err(format!("{label} must be a positive timestamp."))
}

fn normalize_non_negative_integer(value: i64, label: &str) -> Result<i64, String> {
    if value >= 0 {
        return Ok(value);
    }

    Err(format!("{label} must be zero or greater."))
}

fn normalize_non_negative_number(value: f64, label: &str) -> Result<f64, String> {
    if value.is_finite() && value >= 0.0 {
        return Ok(value);
    }

    Err(format!("{label} must be a finite non-negative number."))
}

fn normalize_card_text(value: &str, label: &str) -> Result<String, String> {
    let trimmed = value.trim();

    if trimmed.is_empty() {
        return Err(format!("{label} can't be empty."));
    }

    Ok(trimmed.to_string())
}

fn normalize_tags(tags: &[String]) -> Vec<String> {
    let mut normalized = Vec::new();

    for tag in tags {
        let trimmed = tag.trim();

        if trimmed.is_empty() || normalized.iter().any(|existing| existing == trimmed) {
            continue;
        }

        normalized.push(trimmed.to_string());
    }

    normalized
}
