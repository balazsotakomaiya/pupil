use rusqlite::Connection;

use crate::ai::{
    build_explain_prose_fallback_prompt, build_explain_repair_prompt, parse_explain_card_response,
};
use crate::cards::{fetch_card_explanation_source, save_card_explanation, update_card_row};
use crate::error::AppError;
use crate::tests::support::{open_test_connection, seed_card, seed_space};
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
    assert!(parse_explain_card_response("   ").is_err());
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
fn explanation_contract_rejects_invalid_visual_identifiers_text_and_references() {
    for invalid in [
        valid_payload().replacen("\"id\":\"first\"", "\"id\":\"bad id\"", 1),
        valid_payload().replacen("\"id\":\"last\"", "\"id\":\"first\"", 1),
        valid_payload().replacen("\"label\":\"First\"", "\"label\":\"\"", 1),
        valid_payload().replacen("\"relation\":\"then\"", "\"relation\":\"https://bad\"", 1),
        valid_payload().replacen("\"target\":\"last\"", "\"target\":\"first\"", 1),
        valid_payload().replacen("\"id\":\"next\"", "\"id\":\"\"", 1),
        valid_payload().replacen("\"title\":\"A process\"", "\"title\":\"<unsafe>\"", 1),
    ] {
        assert!(parse_explain_card_response(&invalid).is_err());
    }
}

#[test]
fn explanation_contract_validates_groups_lanes_and_visual_kinds() {
    let grouped = valid_payload().replace(
        "\"altText\":\"First leads to last.\"",
        "\"groups\":[{\"id\":\"group-a\",\"label\":\"Group\",\"nodeIds\":[\"first\"]}],\"lanes\":[{\"id\":\"lane-a\",\"label\":\"Lane\",\"order\":1},{\"id\":\"lane-b\",\"label\":\"Next\",\"order\":2}],\"altText\":\"First leads to last.\"",
    );
    assert!(parse_explain_card_response(&grouped).is_ok());
    assert!(parse_explain_card_response(
        &grouped.replace("\"nodeIds\":[\"first\"]", "\"nodeIds\":[\"missing\"]")
    )
    .is_err());
    assert!(parse_explain_card_response(&grouped.replace("\"order\":2", "\"order\":1")).is_err());
    assert!(parse_explain_card_response(
        &valid_payload().replace("\"kind\":\"sequence\"", "\"kind\":\"timeline\"")
    )
    .is_ok());
    assert!(parse_explain_card_response(
        &valid_payload().replace("\"kind\":\"sequence\"", "\"kind\":\"comparison\"")
    )
    .is_ok());
}

#[test]
fn explanation_contract_accepts_fenced_json_objects() {
    let fenced = format!("```json\n{}\n```", valid_payload());

    assert!(parse_explain_card_response(&fenced).is_ok());
}

#[test]
fn explanation_prompts_keep_contract_and_previous_response_context() {
    assert!(build_explain_prose_fallback_prompt().contains("schemaVersion 1"));
    let repair =
        build_explain_repair_prompt("bad response", &AppError::validation("missing field"));
    assert!(repair.contains("bad response"));
    assert!(repair.contains("missing field"));
}

fn seeded_connection() -> Connection {
    let connection = open_test_connection();
    seed_space(&connection, "space-a", "Space A", 1);
    seed_card(
        &connection,
        "card-a",
        "space-a",
        "Front",
        "Back",
        0,
        1,
        false,
        1,
    );
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
