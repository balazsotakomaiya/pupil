use serde::{Deserialize, Serialize};

#[derive(Clone)]
pub(crate) struct Migration {
    pub(crate) id: &'static str,
    pub(crate) sql: &'static str,
}

#[derive(Clone)]
pub(crate) struct SpaceIdentity {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) created_at: i64,
    pub(crate) updated_at: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BootstrapState {
    pub(crate) app_data_dir: String,
    pub(crate) database_path: String,
    pub(crate) applied_migrations: Vec<String>,
    pub(crate) pending_migrations: Vec<String>,
    pub(crate) backup_created: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SpaceSummary {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) card_count: i64,
    pub(crate) due_today_count: i64,
    pub(crate) streak: i64,
    pub(crate) created_at: i64,
    pub(crate) updated_at: i64,
}

pub(crate) struct CardIdentity {
    pub(crate) space_id: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CardSummary {
    pub(crate) id: String,
    pub(crate) space_id: String,
    pub(crate) space_name: String,
    pub(crate) front: String,
    pub(crate) back: String,
    pub(crate) tags: Vec<String>,
    pub(crate) source: String,
    pub(crate) state: i64,
    pub(crate) due: i64,
    pub(crate) stability: f64,
    pub(crate) difficulty: f64,
    pub(crate) elapsed_days: i64,
    pub(crate) scheduled_days: i64,
    pub(crate) learning_steps: i64,
    pub(crate) reps: i64,
    pub(crate) lapses: i64,
    pub(crate) last_review: Option<i64>,
    pub(crate) created_at: i64,
    pub(crate) updated_at: i64,
    #[serde(rename = "suspended")]
    pub(crate) is_suspended: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CreateCardInput {
    pub(crate) space_id: String,
    pub(crate) front: String,
    pub(crate) back: String,
    pub(crate) tags: Vec<String>,
    pub(crate) source: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UpdateCardInput {
    pub(crate) id: String,
    pub(crate) space_id: String,
    pub(crate) front: String,
    pub(crate) back: String,
    pub(crate) tags: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SuspendCardInput {
    pub(crate) id: String,
    pub(crate) suspended: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ReviewCardInput {
    pub(crate) id: String,
    pub(crate) grade: i64,
    pub(crate) state: i64,
    pub(crate) due: i64,
    pub(crate) stability: f64,
    pub(crate) difficulty: f64,
    pub(crate) elapsed_days: i64,
    pub(crate) scheduled_days: i64,
    pub(crate) learning_steps: i64,
    pub(crate) reps: i64,
    pub(crate) lapses: i64,
    pub(crate) last_review: i64,
    pub(crate) review_log: ReviewCardLogInput,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ReviewCardLogInput {
    pub(crate) state: i64,
    pub(crate) due: i64,
    pub(crate) elapsed_days: Option<i64>,
    pub(crate) scheduled_days: i64,
    pub(crate) review_time: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ImportAnkiInput {
    pub(crate) source_file_name: String,
    pub(crate) target_space_id: Option<String>,
    pub(crate) cards: Vec<ImportAnkiCardInput>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ImportAnkiCardInput {
    pub(crate) deck_name: String,
    pub(crate) front: String,
    pub(crate) back: String,
    pub(crate) tags: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ImportAnkiResult {
    pub(crate) created_space_count: i64,
    pub(crate) deck_count: i64,
    pub(crate) decks: Vec<ImportDeckResult>,
    pub(crate) duplicate_count: i64,
    pub(crate) imported_count: i64,
    pub(crate) target_space_id: Option<String>,
    pub(crate) target_space_name: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ImportDeckResult {
    pub(crate) deck_name: String,
    pub(crate) imported_count: i64,
    pub(crate) skipped_count: i64,
    pub(crate) space_id: String,
    pub(crate) space_name: String,
    pub(crate) total_count: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DashboardStats {
    pub(crate) due_today: i64,
    pub(crate) global_streak: i64,
    pub(crate) studied_today: i64,
    pub(crate) study_days: Vec<String>,
    pub(crate) total_cards: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SpaceStats {
    pub(crate) retention_30d: Option<f64>,
    pub(crate) review_activity_7d: Vec<i64>,
    pub(crate) space_id: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AiSettingsState {
    pub(crate) base_url: String,
    pub(crate) model: String,
    pub(crate) max_tokens: String,
    pub(crate) temperature: String,
    pub(crate) has_api_key: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SaveAiSettingsInput {
    pub(crate) api_key: Option<String>,
    pub(crate) base_url: String,
    pub(crate) model: String,
    pub(crate) max_tokens: String,
    pub(crate) temperature: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AiConnectionTestResult {
    pub(crate) detail: String,
    pub(crate) label: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GenerateCardsInput {
    pub(crate) topic: String,
    pub(crate) count: Option<i64>,
    pub(crate) difficulty: String,
    pub(crate) style: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GeneratedCardPayload {
    pub(crate) back: String,
    pub(crate) front: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RecentActivityEntry {
    pub(crate) id: String,
    pub(crate) review_count: i64,
    pub(crate) review_time: i64,
    pub(crate) space_id: String,
    pub(crate) space_name: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SettingsDataSummary {
    pub(crate) database_path: String,
    pub(crate) review_log_count: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ExportDataResult {
    pub(crate) path: String,
    pub(crate) record_count: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StudySettingsState {
    pub(crate) new_cards_limit: Option<i64>,
    pub(crate) new_cards_today: i64,
}

pub(crate) struct NormalizedAiSettingsInput {
    pub(crate) api_key: Option<String>,
    pub(crate) base_url: String,
    pub(crate) model: String,
    pub(crate) max_tokens: i64,
    pub(crate) temperature: f64,
}

pub(crate) struct ResolvedAiSettings {
    pub(crate) api_key: String,
    pub(crate) base_url: String,
    pub(crate) model: String,
    pub(crate) max_tokens: i64,
    pub(crate) temperature: f64,
}

pub(crate) struct NormalizedGenerateCardsInput {
    pub(crate) topic: String,
    pub(crate) count: Option<i64>,
    pub(crate) difficulty: String,
    pub(crate) style: String,
}

pub(crate) struct NormalizedCardInput {
    pub(crate) space_id: String,
    pub(crate) front: String,
    pub(crate) back: String,
    pub(crate) tags: Vec<String>,
    pub(crate) source: String,
}

pub(crate) struct NormalizedCardUpdateInput {
    pub(crate) id: String,
    pub(crate) space_id: String,
    pub(crate) front: String,
    pub(crate) back: String,
    pub(crate) tags: Vec<String>,
}

pub(crate) struct NormalizedReviewCardInput {
    pub(crate) id: String,
    pub(crate) grade: i64,
    pub(crate) state: i64,
    pub(crate) due: i64,
    pub(crate) stability: f64,
    pub(crate) difficulty: f64,
    pub(crate) elapsed_days: i64,
    pub(crate) scheduled_days: i64,
    pub(crate) learning_steps: i64,
    pub(crate) reps: i64,
    pub(crate) lapses: i64,
    pub(crate) last_review: i64,
    pub(crate) review_log: NormalizedReviewCardLogInput,
}

pub(crate) struct NormalizedReviewCardLogInput {
    pub(crate) state: i64,
    pub(crate) due: i64,
    pub(crate) elapsed_days: Option<i64>,
    pub(crate) scheduled_days: i64,
    pub(crate) review_time: i64,
}

pub(crate) struct NormalizedImportAnkiCardInput {
    pub(crate) deck_name: String,
    pub(crate) front: String,
    pub(crate) back: String,
    pub(crate) tags: Vec<String>,
}

pub(crate) struct NormalizedImportAnkiInput {
    pub(crate) target_space_id: Option<String>,
    pub(crate) cards: Vec<NormalizedImportAnkiCardInput>,
}

pub(crate) struct ImportDeckAccumulator {
    pub(crate) deck_name: String,
    pub(crate) imported_count: i64,
    pub(crate) skipped_count: i64,
    pub(crate) space_id: String,
    pub(crate) space_name: String,
    pub(crate) total_count: i64,
}
