mod explain;
mod generation;
mod provider;
mod secrets;
mod settings;
mod validation;

pub(crate) use explain::{
    build_explain_prose_fallback_prompt, build_explain_repair_prompt,
    execute_explain_completion_with_retries, parse_explain_card_response,
};
pub(crate) use generation::{
    build_generate_cards_prompt, normalize_generate_cards_input, parse_generated_cards_response,
};
pub(crate) use provider::execute_ai_completion;
pub(crate) use secrets::{clear_ai_api_key, StrongholdState};
pub(crate) use settings::{
    load_ai_settings_state, load_resolved_ai_settings, normalize_ai_settings_input,
    resolve_ai_settings_for_test, save_ai_settings_rows,
};
#[cfg(test)]
pub(crate) use validation::{trim_trailing_zeroes, validate_provider_model_selection};
