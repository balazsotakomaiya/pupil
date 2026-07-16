use std::collections::HashSet;

use serde::{Deserialize, Serialize};

use crate::constants::{
    EXPLAIN_MAX_EDGES, EXPLAIN_MAX_LABEL_LENGTH, EXPLAIN_MAX_NODES, EXPLAIN_MAX_PARAGRAPHS,
    EXPLAIN_MAX_PAYLOAD_BYTES, EXPLAIN_SCHEMA_VERSION,
};

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
pub(crate) struct UndoReviewCardInput {
    pub(crate) id: String,
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
    pub(crate) explain_enabled: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SaveAiSettingsInput {
    pub(crate) api_key: Option<String>,
    pub(crate) base_url: String,
    pub(crate) model: String,
    pub(crate) max_tokens: String,
    pub(crate) temperature: String,
    pub(crate) explain_enabled: Option<bool>,
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

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ExplainCardInput {
    pub(crate) card_id: String,
    pub(crate) force: Option<bool>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ExplainCardResult {
    pub(crate) payload: ExplainCardPayload,
    pub(crate) generated_at: i64,
    pub(crate) cached: bool,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct ExplainCardPayload {
    pub(crate) schema_version: i64,
    pub(crate) paragraphs: Vec<String>,
    pub(crate) visual: Option<VisualSpec>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct VisualSpec {
    pub(crate) kind: VisualKind,
    pub(crate) title: String,
    pub(crate) description: String,
    pub(crate) direction: VisualDirection,
    pub(crate) nodes: Vec<VisualNode>,
    pub(crate) edges: Vec<VisualEdge>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) groups: Option<Vec<VisualGroup>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) lanes: Option<Vec<VisualLane>>,
    pub(crate) alt_text: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum VisualKind {
    Graph,
    Tree,
    Sequence,
    State,
    Timeline,
    Comparison,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub(crate) enum VisualDirection {
    #[serde(rename = "TB")]
    TopToBottom,
    #[serde(rename = "LR")]
    LeftToRight,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct VisualNode {
    pub(crate) id: String,
    pub(crate) role: VisualNodeRole,
    pub(crate) label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) detail: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) group_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) order: Option<i64>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct VisualEdge {
    pub(crate) id: String,
    pub(crate) source: String,
    pub(crate) target: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) relation: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) style: Option<VisualEdgeStyle>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum VisualNodeRole {
    Concept,
    Process,
    Decision,
    State,
    Actor,
    Value,
    Annotation,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum VisualEdgeStyle {
    Solid,
    Dashed,
    Bidirectional,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct VisualGroup {
    pub(crate) id: String,
    pub(crate) label: String,
    pub(crate) node_ids: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub(crate) struct VisualLane {
    pub(crate) id: String,
    pub(crate) label: String,
    pub(crate) order: i64,
}

impl ExplainCardPayload {
    pub(crate) fn validate(&self, serialized_len: usize) -> Result<(), String> {
        if serialized_len > EXPLAIN_MAX_PAYLOAD_BYTES {
            return Err("payload exceeds the maximum size".to_string());
        }
        if self.schema_version != EXPLAIN_SCHEMA_VERSION {
            return Err("unsupported explanation schema version".to_string());
        }
        if self.paragraphs.len() < 3 || self.paragraphs.len() > EXPLAIN_MAX_PARAGRAPHS {
            return Err("explanation must contain 3 to 7 paragraphs".to_string());
        }
        if self
            .paragraphs
            .iter()
            .any(|paragraph| !safe_text(paragraph))
        {
            return Err("paragraphs must be non-empty plain text".to_string());
        }
        if let Some(visual) = &self.visual {
            visual.validate()?;
        }
        Ok(())
    }
}

/// Parses a payload read from SQLite. Unlike provider-response parsing, stored
/// data must be a complete JSON payload with no surrounding text or fences.
pub(crate) fn parse_persisted_explain_card_payload(
    serialized: &str,
) -> Result<ExplainCardPayload, String> {
    let payload = serde_json::from_str::<ExplainCardPayload>(serialized)
        .map_err(|error| error.to_string())?;
    payload.validate(serialized.len())?;

    Ok(payload)
}

impl VisualSpec {
    fn validate(&self) -> Result<(), String> {
        if !safe_text(&self.title) || !safe_text(&self.description) || !safe_text(&self.alt_text) {
            return Err("visual text must be non-empty plain text".to_string());
        }
        if self.nodes.is_empty() || self.nodes.len() > EXPLAIN_MAX_NODES {
            return Err("visual must contain 1 to 8 nodes".to_string());
        }
        if self.edges.len() > EXPLAIN_MAX_EDGES {
            return Err("visual must contain at most 10 edges".to_string());
        }
        let ids = self
            .nodes
            .iter()
            .map(|node| node.id.as_str())
            .collect::<Vec<_>>();
        if ids.iter().any(|id| {
            id.is_empty()
                || !id.chars().all(|character| {
                    character.is_ascii_alphanumeric() || character == '-' || character == '_'
                })
        }) {
            return Err("visual node IDs must be simple non-empty identifiers".to_string());
        }
        if ids.iter().collect::<HashSet<_>>().len() != ids.len() {
            return Err("visual node IDs must be unique".to_string());
        }
        for node in &self.nodes {
            if !safe_limited_text(&node.label, EXPLAIN_MAX_LABEL_LENGTH) {
                return Err("visual labels must be 80 characters or fewer".to_string());
            }
            if let Some(detail) = &node.detail {
                if !safe_text(detail) {
                    return Err("visual details must be plain text".to_string());
                }
            }
        }
        let mut edge_ids = Vec::new();
        for edge in &self.edges {
            if edge.id.is_empty()
                || !ids.contains(&edge.source.as_str())
                || !ids.contains(&edge.target.as_str())
                || edge.source == edge.target
            {
                return Err("visual edges must reference distinct existing nodes".to_string());
            }
            if edge_ids.iter().any(|id| id == &edge.id) {
                return Err("visual edge IDs must be unique".to_string());
            }
            edge_ids.push(edge.id.clone());
            if let Some(relation) = &edge.relation {
                if !safe_limited_text(relation, EXPLAIN_MAX_LABEL_LENGTH) {
                    return Err("visual relationships must be 80 characters or fewer".to_string());
                }
            }
        }
        if let Some(groups) = &self.groups {
            let group_ids = groups
                .iter()
                .map(|group| group.id.as_str())
                .collect::<Vec<_>>();
            if group_ids.iter().any(|id| {
                id.is_empty()
                    || !id.chars().all(|character| {
                        character.is_ascii_alphanumeric() || character == '-' || character == '_'
                    })
            }) || group_ids.iter().collect::<HashSet<_>>().len() != group_ids.len()
            {
                return Err("visual group IDs must be unique non-empty identifiers".to_string());
            }
            for group in groups {
                if !safe_limited_text(&group.label, EXPLAIN_MAX_LABEL_LENGTH)
                    || group.node_ids.iter().any(|id| !ids.contains(&id.as_str()))
                {
                    return Err("visual groups must reference existing nodes".to_string());
                }
            }
        }
        if let Some(lanes) = &self.lanes {
            let lane_ids = lanes
                .iter()
                .map(|lane| lane.id.as_str())
                .collect::<Vec<_>>();
            if lane_ids.iter().any(|id| {
                id.is_empty()
                    || !id.chars().all(|character| {
                        character.is_ascii_alphanumeric() || character == '-' || character == '_'
                    })
            }) || lane_ids.iter().collect::<HashSet<_>>().len() != lane_ids.len()
            {
                return Err("visual lane IDs must be unique non-empty identifiers".to_string());
            }
            if lanes.windows(2).any(|pair| pair[0].order >= pair[1].order) {
                return Err("visual lane orders must be increasing".to_string());
            }
            if lanes
                .iter()
                .any(|lane| !safe_limited_text(&lane.label, EXPLAIN_MAX_LABEL_LENGTH))
            {
                return Err("visual lane labels must be 80 characters or fewer".to_string());
            }
        }
        match self.kind {
            VisualKind::Sequence | VisualKind::Timeline => {
                let mut orders = self
                    .nodes
                    .iter()
                    .map(|node| node.order)
                    .collect::<Option<Vec<_>>>()
                    .ok_or_else(|| "sequence and timeline nodes need orders".to_string())?;
                if orders.windows(2).any(|pair| pair[0] >= pair[1]) {
                    return Err("sequence and timeline orders must be increasing".to_string());
                }
                orders.dedup();
            }
            VisualKind::Tree => {
                if has_cycle(&ids, &self.edges) {
                    return Err("tree visuals must be acyclic".to_string());
                }
            }
            VisualKind::Graph | VisualKind::State | VisualKind::Comparison => {}
        }
        Ok(())
    }
}

fn safe_text(value: &str) -> bool {
    !value.trim().is_empty()
        && !value.contains("```")
        && !value.contains('<')
        && !value.contains('>')
        && !value.contains("http://")
        && !value.contains("https://")
}

fn safe_limited_text(value: &str, max_length: usize) -> bool {
    safe_text(value) && value.chars().count() <= max_length
}

fn has_cycle(ids: &[&str], edges: &[VisualEdge]) -> bool {
    fn visit(
        node: &str,
        ids: &[&str],
        edges: &[VisualEdge],
        visiting: &mut Vec<String>,
        visited: &mut Vec<String>,
    ) -> bool {
        if visiting.iter().any(|item| item == node) {
            return true;
        }
        if visited.iter().any(|item| item == node) {
            return false;
        }
        visiting.push(node.to_string());
        for edge in edges.iter().filter(|edge| edge.source == node) {
            if visit(&edge.target, ids, edges, visiting, visited) {
                return true;
            }
        }
        visiting.retain(|item| item != node);
        visited.push(node.to_string());
        let _ = ids;
        false
    }
    let mut visiting = Vec::new();
    let mut visited = Vec::new();
    ids.iter()
        .any(|id| visit(id, ids, edges, &mut visiting, &mut visited))
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

#[derive(Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StudyQueueSpaceCount {
    pub(crate) space_id: String,
    pub(crate) due_count: i64,
}

#[derive(Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StudyQueueSnapshot {
    pub(crate) actionable_due_by_space: Vec<StudyQueueSpaceCount>,
    pub(crate) actionable_due_count: i64,
    pub(crate) gated_new_count: i64,
    pub(crate) overdue_review_count: i64,
}

pub(crate) struct NormalizedAiSettingsInput {
    pub(crate) api_key: Option<String>,
    pub(crate) base_url: String,
    pub(crate) model: String,
    pub(crate) max_tokens: i64,
    pub(crate) temperature: f64,
    pub(crate) explain_enabled: Option<bool>,
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

pub(crate) struct NormalizedUndoReviewCardInput {
    pub(crate) id: String,
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
