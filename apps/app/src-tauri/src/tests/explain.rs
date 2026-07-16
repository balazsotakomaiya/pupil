use rusqlite::Connection;

use crate::ai::parse_explain_card_response;
use crate::cards::{fetch_card_explanation_source, save_card_explanation, update_card_row};
use crate::migration_runner::apply_migrations;
use crate::migrations::MIGRATIONS;
use crate::types::NormalizedCardUpdateInput;

fn valid_payload() -> String {
    serde_json::json!({
        "schemaVersion": 1,
        "paragraphs": [
            "A process can be understood as connected steps.",
            "Each step affects the next one.",
            "Following the order makes the outcome predictable."
        ],
        "visual": {
            "kind": "sequence",
            "title": "A process",
            "description": "The order matters.",
            "direction": "LR",
            "nodes": [
                {"id": "first", "role": "process", "label": "First", "order": 1},
                {"id": "last", "role": "process", "label": "Last", "order": 2}
            ],
            "edges": [{"id": "next", "source": "first", "target": "last", "relation": "then"}],
            "altText": "First leads to last."
        }
    })
    .to_string()
}

#[test]
fn explanation_contract_accepts_valid_visual_and_null_visual() {
    let parsed = parse_explain_card_response(&valid_payload()).expect("valid payload");
    assert!(parsed.visual.is_some());
    let prose_only = r#"{"schemaVersion":1,"paragraphs":["A definition.","It needs context.","This completes the explanation."],"visual":null}"#;
    assert!(parse_explain_card_response(prose_only)
        .expect("prose payload")
        .visual
        .is_none());
}

#[test]
fn explanation_serialization_omits_absent_visual_fields() {
    let payload = parse_explain_card_response(&valid_payload()).expect("valid payload");
    let serialized = serde_json::to_value(payload).expect("serialize payload");
    let visual = serialized
        .get("visual")
        .and_then(serde_json::Value::as_object)
        .expect("visual object");
    let first_node = visual["nodes"]
        .as_array()
        .and_then(|nodes| nodes.first())
        .and_then(serde_json::Value::as_object)
        .expect("first node");
    let first_edge = visual["edges"]
        .as_array()
        .and_then(|edges| edges.first())
        .and_then(serde_json::Value::as_object)
        .expect("first edge");

    assert!(!visual.contains_key("groups"));
    assert!(!visual.contains_key("lanes"));
    assert!(!first_node.contains_key("detail"));
    assert!(!first_node.contains_key("groupId"));
    assert!(!first_edge.contains_key("style"));
}

#[test]
fn explanation_contract_rejects_malformed_unsupported_oversized_and_dangling_data() {
    assert!(parse_explain_card_response("not json").is_err());
    assert!(parse_explain_card_response(
        r#"{"schemaVersion":1,"paragraphs":["x"],"visual":{"kind":"mindmap"}}"#
    )
    .is_err());
    let oversized = serde_json::json!({
        "schemaVersion": 1,
        "paragraphs": ["x".repeat(33_000)],
        "visual": null
    });
    assert!(parse_explain_card_response(&oversized.to_string()).is_err());
    let dangling = valid_payload().replace("\"target\":\"last\"", "\"target\":\"missing\"");
    assert!(parse_explain_card_response(&dangling).is_err());
}

#[test]
fn explanation_contract_rejects_tree_cycles_and_bad_sequence_order() {
    let cycle = valid_payload()
        .replace("\"kind\":\"sequence\"", "\"kind\":\"tree\"")
        .replace(
            "}],\"kind\"",
            "},{\"id\":\"back\",\"source\":\"last\",\"target\":\"first\"}],\"kind\"",
        );
    assert!(parse_explain_card_response(&cycle).is_err());
    let unordered = valid_payload().replace("\"order\":2", "\"order\":1");
    assert!(parse_explain_card_response(&unordered).is_err());
}

#[test]
fn explanation_contract_accepts_fenced_json_objects() {
    let fenced = format!("```json\n{}\n```", valid_payload());

    assert!(parse_explain_card_response(&fenced).is_ok());
}

fn seeded_connection() -> Connection {
    let mut connection = Connection::open_in_memory().expect("open db");
    apply_migrations(&mut connection, MIGRATIONS).expect("apply migrations");
    connection.execute("INSERT INTO spaces (id, name, created_at, updated_at) VALUES ('space-a', 'Space A', 1, 1)", []).expect("space");
    connection.execute("INSERT INTO cards (id, space_id, front, back, tags, source, state, due, stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses, last_review, created_at, updated_at, is_suspended) VALUES ('card-a', 'space-a', 'Front', 'Back', NULL, 'manual', 0, 1, 0, 0, 0, 0, 0, 0, 0, NULL, 1, 1, 0)", []).expect("card");
    connection
}

#[test]
fn explanation_payload_persists_and_card_edits_clear_the_cache() {
    let mut connection = seeded_connection();
    save_card_explanation(&connection, "card-a", &valid_payload(), 42).expect("save");
    let source = fetch_card_explanation_source(&connection, "card-a").expect("fetch");
    assert!(source.explanation_payload.is_some());
    update_card_row(
        &mut connection,
        NormalizedCardUpdateInput {
            id: "card-a".to_string(),
            space_id: "space-a".to_string(),
            front: "Updated front".to_string(),
            back: "Updated back".to_string(),
            tags: vec![],
        },
    )
    .expect("update");
    let source = fetch_card_explanation_source(&connection, "card-a").expect("fetch updated");
    assert!(source.explanation_generated_at.is_none());
    assert!(source.explanation_payload.is_none());
}
