mod cancellation;
mod chatgpt;
mod chatgpt_session;
mod claude_code;
mod connection;
mod explain;
mod generation;
mod models;
mod provider;
mod secrets;
mod settings;
mod settings_store;
mod validation;

pub(crate) use cancellation::AiRequestRegistry;
pub(crate) use chatgpt::{ChatgptEndpoints, ChatgptModel, CHATGPT_PROVIDER};
pub(crate) use chatgpt_session::{
    disconnect as disconnect_chatgpt, list_chatgpt_models, load_sign_in_inputs, record_sign_in,
    record_status as record_chatgpt_status, run_sign_in as run_chatgpt_sign_in, sign_in_control,
    ChatgptStatus,
};
pub(crate) use claude_code::{probe_status as probe_claude_code_status, ClaudeCodeStatus};
pub(crate) use connection::{execute_ai_target, AiConnectionKind, AiExecution, ResolvedAiTarget};
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
#[cfg(test)]
pub(crate) use provider::{build_openai_payload, supports_custom_temperature};
pub(crate) use secrets::{
    clear_ai_api_key, clear_chatgpt_credentials, SecureCredentialStore, StrongholdState,
};
pub(crate) use settings::{
    claude_code_workdir, load_ai_settings_state, load_resolved_ai_target,
    normalize_ai_settings_input, record_claude_code_ready, resolve_ai_target_for_test,
    save_ai_settings_rows,
};
#[cfg(test)]
pub(crate) use validation::{trim_trailing_zeroes, validate_provider_model_selection};

#[cfg(test)]
pub(crate) mod testing {
    //! Internals the integration tests in `src/tests/` exercise directly.
    pub(crate) use super::cancellation::{run_bounded, CancelToken};
    pub(crate) use super::chatgpt::{
        build_authorize_url, build_responses_payload, classify_chatgpt_error, classify_token_error,
        is_valid_host_id, new_host_id, parse_callback, parse_discovery, parse_models,
        parse_responses_stream, pkce_challenge, validate_id_claims, verify_rs256,
        ChatgptCredentials, PendingAuthorization, PLAN_USAGE_SCOPE,
    };
    pub(crate) use super::chatgpt_session::{
        ensure_fresh_credentials, execute_chatgpt_completion, CredentialStore, SignInControl,
        SignInInputs,
    };
    pub(crate) use super::claude_code::{
        build_run_args, candidate_paths, child_path_var, classify_run_error, discover_binary,
        evaluate_auth, execute_claude_code_completion, parse_auth_status, parse_run_output,
        parse_version, run_command, validate_binary_path, validate_model as validate_claude_model,
        ClaudeAuthStatus, ClaudeCodeTarget, CommandOutput, DiscoveryEnv,
    };
    pub(crate) use super::connection::AiConnectionKind;
    pub(crate) use super::explain::is_transient_ai_error;
    pub(crate) use super::settings::{
        load_ai_settings_rows, persist_ai_settings_rows, record_claude_code_ready,
        resolve_ai_target, AiDraft,
    };
}
