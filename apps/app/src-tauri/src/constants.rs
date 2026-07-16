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
pub(crate) const AI_SETTING_EXPLAIN_ENABLED_KEY: &str = "ai.explain_enabled";
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
pub(crate) const EXPLAIN_SCHEMA_VERSION: i64 = 1;
pub(crate) const EXPLAIN_MAX_PAYLOAD_BYTES: usize = 32_000;
pub(crate) const EXPLAIN_MAX_PARAGRAPHS: usize = 7;
pub(crate) const EXPLAIN_MAX_NODES: usize = 8;
pub(crate) const EXPLAIN_MAX_EDGES: usize = 10;
pub(crate) const EXPLAIN_MAX_LABEL_LENGTH: usize = 80;
#[cfg_attr(target_os = "macos", allow(dead_code))]
pub(crate) const STRONGHOLD_SNAPSHOT_FILE_NAME: &str = "pupil.hold";
#[cfg_attr(target_os = "macos", allow(dead_code))]
pub(crate) const STRONGHOLD_CLIENT_NAME: &[u8] = b"pupil";
#[cfg_attr(target_os = "macos", allow(dead_code))]
pub(crate) const STRONGHOLD_AI_API_KEY_RECORD_KEY: &[u8] = b"ai.api_key";
#[cfg_attr(target_os = "macos", allow(dead_code))]
pub(crate) const STRONGHOLD_PASSWORD_SERVICE_NAME: &str = "com.pupil.desktop.stronghold";
#[cfg_attr(target_os = "macos", allow(dead_code))]
pub(crate) const STRONGHOLD_PASSWORD_ACCOUNT_NAME: &str = "snapshot_key";
#[cfg_attr(target_os = "macos", allow(dead_code))]
pub(crate) const STRONGHOLD_PASSWORD_BYTES: usize = 32;

pub(crate) const AI_EXPLAIN_SYSTEM_PROMPT: &str = r#"You are a patient tutor helping a learner who just got a flashcard wrong during spaced-repetition review.

Your job:
1. Identify the core concept on the back of the card.
2. Surface any prerequisite knowledge the learner likely needs to understand it.
3. Re-explain the answer clearly, in plain language, with one or two concrete examples or analogies when they help.

Rules:
- Return ONLY one valid JSON object. Do not wrap it in Markdown fences or add commentary.
- The top-level object MUST have exactly these fields:
  {
    "schemaVersion": 1,
    "paragraphs": ["plain-text paragraph", "..."],
    "visual": null
  }
- When a visual would materially improve the explanation, replace visual: null with exactly this shape. Omit optional fields rather than writing placeholder values:
  {
    "kind": "graph | tree | sequence | state | timeline | comparison",
    "title": "short visible title",
    "description": "short plain-text description",
    "direction": "TB | LR",
    "nodes": [
      {
        "id": "unique_ascii_id",
        "role": "concept | process | decision | state | actor | value | annotation",
        "label": "visible label",
        "detail": "optional plain-text detail",
        "groupId": "optional_group_id",
        "order": 1
      }
    ],
    "edges": [
      {
        "id": "unique_edge_id",
        "source": "source_node_id",
        "target": "target_node_id",
        "relation": "optional visible relationship",
        "style": "solid | dashed | bidirectional"
      }
    ],
    "groups": [{ "id": "optional_group_id", "label": "Group", "nodeIds": ["node_id"] }],
    "lanes": [{ "id": "optional_lane_id", "label": "Lane", "order": 1 }],
    "altText": "A concise text alternative that describes the visual's teaching point."
  }
- Every node ID and edge ID must be unique. Each edge source/target and each group nodeId must refer to an existing node. For sequence and timeline visuals, give every node a strictly increasing order. Tree visuals must not contain a cycle.
- paragraphs must contain 3 to 7 short plain-text paragraphs. No markdown headings, bullet lists, numbered lists, HTML, URLs, or code fences.
- Generate a visual only when the concept contains a relationship, ordered process, state transition, hierarchy, system interaction, or meaningful side-by-side comparison that is materially clearer visually than in prose.
- Do not generate a visual for a simple definition, isolated fact, short vocabulary answer, cloze answer, or an explanation where a diagram would merely decorate the text. visual may be null.
- A visual has at most 8 nodes, 10 relationships, and 80 characters per visible label. Use semantic nodes and relationships only; never return JSX, React Flow fields, coordinates, arbitrary HTML, raw Mermaid, URLs, or event handlers.
- Use kind graph, tree, sequence, state, timeline, or comparison; direction must be TB or LR. Include a concise altText.
- Speak directly to the learner ("you"). Don't recap the card before explaining — get straight to the substance.
- Don't apologize or hedge. Don't repeat the front question verbatim."#;

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
10. Avoid duplicating information across cards. Each card should cover a distinct fact or concept.
11. Assume that the cards may not be presented in order, therefore each cards should not depend on eachother"#;
