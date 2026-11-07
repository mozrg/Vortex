use serde_json::{json, Value};
use std::collections::HashMap;
use std::time::{Duration, Instant};
use uuid::Uuid;

use crate::cache;
use crate::state::{AppState, CacheEntry};

const CACHE_TTL: Duration = Duration::from_secs(5 * 60);
const FETCH_TIMEOUT: Duration = Duration::from_secs(12);
const THUMB_TIMEOUT: Duration = Duration::from_secs(10);
const PAID_CACHE_TTL: Duration = Duration::from_secs(10 * 60);

/// Shared HTTP client with a User-Agent header.
fn http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent("Vortex-Place-Launcher")
        .timeout(FETCH_TIMEOUT)
        .build()
        .expect("failed to build HTTP client")
}

/// Fetch JSON from a URL, with an optional cookie header.
pub async fn fetch_json(url: &str, cookie: Option<&str>) -> Result<Value, String> {
    let client = http_client();
    let mut req = client.get(url).header("Accept", "application/json");
    if let Some(c) = cookie {
        if !c.is_empty() {
            req = req.header("Cookie", format!(".ROBLOSECURITY={}", c));
        }
    }
    let resp = req
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("Roblox returned {}", resp.status().as_u16()));
    }
    resp.json::<Value>()
        .await
        .map_err(|e| format!("JSON error: {}", e))
}

/// POST JSON body to a URL.
pub async fn fetch_json_post(
    url: &str,
    body: &Value,
    cookie: Option<&str>,
) -> Result<Value, String> {
    let client = http_client();
    let mut req = client
        .post(url)
        .header("Accept", "application/json")
        .header("Content-Type", "application/json")
        .body(body.to_string());
    if let Some(c) = cookie {
        if !c.is_empty() {
            req = req.header("Cookie", format!(".ROBLOSECURITY={}", c));
        }
    }
    let resp = req
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("Roblox returned {}", resp.status().as_u16()));
    }
    resp.json::<Value>()
        .await
        .map_err(|e| format!("JSON error: {}", e))
}

/// Cached GET: check the in-memory cache first, then the network.
pub async fn fetch_cached_json(state: &AppState, url: &str) -> Result<Value, String> {
    {
        let cache = state.response_cache.lock().unwrap();
        if let Some(entry) = cache.get(url) {
            if !entry.is_expired() {
                return Ok(entry.value.clone());
            }
        }
    }
    let value = fetch_json(url, None).await?;
    let mut cache = state.response_cache.lock().unwrap();
    if cache.len() > 400 {
        let now = Instant::now();
        cache.retain(|_, entry| !entry.is_expired());
        if cache.len() > 350 {
            // Drop oldest entries until under cap.
            let keys: Vec<String> = cache.keys().cloned().collect();
            for key in keys.iter().skip(350) {
                cache.remove(key);
            }
        }
        let _ = now;
    }
    cache.insert(
        url.to_string(),
        CacheEntry::fresh_for(value.clone(), CACHE_TTL),
    );
    Ok(value)
}

/// Fetch thumbnails for a batch of universe IDs from the Roblox API, using the
/// on-disk cache for already-seen icons.
pub async fn get_thumbnails(state: &AppState, universe_ids: &[String]) -> HashMap<String, String> {
    let mut out = HashMap::new();
    let mut missing = Vec::new();

    for id in universe_ids {
        if let Some(cached) = cache::read_cached_thumbnail(id).await {
            out.insert(id.clone(), cached);
        } else if id.chars().all(|c| c.is_ascii_digit()) && !id.is_empty() && id.len() <= 20 {
            missing.push(id.clone());
        }
    }
    if missing.is_empty() {
        return out;
    }

    // Batch in groups of 50.
    for batch in missing.chunks(50) {
        let url = format!(
            "https://thumbnails.roblox.com/v1/games/icons?universeIds={}&size=512x512&format=Png&isCircular=false",
            batch.join(",")
        );
        match fetch_cached_json(state, &url).await {
            Ok(payload) => {
                if let Some(data) = payload.get("data").and_then(|d| d.as_array()) {
                    for item in data {
                        let target_id = item.get("targetId").and_then(|t| t.as_u64());
                        let image_url = item.get("imageUrl").and_then(|u| u.as_str()).unwrap_or("");
                        if let Some(tid) = target_id {
                            let clean = cache::clean_thumbnail(image_url);
                            out.insert(tid.to_string(), clean.clone());
                            if !clean.is_empty() {
                                cache::cache_thumbnail(&tid.to_string(), &clean).await;
                            }
                        }
                    }
                }
            }
            Err(_) => {}
        }
    }
    out
}

/// Map a raw Roblox game object into the shape the renderer expects.
pub fn map_game(game: &Value, thumbnail: &str, launch_place_id: Option<&str>) -> Value {
    let id = if let Some(pid) = launch_place_id {
        pid.to_string()
    } else if let Some(rootId) = game.get("rootPlaceId") {
        if let Some(s) = rootId.as_str() {
            s.to_string()
        } else if let Some(n) = rootId.as_u64() {
            n.to_string()
        } else {
            String::new()
        }
    } else {
        String::new()
    };

    let universe_id = game
        .get("id")
        .or_else(|| game.get("universeId"))
        .and_then(|v| {
            v.as_str()
                .map(|s| s.to_string())
                .or_else(|| v.as_u64().map(|n| n.to_string()))
        })
        .unwrap_or_default();

    let name = game
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("Roblox experience");
    let title_unavailable = regex_is_match_title_unavailable(name);
    let price = game.get("price").and_then(|p| p.as_u64()).unwrap_or(0);
    let player_count = game
        .get("playing")
        .and_then(|p| p.as_u64())
        .or_else(|| game.get("playerCount").and_then(|p| p.as_u64()))
        .unwrap_or(0);
    let up_votes = game
        .get("upVotes")
        .and_then(|v| v.as_u64())
        .or_else(|| game.get("totalUpVotes").and_then(|v| v.as_u64()))
        .unwrap_or(0);
    let down_votes = game
        .get("downVotes")
        .and_then(|v| v.as_u64())
        .or_else(|| game.get("totalDownVotes").and_then(|v| v.as_u64()))
        .unwrap_or(0);

    let availability = if title_unavailable
        || game
            .get("isContentRestricted")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
    {
        "unavailable"
    } else {
        "available"
    };

    json!({
        "id": id,
        "universeId": universe_id,
        "title": name.chars().take(100).collect::<String>(),
        "description": game.get("description").and_then(|v| v.as_str()).unwrap_or("").split_whitespace().collect::<Vec<_>>().join(" ").chars().take(240).collect::<String>(),
        "creator": game.get("creator").and_then(|c| c.get("name")).and_then(|n| n.as_str()).or_else(|| game.get("creatorName").and_then(|n| n.as_str())).unwrap_or("").chars().take(70).collect::<String>(),
        "creatorVerified": game.get("creator").and_then(|c| c.get("hasVerifiedBadge")).and_then(|v| v.as_bool()).unwrap_or(false),
        "genre": game.get("genreL1").and_then(|v| v.as_str()).or_else(|| game.get("genre").and_then(|v| v.as_str())).unwrap_or("").chars().take(50).collect::<String>(),
        "playerCount": player_count,
        "upVotes": up_votes,
        "downVotes": down_votes,
        "visits": game.get("visits").and_then(|v| v.as_u64()).or_else(|| game.get("visitCount").and_then(|v| v.as_u64())).unwrap_or(0),
        "favorites": game.get("favoritedCount").and_then(|v| v.as_u64()).or_else(|| game.get("favorites").and_then(|v| v.as_u64())).unwrap_or(0),
        "updated": game.get("updated").cloned().unwrap_or(serde_json::Value::Null),
        "price": price,
        "isPaid": price > 0,
        "availability": availability,
        "thumbnail": cache::clean_thumbnail(thumbnail)
    })
}

fn regex_is_match_title_unavailable(name: &str) -> bool {
    let lower = name.trim().to_lowercase();
    lower == "title unavailable"
        || lower == "[title unavailable]"
        || lower == "[ title unavailable ]"
        || lower == "? title unavailable ?"
}

/// Fetch full game details for a batch of universe IDs. Also feeds the paid-games
/// index when priced games are seen.
pub async fn get_game_details_by_universe(state: &AppState, universe_ids: &[String]) -> Vec<Value> {
    let ids: Vec<String> = universe_ids
        .iter()
        .filter(|id| id.chars().all(|c| c.is_ascii_digit()) && !id.is_empty() && id.len() <= 20)
        .cloned()
        .collect();
    if ids.is_empty() {
        return Vec::new();
    }

    let mut games = Vec::new();
    for batch in ids.chunks(50) {
        let url = format!(
            "https://games.roblox.com/v1/games?universeIds={}",
            batch.join(",")
        );
        match fetch_cached_json(state, &url).await {
            Ok(payload) => {
                if let Some(rows) = payload.get("data").and_then(|d| d.as_array()) {
                    let thumb_ids: Vec<String> = rows
                        .iter()
                        .filter_map(|r| {
                            r.get("id").and_then(|id| {
                                id.as_u64()
                                    .map(|n| n.to_string())
                                    .or_else(|| id.as_str().map(|s| s.to_string()))
                            })
                        })
                        .collect();
                    let thumbnails = get_thumbnails(state, &thumb_ids).await;
                    for row in rows {
                        let row_id = row
                            .get("id")
                            .and_then(|id| {
                                id.as_u64()
                                    .map(|n| n.to_string())
                                    .or_else(|| id.as_str().map(|s| s.to_string()))
                            })
                            .unwrap_or_default();
                        let thumb = thumbnails.get(&row_id).cloned().unwrap_or_default();
                        games.push(map_game(row, &thumb, None));
                    }
                }
            }
            Err(_) => {}
        }
    }

    // Opportunistic paid-games indexing.
    record_paid_games(state, &games).await;
    games
}

/// Resolve a Roblox username to a user ID via the public users API.
pub async fn resolve_user_id(username: &str) -> Option<Value> {
    let clean = username.trim();
    if clean.len() < 3
        || clean.len() > 20
        || !clean.chars().all(|c| c.is_alphanumeric() || c == '_')
    {
        return None;
    }
    let body = json!({
        "usernames": [clean],
        "excludeBannedUsers": true
    });
    match fetch_json_post("https://users.roblox.com/v1/usernames/users", &body, None).await {
        Ok(payload) => payload
            .get("data")
            .and_then(|d| d.as_array())
            .and_then(|arr| arr.first())
            .cloned(),
        Err(_) => None,
    }
}

// ---- Paid-games index ----
const PAID_QUERY_POOL: &[&str] = &[
    "paid access",
    "early access",
    "alpha access",
    "beta access",
    "paid",
    "paid entry",
    "supporter",
    "entry fee",
    "paid experience",
    "premium access",
    "vip access",
    "paid game",
];
const PAID_QUERIES_PER_SCAN: usize = 4;
const PAID_MAX_PAGES_PER_QUERY: usize = 4;

pub async fn collect_paid_universe_ids(state: &AppState) -> (Vec<String>, i32, bool) {
    let cursor = *state.paid_cursor.lock().unwrap();
    let total = PAID_QUERY_POOL.len() as i32;
    let queries: Vec<&str> = (0..PAID_QUERIES_PER_SCAN as i32)
        .map(|step| PAID_QUERY_POOL[((cursor + step) as usize) % total as usize])
        .collect();
    let next_cursor = (cursor + PAID_QUERIES_PER_SCAN as i32) % total;
    let progress = if (cursor + PAID_QUERIES_PER_SCAN as i32) >= total {
        0
    } else {
        cursor + PAID_QUERIES_PER_SCAN as i32
    };

    let mut universe_ids: Vec<String> = Vec::new();
    let mut seen = std::collections::HashSet::new();

    for query in &queries {
        let mut token: Option<String> = None;
        for _page in 0..PAID_MAX_PAGES_PER_QUERY {
            let session_id = Uuid::new_v4().to_string();
            let mut url = format!(
                "https://apis.roblox.com/search-api/omni-search?searchQuery={}&sessionId={}&pageType=all",
                query, session_id
            );
            if let Some(t) = &token {
                url.push_str(&format!("&pageToken={}", t));
            }
            let payload = match fetch_cached_json(state, &url).await {
                Ok(p) => p,
                Err(_) => return (Vec::new(), next_cursor, progress >= total),
            };
            if let Some(results) = payload.get("searchResults").and_then(|r| r.as_array()) {
                for group in results {
                    let group_type = group
                        .get("contentGroupType")
                        .and_then(|t| t.as_str())
                        .unwrap_or("");
                    if group_type.to_lowercase() != "game" {
                        continue;
                    }
                    if let Some(contents) = group.get("contents").and_then(|c| c.as_array()) {
                        for row in contents {
                            if let Some(uid) = row.get("universeId").and_then(|u| {
                                u.as_u64()
                                    .map(|n| n.to_string())
                                    .or_else(|| u.as_str().map(|s| s.to_string()))
                            }) {
                                if uid.chars().all(|c| c.is_ascii_digit())
                                    && !uid.is_empty()
                                    && uid.len() <= 20
                                {
                                    if seen.insert(uid.clone()) {
                                        universe_ids.push(uid);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            token = payload
                .get("nextPageToken")
                .and_then(|t| t.as_str())
                .map(|s| s.to_string());
            if token.is_none() {
                break;
            }
        }
    }

    let wrapped = progress >= total;
    *state.paid_cursor.lock().unwrap() = next_cursor;
    let cursor_path = AppState::user_data_dir().join("paid-cursor.json");
    let _ = std::fs::write(
        &cursor_path,
        json!({"cursor": next_cursor, "progress": progress, "updatedAt": cache::timestamp_ms()})
            .to_string(),
    );

    (universe_ids, next_cursor, wrapped)
}

pub async fn read_paid_index() -> Vec<Value> {
    let path = AppState::user_data_dir().join("paid-games.json");
    match std::fs::read_to_string(&path) {
        Ok(content) => {
            let parsed: Value = serde_json::from_str(&content).unwrap_or(json!({}));
            parsed
                .get("games")
                .and_then(|g| g.as_array())
                .cloned()
                .unwrap_or_default()
        }
        Err(_) => Vec::new(),
    }
}

async fn write_paid_index(games: &[Value]) {
    let path = AppState::user_data_dir().join("paid-games.json");
    let data = json!({"updatedAt": cache::timestamp_ms(), "games": games.iter().take(1000).cloned().collect::<Vec<_>>()});
    let _ = std::fs::write(&path, data.to_string());
}

/// Merge any priced games from the given list into the on-disk paid index.
pub async fn record_paid_games(state: &AppState, games: &[Value]) {
    let priced: Vec<Value> = games
        .iter()
        .filter(|g| {
            g.get("price").and_then(|p| p.as_u64()).unwrap_or(0) > 0
                && g.get("availability").and_then(|a| a.as_str()) != Some("unavailable")
        })
        .cloned()
        .collect();
    if priced.is_empty() {
        return;
    }
    let stored = read_paid_index().await;
    let mut merged: HashMap<String, Value> = HashMap::new();
    for g in &stored {
        if let Some(id) = g.get("id").and_then(|i| i.as_str()) {
            merged.insert(id.to_string(), g.clone());
        }
    }
    for g in &priced {
        if let Some(id) = g.get("id").and_then(|i| i.as_str()) {
            merged.insert(id.to_string(), g.clone());
        }
    }
    let mut all: Vec<Value> = merged.values().cloned().collect();
    all.sort_by_key(|g| g.get("price").and_then(|p| p.as_u64()).unwrap_or(0));
    write_paid_index(&all).await;
}
