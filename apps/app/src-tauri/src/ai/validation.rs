use crate::error::AppResult;
use crate::types::{ResolvedAiSettings, SaveAiSettingsInput};

pub(super) fn normalize_ai_settings_input(
    input: SaveAiSettingsInput,
) -> Result<crate::types::NormalizedAiSettingsInput, String> {
    let base_url = normalize_base_url(&input.base_url)?;
    let model = normalize_non_empty_text(&input.model, "Model")?;
    let max_tokens = input
        .max_tokens
        .trim()
        .parse::<i64>()
        .map_err(|_| "Max tokens must be a positive integer.".to_string())?;

    if max_tokens <= 0 {
        return Err("Max tokens must be a positive integer.".to_string());
    }

    let temperature = input
        .temperature
        .trim()
        .parse::<f64>()
        .map_err(|_| "Temperature must be a number between 0.0 and 2.0.".to_string())?;

    if !temperature.is_finite() || !(0.0..=2.0).contains(&temperature) {
        return Err("Temperature must be a number between 0.0 and 2.0.".to_string());
    }

    Ok(crate::types::NormalizedAiSettingsInput {
        api_key: input.api_key.map(|value| value.trim().to_string()),
        base_url,
        model,
        max_tokens,
        temperature,
        explain_enabled: input.explain_enabled,
    })
}

pub(super) fn normalize_base_url(value: &str) -> Result<String, String> {
    let trimmed = value.trim().trim_end_matches('/');

    if trimmed.is_empty() {
        return Err("Base URL can't be empty.".to_string());
    }

    if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
        return Err("Base URL must start with http:// or https://.".to_string());
    }

    Ok(trimmed.to_string())
}

pub(super) fn normalize_non_empty_text(value: &str, label: &str) -> Result<String, String> {
    let trimmed = value.trim();

    if trimmed.is_empty() {
        return Err(format!("{label} can't be empty."));
    }

    Ok(trimmed.to_string())
}

pub(super) fn normalize_ai_difficulty(value: &str) -> Result<String, String> {
    match value.trim() {
        "Beginner" | "Intermediate" | "Advanced" => Ok(value.trim().to_string()),
        _ => Err("Difficulty must be Beginner, Intermediate, or Advanced.".to_string()),
    }
}

pub(super) fn normalize_ai_style(value: &str) -> Result<String, String> {
    match value.trim() {
        "Concept" | "Q&A" | "Cloze" => Ok(value.trim().to_string()),
        _ => Err("Style must be Concept, Q&A, or Cloze.".to_string()),
    }
}

pub(super) fn trim_trailing_zeroes(value: f64) -> String {
    let mut text = format!("{value:.2}");

    while text.contains('.') && text.ends_with('0') {
        text.pop();
    }

    if text.ends_with('.') {
        text.pop();
    }

    text
}

pub(super) fn is_anthropic_base_url(base_url: &str) -> bool {
    base_url.contains("anthropic.com")
}

pub(super) fn validate_provider_model_selection(settings: &ResolvedAiSettings) -> AppResult<()> {
    let model = settings.model.trim().to_ascii_lowercase();

    if is_anthropic_base_url(&settings.base_url) && model.starts_with("gpt-") {
        return Err(crate::error::AppError::validation_field(
            "This base URL points to Anthropic, but the model looks like OpenAI (`gpt-...`). Pick a Claude model or switch the base URL to https://api.openai.com/v1.",
            "model",
        ));
    }

    if is_official_openai_base_url(&settings.base_url) && model.starts_with("claude-") {
        return Err(crate::error::AppError::validation_field(
            "This base URL points to OpenAI, but the model looks like Anthropic (`claude-...`). Pick an OpenAI model or switch the base URL to https://api.anthropic.com/v1.",
            "model",
        ));
    }

    Ok(())
}

fn is_official_openai_base_url(base_url: &str) -> bool {
    base_url.contains("api.openai.com")
}

pub(super) fn ai_difficulty_description(value: &str) -> &'static str {
    match value {
        "Beginner" => {
            "Introductory - assume no prior knowledge. Use simple language and cover the most essential concepts."
        }
        "Advanced" => {
            "Expert level. Include edge cases, trade-offs, subtle distinctions, and deep technical detail."
        }
        _ => {
            "Assumes basic familiarity. Include nuance, important details, and connections between concepts."
        }
    }
}

pub(super) fn ai_style_description(value: &str) -> &'static str {
    match value {
        "Concept" => {
            "Concept definition cards: front = concept name or term, back = clear definition with enough context to be unambiguous."
        }
        "Cloze" => {
            "Cloze deletion cards: front = a sentence with ___ replacing the key term, back = the missing term with a one-sentence explanation."
        }
        _ => {
            "Question and answer cards: front = a precise question targeting one fact, back = a concise direct answer."
        }
    }
}
