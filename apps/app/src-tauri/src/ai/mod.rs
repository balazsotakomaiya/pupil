mod explain;
mod generation;
mod models;
mod provider;
mod secrets;
mod settings;
mod validation;

pub(crate) use explain::{
    build_explain_card_prompt, build_explain_prose_fallback_prompt, build_explain_repair_prompt,
    execute_explain_completion_with_retries, parse_explain_card_response,
};
pub(crate) use generation::{
    build_generate_cards_prompt, normalize_generate_cards_input, parse_generated_cards_response,
};
pub(crate) use models::{
    fetch_model_catalog, resolve_model_catalog_credentials, AiModelCatalog, ListAiModelsInput,
};
#[cfg(test)]
pub(crate) use models::{
    model_catalog_endpoint, normalize_model_catalog_base_url, parse_model_catalog,
};
pub(crate) use provider::execute_ai_completion;
#[cfg(test)]
pub(crate) use provider::{build_openai_payload, supports_custom_temperature};
pub(crate) use secrets::{clear_ai_api_key, StrongholdState};
pub(crate) use settings::{
    load_ai_settings_state, load_resolved_ai_settings, normalize_ai_settings_input,
    resolve_ai_settings_for_test, save_ai_settings_rows,
};
#[cfg(test)]
pub(crate) use validation::{trim_trailing_zeroes, validate_provider_model_selection};
