use crate::ai::{
    build_generate_cards_prompt, normalize_ai_settings_input, normalize_generate_cards_input,
    parse_generated_cards_response, trim_trailing_zeroes, validate_provider_model_selection,
};
use crate::types::{GenerateCardsInput, ResolvedAiSettings, SaveAiSettingsInput};

#[test]
fn generate_card_input_normalizes_the_user_request() {
    let input = normalize_generate_cards_input(GenerateCardsInput {
        topic: "  Rust ownership  ".to_string(),
        count: Some(2),
        difficulty: "Advanced".to_string(),
        style: "Cloze".to_string(),
    })
    .expect("normalize generation input");
    assert_eq!(input.topic, "Rust ownership");
    assert_eq!(input.count, Some(2));
}

#[test]
fn generate_card_input_rejects_a_count_above_the_limit() {
    assert!(normalize_generate_cards_input(GenerateCardsInput {
        topic: "Topic".to_string(),
        count: Some(31),
        difficulty: "Beginner".to_string(),
        style: "Concept".to_string()
    })
    .is_err());
}

#[test]
fn generate_cards_prompt_describes_the_requested_options() {
    let input = normalize_generate_cards_input(GenerateCardsInput {
        topic: "Rust ownership".to_string(),
        count: Some(2),
        difficulty: "Advanced".to_string(),
        style: "Cloze".to_string(),
    })
    .expect("normalize generation input");
    assert!(build_generate_cards_prompt(
        &input.topic,
        input.count,
        &input.difficulty,
        &input.style
    )
    .contains("Generate exactly 2 flashcards"));
    let default_prompt = build_generate_cards_prompt("Topic", None, "Intermediate", "Q&A");
    assert!(default_prompt.contains("between 6 and 20 cards"));
    assert!(default_prompt.contains("Assumes basic familiarity"));
    assert!(default_prompt.contains("Question and answer cards"));
    let beginner_prompt = build_generate_cards_prompt("Topic", Some(1), "Beginner", "Concept");
    assert!(beginner_prompt.contains("Introductory"));
    assert!(beginner_prompt.contains("Concept definition cards"));
}

#[test]
fn generated_card_parser_handles_fences_truncation_and_invalid_responses() {
    let cards = parse_generated_cards_response(
        "```json\n[{\"front\": \" One \", \"back\": \" Answer \"}, {\"front\": \"Two\", \"back\": \"Second\"}]\n```",
        Some(1),
    )
    .expect("parse fenced response");
    assert_eq!(cards.len(), 1);
    assert_eq!(cards[0].front, "One");
    assert!(parse_generated_cards_response("{\"front\": \"not an array\"}", None).is_err());
    assert!(parse_generated_cards_response("[{}]", None).is_err());
    assert!(parse_generated_cards_response("not JSON", None).is_err());
}

#[test]
fn ai_settings_validation_normalizes_values_and_rejects_invalid_provider_inputs() {
    let normalized = normalize_ai_settings_input(SaveAiSettingsInput {
        api_key: Some("  secret-is-not-persisted-in-this-test  ".to_string()),
        base_url: " https://api.openai.com/v1/ ".to_string(),
        model: " gpt-4.1 ".to_string(),
        max_tokens: " 512 ".to_string(),
        temperature: " 1.50 ".to_string(),
        explain_enabled: Some(false),
    })
    .expect("normalize settings");
    assert_eq!(normalized.base_url, "https://api.openai.com/v1");
    assert_eq!(normalized.model, "gpt-4.1");
    assert_eq!(normalized.max_tokens, 512);
    assert_eq!(normalized.temperature, 1.5);
    assert_eq!(
        normalized.api_key.as_deref(),
        Some("secret-is-not-persisted-in-this-test")
    );

    assert!(normalize_ai_settings_input(SaveAiSettingsInput {
        api_key: None,
        base_url: "example.com".to_string(),
        model: "model".to_string(),
        max_tokens: "0".to_string(),
        temperature: "3".to_string(),
        explain_enabled: None
    })
    .is_err());
    for (base_url, model, max_tokens, temperature) in [
        ("", "model", "100", "1"),
        ("https://example.com", "", "100", "1"),
        ("https://example.com", "model", "bad", "1"),
        ("https://example.com", "model", "100", "NaN"),
    ] {
        assert!(normalize_ai_settings_input(SaveAiSettingsInput {
            api_key: None,
            base_url: base_url.to_string(),
            model: model.to_string(),
            max_tokens: max_tokens.to_string(),
            temperature: temperature.to_string(),
            explain_enabled: None,
        })
        .is_err());
    }
}

#[test]
fn provider_model_validation_rejects_cross_provider_model_families() {
    let valid = ResolvedAiSettings {
        api_key: "not-used".to_string(),
        base_url: "https://api.openai.com/v1".to_string(),
        model: "gpt-4.1".to_string(),
        max_tokens: 100,
        temperature: 1.0,
    };
    validate_provider_model_selection(&valid).expect("OpenAI model matches endpoint");
    assert!(validate_provider_model_selection(&ResolvedAiSettings {
        base_url: "https://api.anthropic.com/v1".to_string(),
        model: "gpt-4.1".to_string(),
        ..valid
    })
    .is_err());
    assert!(validate_provider_model_selection(&ResolvedAiSettings {
        base_url: "https://api.openai.com/v1".to_string(),
        model: "claude-sonnet".to_string(),
        api_key: "not-used".to_string(),
        max_tokens: 100,
        temperature: 1.0,
    })
    .is_err());
}

#[test]
fn trim_trailing_zeroes_removes_fractional_padding() {
    assert_eq!(trim_trailing_zeroes(1.50), "1.5");
    assert_eq!(trim_trailing_zeroes(1.0), "1");
}
