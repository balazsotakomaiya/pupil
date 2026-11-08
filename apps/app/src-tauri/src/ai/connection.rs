//! How an AI request reaches a model. Each connection kind is its own
//! transport; nothing falls back from one to another, so a subscription
//! failure can never quietly turn into a paid API request.

use std::time::Duration;

use serde::Serialize;

use super::cancellation::{run_bounded, CancelToken};
use super::chatgpt::{ChatgptEndpoints, CHATGPT_PROVIDER};
use super::chatgpt_session::{execute_chatgpt_completion, CredentialStore, SessionPin};
use super::claude_code::{execute_claude_code_completion, ClaudeCodeTarget};
use super::provider::execute_ai_completion;
use crate::constants::AI_REQUEST_TIMEOUT_SECS;
use crate::error::AppResult;
use crate::types::ResolvedAiSettings;

pub(crate) const API_PROVIDER: &str = "api";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum AiConnectionKind {
    /// An API key with an OpenAI-compatible, Anthropic, custom or local endpoint.
    ApiKey,
    /// The user's ChatGPT plan through OpenAI's plan-usage sign-in.
    Chatgpt,
    /// The user's Claude plan through their own signed-in Claude Code.
    ClaudeCode,
}

impl AiConnectionKind {
    pub(crate) fn as_db(self) -> &'static str {
        match self {
            Self::ApiKey => "api_key",
            Self::Chatgpt => "chatgpt",
            Self::ClaudeCode => "claude_code",
        }
    }

    /// Unknown stored values fall back to the API connection that every
    /// install had before subscriptions existed.
    pub(crate) fn from_db(value: &str) -> Self {
        match value {
            "chatgpt" => Self::Chatgpt,
            "claude_code" => Self::ClaudeCode,
            _ => Self::ApiKey,
        }
    }

    pub(crate) fn from_input(value: &str) -> Result<Self, String> {
        match value.trim() {
            "apiKey" => Ok(Self::ApiKey),
            "chatgpt" => Ok(Self::Chatgpt),
            "claudeCode" => Ok(Self::ClaudeCode),
            _ => Err("Choose an API key, ChatGPT, or Claude connection.".to_string()),
        }
    }
}

/// A fully resolved destination for one request.
pub(crate) enum ResolvedAiTarget {
    Api(ResolvedAiSettings),
    Chatgpt { model: String },
    ClaudeCode(ClaudeCodeTarget),
}

impl ResolvedAiTarget {
    pub(crate) fn model(&self) -> &str {
        match self {
            Self::Api(settings) => &settings.model,
            Self::Chatgpt { model } => model,
            Self::ClaudeCode(target) => &target.model,
        }
    }
}

/// What a request needs besides its target: the ChatGPT credential store,
/// the ChatGPT session it started in, OpenAI's endpoints, and the
/// cancellation token for this request.
pub(crate) struct AiExecution<'a> {
    pub(crate) store: &'a dyn CredentialStore,
    pub(crate) session: SessionPin,
    pub(crate) endpoints: &'a ChatgptEndpoints,
    pub(crate) token: CancelToken,
}

pub(crate) async fn execute_ai_target(
    target: &ResolvedAiTarget,
    execution: &AiExecution<'_>,
    user_prompt: &str,
    system_prompt: Option<&str>,
) -> AppResult<String> {
    // HTTP transports carry their own request timeout; this outer bound is
    // the cancel hook plus a backstop slightly above it.
    let backstop = Duration::from_secs(AI_REQUEST_TIMEOUT_SECS + 30);
    match target {
        ResolvedAiTarget::Api(settings) => {
            run_bounded(
                API_PROVIDER,
                &execution.token,
                backstop,
                format!(
                    "The AI provider didn't respond within {}s.",
                    backstop.as_secs()
                ),
                execute_ai_completion(settings, user_prompt, system_prompt),
            )
            .await
        }
        ResolvedAiTarget::Chatgpt { model } => {
            run_bounded(
                CHATGPT_PROVIDER,
                &execution.token,
                backstop,
                format!("ChatGPT didn't respond within {}s.", backstop.as_secs()),
                execute_chatgpt_completion(
                    execution.endpoints,
                    execution.store,
                    execution.session,
                    model,
                    system_prompt,
                    user_prompt,
                    &crate::util::now_ms,
                ),
            )
            .await
        }
        ResolvedAiTarget::ClaudeCode(target) => {
            execute_claude_code_completion(target, user_prompt, system_prompt, &execution.token)
                .await
                .map(|output| output.text)
        }
    }
}
