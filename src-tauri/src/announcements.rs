use serde_json::Value;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

const SOURCE_URL: &str =
    "https://raw.githubusercontent.com/mozrg/Vortex/main/site/notifications.json";
const CACHE_TTL: Duration = Duration::from_secs(5 * 60);

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
    let result = reqwest::Client::builder()
        .timeout(Duration::from_secs(12))
        .user_agent("Vortex-Launcher")
        .build()
        .map_err(|error| error.to_string())
        .and_then(|client| {
            // The query parameter avoids a stale copy at GitHub's static edge
            // immediately after the admin page commits a new file.
            Ok(client.get(SOURCE_URL).query(&[("t", cache_buster)]))
        });

    let loaded = match result {
        Ok(request) => match request.send().await {
            Ok(response) if response.status().is_success() => response.json::<Value>().await.ok(),
            _ => None,
        },
        Err(_) => None,
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
