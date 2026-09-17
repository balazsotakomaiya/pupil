use std::collections::HashSet;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::AppHandle;

use super::secrets::load_ai_api_key;
use super::settings::load_ai_settings_state;
use super::validation::normalize_base_url;
use crate::error::{AppError, AppResult};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ListAiModelsInput {
    pub base_url: String,
    pub api_key: Option<String>,
}

#[derive(Serialize)]
pub(crate) struct AiModelCatalog {
    pub models: Vec<String>,
    pub popular: bool,
}

pub(crate) fn resolve_model_catalog_credentials(
    app: &AppHandle,
    connection: &rusqlite::Connection,
    input: ListAiModelsInput,
) -> AppResult<(String, Option<String>)> {
    let base_url = normalize_model_catalog_base_url(&input.base_url)?;
    let key = match input.api_key {
        Some(key) => Some(key.trim().to_string()),
        None => {
            let saved = load_ai_settings_state(app, connection)?;
            // A draft endpoint must never receive another provider's saved key.
            if base_url != saved.base_url.trim_end_matches('/') {
                None
            } else {
                load_ai_api_key(app)?
            }
        }
    };
    Ok((base_url, key.filter(|key| !key.is_empty())))
}

pub(crate) async fn fetch_model_catalog(
    base_url: &str,
    api_key: Option<&str>,
) -> AppResult<AiModelCatalog> {
    let endpoint = model_catalog_endpoint(base_url)?;
    let anthropic = endpoint.host_str() == Some("api.anthropic.com");
    let popular = endpoint.host_str() == Some("openrouter.ai");
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(12))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| AppError::internal_message("Couldn't create the model discovery client."))?;
    let mut request = client.get(endpoint);
    if let Some(key) = api_key {
        request = if anthropic {
            request.header("x-api-key", key)
        } else {
            request.bearer_auth(key)
        };
    }
    if anthropic {
        request = request.header("anthropic-version", "2023-06-01");
    }
    let response = request.send().await.map_err(|_| {
        AppError::ai_provider(
            "Couldn't reach this endpoint's model catalog.",
            None::<String>,
        )
    })?;
    if !response.status().is_success() {
        return Err(AppError::ai_provider(
            format!(
                "Model discovery returned HTTP {}. Check the URL and API key.",
                response.status().as_u16()
            ),
            None::<String>,
        ));
    }
    let payload: Value = response.json().await.map_err(|_| {
        AppError::ai_provider(
            "This endpoint returned an invalid model catalog.",
            None::<String>,
        )
    })?;
    parse_model_catalog(payload, popular)
}

pub(crate) fn parse_model_catalog(payload: Value, popular: bool) -> AppResult<AiModelCatalog> {
    let entries = payload
        .get("data")
        .and_then(Value::as_array)
        .ok_or_else(|| {
            AppError::ai_provider(
                "This endpoint doesn't provide a compatible model catalog.",
                None::<String>,
            )
        })?;
    let mut seen = HashSet::new();
    let models = entries
        .iter()
        .filter_map(|entry| {
            let id = entry.get("id")?.as_str()?.trim();
            // OpenRouter advertises modalities; generic catalogs usually only give IDs.
            if let Some(outputs) = entry
                .pointer("/architecture/output_modalities")
                .and_then(Value::as_array)
            {
                if !outputs.iter().any(|output| output.as_str() == Some("text")) {
                    return None;
                }
            }
            let lowered = id.to_ascii_lowercase();
            if id.is_empty()
                || lowered.ends_with(":batch")
                || lowered.starts_with("dall-e")
                || [
                    "embedding",
                    "whisper",
                    "tts",
                    "dall-e",
                    "moderation",
                    "realtime",
                    "transcribe",
                    "image",
                    "audio",
                    "live",
                    "rerank",
                ]
                .iter()
                .any(|part| {
                    lowered
                        .split(|ch: char| !ch.is_ascii_alphanumeric())
                        .any(|token| token.starts_with(part))
                })
                || !seen.insert(id.to_string())
            {
                return None;
            }
            Some(id.to_string())
        })
        .take(1000)
        .collect();
    Ok(AiModelCatalog { models, popular })
}

pub(crate) fn model_catalog_endpoint(base_url: &str) -> AppResult<reqwest::Url> {
    let host = reqwest::Url::parse(base_url)
        .ok()
        .and_then(|url| url.host_str().map(str::to_owned))
        .unwrap_or_default();
    let anthropic = host == "api.anthropic.com";
    let popular = host == "openrouter.ai";
    let mut endpoint = reqwest::Url::parse(&format!("{}/models", base_url.trim_end_matches('/')))
        .map_err(|_| AppError::validation("Enter a valid provider URL."))?;
    if popular {
        endpoint
            .query_pairs_mut()
            .append_pair("sort", "most-popular")
            .append_pair("output_modalities", "text")
            .append_pair("limit", "500");
    } else if anthropic {
        endpoint.query_pairs_mut().append_pair("limit", "1000");
    }
    Ok(endpoint)
}

pub(crate) fn normalize_model_catalog_base_url(value: &str) -> AppResult<String> {
    let base_url = normalize_base_url(value).map_err(AppError::validation)?;
    let url = reqwest::Url::parse(&base_url)
        .map_err(|_| AppError::validation("Enter a valid provider URL."))?;
    if !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err(AppError::validation(
            "Use a provider base URL without credentials, a query, or a fragment.",
        ));
    }
    Ok(base_url)
}
