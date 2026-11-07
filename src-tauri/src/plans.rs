use serde_json::{json, Value};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

const SOURCE_URL: &str = "https://raw.githubusercontent.com/mozrg/Vortex/main/site/plans.json";
const CACHE_TTL: Duration = Duration::from_secs(5 * 60);

fn clean_items(payload: &Value) -> Vec<Value> {
    payload
        .as_array()
        .or_else(|| payload.get("items").and_then(Value::as_array))
        .into_iter()
        .flatten()
        .filter(|item| {
            item.get("id").and_then(Value::as_str).is_some()
                && item
                    .get("title")
                    .is_some_and(|title| title.is_string() || title.is_object())
                && item
                    .get("body")
                    .is_some_and(|body| body.is_string() || body.is_object())
        })
        .cloned()
        .collect()
}

pub async fn load_plans(state: &crate::state::AppState, force: bool) -> (Vec<Value>, String) {
    if !force {
        if let Ok(cache) = state.plans_cache.lock() {
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
    let payload = match reqwest::Client::builder()
        .timeout(Duration::from_secs(12))
        .user_agent("Vortex-Launcher")
        .build()
    {
        Ok(client) => match client
            .get(SOURCE_URL)
            .query(&[("t", cache_buster)])
            .send()
            .await
        {
            Ok(response) if response.status().is_success() => response.json::<Value>().await.ok(),
            _ => None,
        },
        Err(_) => None,
    };

    if let Some(payload) = payload {
        let items = clean_items(&payload);
        if let Ok(mut cache) = state.plans_cache.lock() {
            *cache = Some(crate::state::AnnouncementCache {
                items: items.clone(),
                at: Instant::now(),
                source: "network".to_string(),
            });
        }
        return (items, "network".to_string());
    }

    if let Ok(cache) = state.plans_cache.lock() {
        if let Some(entry) = cache.as_ref() {
            return (entry.items.clone(), "cache".to_string());
        }
    }
    let bundled: Value = serde_json::from_str(include_str!("../../site/plans.json"))
        .unwrap_or_else(|_| json!({"items": []}));
    (clean_items(&bundled), "builtin".to_string())
}
