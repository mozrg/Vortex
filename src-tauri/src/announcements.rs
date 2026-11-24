use serde_json::Value;
use std::{
    sync::{Mutex, OnceLock},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

const SOURCE_URL: &str =
    "https://raw.githubusercontent.com/mozrg/Vortex/main/site/notifications.json";
const CACHE_TTL: Duration = Duration::from_secs(5 * 60);
const RELEASES_API: &str = "https://api.github.com/repos/mozrg/Vortex/releases/tags";
const ALL_RELEASES_API: &str = "https://api.github.com/repos/mozrg/Vortex/releases?per_page=30";

fn all_releases_cache() -> &'static Mutex<Option<(Instant, Vec<Value>)>> {
    static CACHE: OnceLock<Mutex<Option<(Instant, Vec<Value>)>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(None))
}

#[tauri::command]
pub async fn announcement_all_releases() -> Result<Vec<Value>, String> {
    if let Ok(guard) = all_releases_cache().lock() {
        if let Some((at, items)) = guard.as_ref() {
            if at.elapsed() < CACHE_TTL {
                return Ok(items.clone());
            }
        }
    }
    let client = crate::roblox::shared_github_client();
    let response = client
        .get(ALL_RELEASES_API)
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .send()
        .await
        .map_err(|error| error.to_string())?;
    let data: Value = response
        .error_for_status()
        .map_err(|error| error.to_string())?
        .json()
        .await
        .map_err(|error| error.to_string())?;
    let releases: Vec<Value> = data
        .as_array()
        .into_iter()
        .flatten()
        .filter(|rel| rel.get("draft").and_then(Value::as_bool) != Some(true))
        .filter_map(|rel| {
            let tag = rel.get("tag_name").and_then(Value::as_str)?.trim();
            if tag.is_empty() {
                return None;
            }
            let name = rel
                .get("name")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .unwrap_or(tag);
            let body = rel
                .get("body")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .trim();
            let date = rel.get("published_at").cloned().unwrap_or(Value::Null);
            let url = rel
                .get("html_url")
                .and_then(Value::as_str)
                .unwrap_or_default();
            Some(serde_json::json!({
                "tag": tag,
                "name": name,
                "body": body,
                "date": date,
                "url": url
            }))
        })
        .collect();
    if let Ok(mut guard) = all_releases_cache().lock() {
        *guard = Some((Instant::now(), releases.clone()));
    }
    Ok(releases)
}

#[tauri::command]
pub async fn announcement_release_log(tag: String) -> Result<Option<Value>, String> {
    if tag.is_empty()
        || tag.len() > 80
        || !tag
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'+' | b'-'))
        || !tag.trim_start_matches(['v', 'V']).starts_with(|c: char| c.is_ascii_digit())
    {
        return Err("Invalid release tag".to_string());
    }
    let alternate = if let Some(version) = tag.strip_prefix(['v', 'V']) {
        version.to_string()
    } else {
        format!("v{tag}")
    };
    let client = crate::roblox::shared_github_client();
    for candidate in [&tag, &alternate] {
        let response = client
            .get(format!("{RELEASES_API}/{}", crate::encode_query(candidate)))
            .header(reqwest::header::ACCEPT, "application/vnd.github+json")
            .send()
            .await
            .map_err(|error| error.to_string())?;
        if response.status() == reqwest::StatusCode::NOT_FOUND {
            continue;
        }
        let data: Value = response
            .error_for_status()
            .map_err(|error| error.to_string())?
            .json()
            .await
            .map_err(|error| error.to_string())?;
        if data.get("draft").and_then(Value::as_bool) == Some(true) {
            return Ok(None);
        }
        return Ok(Some(serde_json::json!({
            "body": data.get("body").and_then(Value::as_str).unwrap_or_default(),
            "date": data.get("published_at"),
            "url": format!("https://github.com/mozrg/Vortex/releases/tag/{}", crate::encode_query(candidate))
        })));
    }
    Ok(None)
}

fn version_numbers(version: &str) -> Vec<u64> {
    version
        .trim()
        .trim_start_matches(['v', 'V'])
        .split(['-', '+'])
        .next()
        .unwrap_or_default()
        .split('.')
        .map(|part| part.parse().unwrap_or(0))
        .collect()
}

fn version_at_least(current: &str, minimum: &str) -> bool {
    let current = version_numbers(current);
    let minimum = version_numbers(minimum);
    for index in 0..current.len().max(minimum.len()) {
        let ordering = current
            .get(index)
            .copied()
            .unwrap_or(0)
            .cmp(&minimum.get(index).copied().unwrap_or(0));
        if ordering != std::cmp::Ordering::Equal {
            return ordering == std::cmp::Ordering::Greater;
        }
    }
    true
}

fn announcement_items(payload: &Value) -> Vec<Value> {
    let current_version = env!("CARGO_PKG_VERSION");
    payload
        .as_array()
        .or_else(|| payload.get("items").and_then(Value::as_array))
        .into_iter()
        .flatten()
        .filter(|item| {
            item.get("id").and_then(Value::as_str).is_some()
                && item.get("title").and_then(Value::as_str).is_some()
                && item.get("body").and_then(Value::as_str).is_some()
                && item
                    .get("minVersion")
                    .and_then(Value::as_str)
                    .is_none_or(|minimum| version_at_least(current_version, minimum))
        })
        .cloned()
        .collect()
}

fn builtin_items() -> Vec<Value> {
    vec![serde_json::json!({
        "id": "2026-10-21-paid-games",
        "title": "Раздел платных игр",
        "body": "Платные игры теперь загружаются постранично, как и остальные списки.",
        "level": "info",
        "date": "2026-10-21T12:00:00Z"
    })]
}

pub async fn load_announcements(
    state: &crate::state::AppState,
    force: bool,
) -> (Vec<Value>, String) {
    if !force {
        if let Ok(cache) = state.announcement_cache.lock() {
            if let Some(entry) = cache.as_ref() {
                if entry.at.elapsed() < CACHE_TTL {
                    return (entry.items.clone(), entry.source.clone());
                }
            }
        }
    }

    let cache_buster = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default();
    let request = crate::roblox::shared_github_client()
        .get(SOURCE_URL)
        .query(&[("t", cache_buster)]);

    let loaded = match request.send().await {
        Ok(response) if response.status().is_success() => response.json::<Value>().await.ok(),
        _ => None,
    };

    if let Some(payload) = loaded {
        let items = announcement_items(&payload);
        if let Ok(mut cache) = state.announcement_cache.lock() {
            *cache = Some(crate::state::AnnouncementCache {
                items: items.clone(),
                at: Instant::now(),
                source: "network".to_string(),
            });
        }
        return (items, "network".to_string());
    }

    if let Ok(cache) = state.announcement_cache.lock() {
        if let Some(entry) = cache.as_ref() {
            return (entry.items.clone(), "cache".to_string());
        }
    }
    (builtin_items(), "builtin".to_string())
}
