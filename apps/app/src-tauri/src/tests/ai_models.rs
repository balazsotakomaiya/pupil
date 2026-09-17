use crate::ai::parse_model_catalog;
use serde_json::json;

#[test]
fn catalog_preserves_ranked_text_models_without_duplicates() {
    let catalog = parse_model_catalog(
        json!({"data": [
            {"id": "provider/popular", "architecture": {"output_modalities": ["text"]}},
            {"id": "provider/second"},
            {"id": "provider/popular"},
            {"id": "provider/image-only", "architecture": {"output_modalities": ["image"]}},
            {"id": "text-embedding-3-small"},
            {"id": "whisper-1"},
            {"id": ""},
            {"name": "Missing ID"}
        ]}),
        true,
    )
    .unwrap();
    assert_eq!(catalog.models, vec!["provider/popular", "provider/second"]);
    assert!(catalog.popular);
}

#[test]
fn catalog_rejects_an_incompatible_response() {
    assert!(parse_model_catalog(json!({"models": ["not-an-openai-catalog"]}), false).is_err());
}

#[test]
fn empty_model_catalog_is_valid_and_not_ranked() {
    let catalog = parse_model_catalog(json!({"data": []}), false).unwrap();
    assert!(catalog.models.is_empty());
    assert!(!catalog.popular);
}

#[test]
fn latest_openai_requests_use_reasoning_compatible_parameters() {
    use crate::ai::build_openai_payload;
    use crate::types::ResolvedAiSettings;
    let settings = ResolvedAiSettings {
        api_key: "key".into(),
        base_url: "https://api.openai.com/v1".into(),
        model: "gpt-5.6-terra".into(),
        max_tokens: 4096,
        temperature: 0.7,
    };
    let payload =
        build_openai_payload(&settings, vec![json!({"role": "user", "content": "hello"})]);
    assert_eq!(payload["max_completion_tokens"], 4096);
    assert_eq!(payload["reasoning_effort"], "low");
    assert!(payload.get("max_tokens").is_none());
    assert!(payload.get("temperature").is_none());
}

#[test]
fn compatible_non_reasoning_requests_keep_temperature_and_token_limit() {
    use crate::ai::build_openai_payload;
    use crate::types::ResolvedAiSettings;
    let settings = ResolvedAiSettings {
        api_key: "key".into(),
        base_url: "http://localhost:11434/v1".into(),
        model: "llama3.2".into(),
        max_tokens: 4096,
        temperature: 0.7,
    };
    let payload = build_openai_payload(&settings, vec![]);
    assert_eq!(payload["max_tokens"], 4096);
    assert_eq!(payload["temperature"], 0.7);
    assert!(payload.get("reasoning_effort").is_none());
}

#[test]
fn latest_claude_models_omit_custom_sampling_in_both_wire_formats() {
    use crate::ai::supports_custom_temperature;
    assert!(!supports_custom_temperature("claude-sonnet-5"));
    assert!(!supports_custom_temperature("anthropic/claude-opus-5"));
    assert!(supports_custom_temperature("claude-haiku-4-5"));
}

fn serve_catalog_once(status: &str, body: &str) -> (String, std::thread::JoinHandle<String>) {
    use std::io::{Read, Write};
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap();
    let response = format!("HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len());
    let handle = std::thread::spawn(move || {
        let (mut stream, _) = listener.accept().unwrap();
        stream
            .set_read_timeout(Some(std::time::Duration::from_secs(3)))
            .unwrap();
        let mut request = Vec::new();
        let mut bytes = [0; 1024];
        loop {
            let count = stream.read(&mut bytes).unwrap();
            request.extend_from_slice(&bytes[..count]);
            if count == 0 || request.windows(4).any(|window| window == b"\r\n\r\n") {
                break;
            }
        }
        stream.write_all(response.as_bytes()).unwrap();
        String::from_utf8(request).unwrap()
    });
    (format!("http://{address}/v1"), handle)
}

#[test]
fn discovery_reads_the_configured_endpoint_with_the_supplied_key() {
    let (url, server) = serve_catalog_once("200 OK", r#"{"data":[{"id":"local-model"}]}"#);
    let result =
        tauri::async_runtime::block_on(crate::ai::fetch_model_catalog(&url, Some("test-key")))
            .unwrap();
    let request = server.join().unwrap().to_ascii_lowercase();
    assert!(request.starts_with("get /v1/models "));
    assert!(request.contains("authorization: bearer test-key"));
    assert_eq!(result.models, vec!["local-model"]);
    assert!(!result.popular);
}

#[test]
fn local_discovery_works_without_an_api_key() {
    let (url, server) = serve_catalog_once("200 OK", r#"{"data":[{"id":"local-model"}]}"#);
    let result =
        tauri::async_runtime::block_on(crate::ai::fetch_model_catalog(&url, None)).unwrap();
    assert!(!server
        .join()
        .unwrap()
        .to_ascii_lowercase()
        .contains("authorization:"));
    assert_eq!(result.models, vec!["local-model"]);
}

#[test]
fn discovery_reports_a_rejected_catalog_without_exposing_its_response_body() {
    let (url, server) = serve_catalog_once(
        "401 Unauthorized",
        r#"{"error":"private provider details"}"#,
    );
    let error =
        tauri::async_runtime::block_on(crate::ai::fetch_model_catalog(&url, Some("test-key")))
            .err()
            .unwrap();
    server.join().unwrap();
    let message = format!("{error:?}");
    assert!(message.contains("HTTP 401"));
    assert!(!message.contains("private provider details"));
}

#[test]
fn discovery_rejects_invalid_provider_json() {
    let (url, server) = serve_catalog_once("200 OK", "not json");
    assert!(tauri::async_runtime::block_on(crate::ai::fetch_model_catalog(&url, None)).is_err());
    server.join().unwrap();
}

#[test]
fn batch_only_models_are_not_offered_for_interactive_generation() {
    let catalog = parse_model_catalog(
        json!({"data":[{"id":"model:batch"},{"id":"delivery-assistant"}]}),
        false,
    )
    .unwrap();
    assert_eq!(catalog.models, vec!["delivery-assistant"]);
}

#[test]
fn openrouter_catalog_requests_popular_text_models() {
    let url = crate::ai::model_catalog_endpoint("https://openrouter.ai/api/v1").unwrap();
    assert_eq!(url.path(), "/api/v1/models");
    let query: std::collections::HashMap<_, _> = url.query_pairs().collect();
    assert_eq!(
        query.get("sort").map(|value| value.as_ref()),
        Some("most-popular")
    );
    assert_eq!(
        query.get("output_modalities").map(|value| value.as_ref()),
        Some("text")
    );
}

#[test]
fn anthropic_catalog_requests_the_full_current_model_page() {
    let url = crate::ai::model_catalog_endpoint("https://api.anthropic.com/v1").unwrap();
    assert_eq!(
        url.as_str(),
        "https://api.anthropic.com/v1/models?limit=1000"
    );
}

#[test]
fn custom_endpoint_names_do_not_activate_official_provider_query_parameters() {
    let url = crate::ai::model_catalog_endpoint("https://example.com/openrouter.ai/v1/").unwrap();
    assert_eq!(url.path(), "/openrouter.ai/v1/models");
    assert!(url.query().is_none());
}

#[test]
fn discovery_rejects_credentials_and_query_parameters_in_the_base_url() {
    use crate::ai::normalize_model_catalog_base_url;
    for url in [
        "",
        "not a URL",
        "https://",
        "https://user:password@example.com/v1",
        "https://example.com/v1?key=secret",
        "https://example.com/v1#fragment",
    ] {
        assert!(
            normalize_model_catalog_base_url(url).is_err(),
            "Invalid catalog URL was accepted"
        );
    }
    assert_eq!(
        normalize_model_catalog_base_url(" http://localhost:11434/v1/ ").unwrap(),
        "http://localhost:11434/v1"
    );
}
