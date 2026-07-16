use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde_json::Value;

use super::validation::is_anthropic_base_url;
use crate::error::{AppError, AppResult};
use crate::types::ResolvedAiSettings;

pub(crate) async fn execute_ai_completion(
    settings: &ResolvedAiSettings,
    user_prompt: &str,
    system_prompt: Option<&str>,
) -> AppResult<String> {
    if settings.api_key.trim().is_empty() {
        return Err(AppError::validation_field(
            "Add an API key in Settings first.",
            "apiKey",
        ));
    }

    if is_anthropic_base_url(&settings.base_url) {
        execute_anthropic_completion(settings, user_prompt, system_prompt).await
    } else {
        execute_openai_compatible_completion(settings, user_prompt, system_prompt).await
    }
}

async fn execute_openai_compatible_completion(
    settings: &ResolvedAiSettings,
    user_prompt: &str,
    system_prompt: Option<&str>,
) -> AppResult<String> {
    let endpoint = format!(
        "{}/chat/completions",
        settings.base_url.trim_end_matches('/')
    );
    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {}", settings.api_key)).map_err(|_| {
            AppError::validation_field("The API key contains invalid header characters.", "apiKey")
        })?,
    );

    let mut messages = Vec::new();
    if let Some(system_prompt) = system_prompt {
        messages.push(serde_json::json!({ "role": "system", "content": system_prompt }));
    }
    messages.push(serde_json::json!({ "role": "user", "content": user_prompt }));

    let response = reqwest::Client::new()
        .post(&endpoint)
        .headers(headers)
        .json(&serde_json::json!({
            "model": settings.model,
            "messages": messages,
            "max_tokens": settings.max_tokens,
            "temperature": settings.temperature
        }))
        .send()
        .await
        .map_err(|error| {
            AppError::ai_provider(
                format!(
                    "Failed to reach the AI provider at {endpoint} with model {}.",
                    settings.model
                ),
                Some(error.to_string()),
            )
        })?;
    let status = response.status();
    let body = response.text().await.map_err(|error| {
        AppError::ai_provider(
            format!("Failed to read the AI provider response from {endpoint}."),
            Some(error.to_string()),
        )
    })?;

    if !status.is_success() {
        return Err(AppError::ai_provider(
            "The AI provider rejected the request.",
            Some(format_provider_error(
                &endpoint,
                &settings.model,
                status.as_u16(),
                &body,
            )),
        ));
    }

    let payload: Value = serde_json::from_str(&body).map_err(|error| {
        AppError::ai_provider("Invalid provider JSON.", Some(error.to_string()))
    })?;
    let content = &payload["choices"][0]["message"]["content"];

    extract_text_content(content).ok_or_else(|| {
        AppError::ai_provider("The provider returned no message content.", None::<String>)
    })
}

async fn execute_anthropic_completion(
    settings: &ResolvedAiSettings,
    user_prompt: &str,
    system_prompt: Option<&str>,
) -> AppResult<String> {
    let endpoint = format!("{}/messages", settings.base_url.trim_end_matches('/'));
    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    headers.insert(
        "x-api-key",
        HeaderValue::from_str(&settings.api_key).map_err(|_| {
            AppError::validation_field("The API key contains invalid header characters.", "apiKey")
        })?,
    );
    headers.insert("anthropic-version", HeaderValue::from_static("2023-06-01"));

    let response = reqwest::Client::new()
        .post(&endpoint)
        .headers(headers)
        .json(&serde_json::json!({
            "model": settings.model,
            "max_tokens": settings.max_tokens,
            "temperature": settings.temperature,
            "system": system_prompt.unwrap_or_default(),
            "messages": [{ "role": "user", "content": user_prompt }]
        }))
        .send()
        .await
        .map_err(|error| {
            AppError::ai_provider(
                format!(
                    "Failed to reach the AI provider at {endpoint} with model {}.",
                    settings.model
                ),
                Some(error.to_string()),
            )
        })?;
    let status = response.status();
    let body = response.text().await.map_err(|error| {
        AppError::ai_provider(
            format!("Failed to read the AI provider response from {endpoint}."),
            Some(error.to_string()),
        )
    })?;

    if !status.is_success() {
        return Err(AppError::ai_provider(
            "The AI provider rejected the request.",
            Some(format_provider_error(
                &endpoint,
                &settings.model,
                status.as_u16(),
                &body,
            )),
        ));
    }

    let payload: Value = serde_json::from_str(&body).map_err(|error| {
        AppError::ai_provider("Invalid provider JSON.", Some(error.to_string()))
    })?;
    let content = payload["content"].as_array().ok_or_else(|| {
        AppError::ai_provider("The provider returned no content array.", None::<String>)
    })?;
    let mut text = String::new();

    for part in content {
        if part["type"].as_str() == Some("text") {
            if let Some(part_text) = part["text"].as_str() {
                text.push_str(part_text);
            }
        }
    }

    if text.trim().is_empty() {
        return Err(AppError::ai_provider(
            "The provider returned no text content.",
            None::<String>,
        ));
    }

    Ok(text)
}

fn extract_text_content(value: &Value) -> Option<String> {
    if let Some(text) = value.as_str() {
        return Some(text.to_string());
    }

    value.as_array().map(|parts| {
        parts
            .iter()
            .filter_map(|part| {
                part.get("text")
                    .and_then(Value::as_str)
                    .or_else(|| part.get("content").and_then(Value::as_str))
            })
            .collect::<String>()
    })
}

fn format_provider_error(endpoint: &str, model: &str, status_code: u16, body: &str) -> String {
    let detail = extract_provider_error_detail(body);

    if detail.is_empty() {
        format!("The AI provider at {endpoint} rejected model {model} with HTTP {status_code}.")
    } else {
        format!(
            "The AI provider at {endpoint} rejected model {model} with HTTP {status_code}: {detail}"
        )
    }
}

fn extract_provider_error_detail(body: &str) -> String {
    let trimmed = body.trim();

    if trimmed.is_empty() {
        return String::new();
    }

    if let Ok(payload) = serde_json::from_str::<Value>(trimmed) {
        let message = payload
            .pointer("/error/message")
            .and_then(Value::as_str)
            .or_else(|| payload.pointer("/message").and_then(Value::as_str))
            .or_else(|| payload.pointer("/error").and_then(Value::as_str));

        if let Some(message) = message {
            return truncate_message_detail(message);
        }
    }

    truncate_message_detail(trimmed)
}

fn truncate_message_detail(detail: &str) -> String {
    let collapsed = detail.split_whitespace().collect::<Vec<_>>().join(" ");
    let mut chars = collapsed.chars();
    let truncated = chars.by_ref().take(240).collect::<String>();

    if chars.next().is_some() {
        format!("{truncated}…")
    } else {
        truncated
    }
}
