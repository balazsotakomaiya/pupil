use crate::types::Migration;

pub(crate) const SPACE_NAME_MAX_LENGTH: usize = 80;
#[cfg(debug_assertions)]
pub(crate) const DEVELOPER_OPEN_DEVTOOLS_MENU_ID: &str = "developer.open_devtools";
#[cfg(debug_assertions)]
pub(crate) const DEVELOPER_RESET_ONBOARDING_MENU_ID: &str = "developer.reset_onboarding";
#[cfg(debug_assertions)]
pub(crate) const DEVELOPER_RESET_ONBOARDING_EVENT: &str = "developer://reset-onboarding";
pub(crate) const AI_SETTING_BASE_URL_KEY: &str = "ai.base_url";
pub(crate) const AI_SETTING_MODEL_KEY: &str = "ai.model";
pub(crate) const AI_SETTING_MAX_TOKENS_KEY: &str = "ai.max_tokens";
pub(crate) const AI_SETTING_TEMPERATURE_KEY: &str = "ai.temperature";
pub(crate) const AI_SETTING_HAS_API_KEY_KEY: &str = "ai.has_api_key";
#[cfg(target_os = "macos")]
pub(crate) const AI_SECRET_SERVICE_NAME: &str = "com.pupil.desktop.ai";
#[cfg(target_os = "macos")]
pub(crate) const AI_SECRET_ACCOUNT_NAME: &str = "api_key";
pub(crate) const RECENT_ACTIVITY_SESSION_GAP_MS: i64 = 30 * 60 * 1000;
pub(crate) const RECENT_ACTIVITY_FETCH_MULTIPLIER: i64 = 50;
pub(crate) const MIN_RECENT_ACTIVITY_FETCH_LIMIT: i64 = 200;
pub(crate) const DEFAULT_AI_BASE_URL: &str = "https://api.openai.com/v1";
pub(crate) const DEFAULT_AI_MODEL: &str = "gpt-5.4";
pub(crate) const DEFAULT_AI_MAX_TOKENS: &str = "4096";
pub(crate) const DEFAULT_AI_TEMPERATURE: &str = "0.7";
#[cfg_attr(target_os = "macos", allow(dead_code))]
pub(crate) const STRONGHOLD_SNAPSHOT_FILE_NAME: &str = "pupil.hold";
#[cfg_attr(target_os = "macos", allow(dead_code))]
pub(crate) const STRONGHOLD_CLIENT_NAME: &[u8] = b"pupil";
#[cfg_attr(target_os = "macos", allow(dead_code))]
pub(crate) const STRONGHOLD_AI_API_KEY_RECORD_KEY: &[u8] = b"ai.api_key";

pub(crate) const AI_SYSTEM_PROMPT: &str = r#"You are an expert flashcard author. Your job is to produce flashcards that maximize long-term retention using the principles of spaced repetition.

Rules:
1. Return ONLY a valid JSON array. No markdown fences, no commentary, no wrapper object.
2. Each element: { "front": "...", "back": "..." }
3. Both "front" and "back" must be non-empty strings.
4. Keep the front concise - a single clear question, term, or cloze prompt. No compound questions.
5. Keep the back focused - a direct answer with just enough context to disambiguate. No essays.
6. Avoid trivial or overly broad cards. Each card should test one atomic piece of knowledge.
7. Order cards from foundational concepts to more advanced topics.
8. Do not number or prefix the cards.
9. For cloze style: front uses "___" for the blank, back gives the missing term plus a one-sentence explanation.
10. Avoid duplicating information across cards. Each card should cover a distinct fact or concept."#;

pub(crate) const MIGRATIONS: &[Migration] = &[
    Migration {
        id: "0001_init",
        sql: include_str!("../migrations/0001_init.sql"),
    },
    Migration {
        id: "0002_add_learning_steps",
        sql: include_str!("../migrations/0002_add_learning_steps.sql"),
    },
    Migration {
        id: "0003_add_suspended",
        sql: include_str!("../migrations/0003_add_suspended.sql"),
    },
];
