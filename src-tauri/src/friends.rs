use serde_json::{json, Value};
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::windows::named_pipe::ClientOptions;
use uuid::Uuid;

use crate::roblox;
use crate::state::AppState;

const FETCH_TIMEOUT: Duration = Duration::from_secs(10);

/// Resolve a Roblox username to a { id, name, displayName } object.
pub async fn resolve_roblox_user_id(username: &str) -> Result<Option<Value>, String> {
    let clean = username.trim();
    if clean.len() < 3
        || clean.len() > 20
        || !clean.chars().all(|c| c.is_alphanumeric() || c == '_')
    {
        return Ok(None);
    }
    let body = json!({"usernames": [clean], "excludeBannedUsers": true});
    let payload =
        roblox::fetch_json_post("https://users.roblox.com/v1/usernames/users", &body, None).await?;
    Ok(payload
        .get("data")
        .and_then(|d| d.as_array())
        .and_then(|arr| arr.first())
        .map(|hit| {
            json!({
                "id": hit.get("id").map(|i| i.to_string()).unwrap_or_default(),
                "name": hit.get("name").and_then(|n| n.as_str()).unwrap_or(""),
                "displayName": hit.get("displayName").and_then(|d| d.as_str())
                    .or_else(|| hit.get("name").and_then(|n| n.as_str()))
                    .unwrap_or("")
            })
        }))
}

/// Fetch a user's friends list via Roblox's modern paginated `friends/find`
/// endpoint (supports up to 1,000 friends) with fallback to legacy `/friends`.
pub async fn fetch_roblox_friends(
    state: &AppState,
    user_id: &str,
    cookie: &str,
) -> Result<Vec<Value>, String> {
    let clean_cookie = roblox::normalize_cookie_value(cookie);
    let legacy_url = format!("https://friends.roblox.com/v1/users/{}/friends", user_id);

    // 1. Try the standard `/friends` endpoint first.
    let legacy_res = if clean_cookie.is_empty() {
        roblox::fetch_cached_json(state, &legacy_url).await
    } else {
        roblox::fetch_json(&legacy_url, Some(clean_cookie)).await
    };
    if let Ok(payload) = legacy_res {
        if let Some(data) = payload.get("data").and_then(|d| d.as_array()) {
            return Ok(data
                .iter()
                .take(500)
                .map(|friend| {
                    json!({
                        "id": friend.get("id").map(|i| i.to_string()).unwrap_or_default(),
                        "name": friend.get("name").and_then(|n| n.as_str()).unwrap_or(""),
                        "displayName": friend.get("displayName").and_then(|d| d.as_str())
                            .or_else(|| friend.get("name").and_then(|n| n.as_str()))
                            .unwrap_or(""),
                        "isOnline": friend.get("isOnline").and_then(|o| o.as_bool()).unwrap_or(false)
                    })
                })
                .collect());
        }
    } else if let Err(legacy_err) = legacy_res {
        // 2. Fall back to the paginated `/friends/find` endpoint (which Roblox
        // migrated to for accounts with larger friend lists and stricter gateway rules).
        if let Ok(found) = fetch_roblox_friends_find(user_id, clean_cookie).await {
            return Ok(found);
        }
        return Err(legacy_err);
    }

    fetch_roblox_friends_find(user_id, clean_cookie).await
}

async fn fetch_roblox_friends_find(user_id: &str, cookie: &str) -> Result<Vec<Value>, String> {
    let mut all = Vec::new();
    let mut cursor: Option<String> = None;
    let mut seen_ids = std::collections::HashSet::new();

    for _page in 0..10 {
        let mut url = format!(
            "https://friends.roblox.com/v1/users/{}/friends/find?limit=50",
            user_id
        );
        if let Some(ref c) = cursor {
            if !c.is_empty() {
                url.push_str("&cursor=");
                url.push_str(c);
            }
        }
        let payload = roblox::fetch_json(&url, (!cookie.is_empty()).then_some(cookie)).await?;
        let items = payload
            .get("PageItems")
            .or_else(|| payload.get("pageItems"))
            .and_then(Value::as_array)
            .ok_or_else(|| "Roblox returned an unexpected friends/find response".to_string())?;
        for item in items {
            let id = item
                .get("id")
                .map(|v| v.to_string().trim_matches('"').to_string())
                .unwrap_or_default();
            if id.is_empty() || !seen_ids.insert(id.clone()) {
                continue;
            }
            all.push(json!({
                "id": id,
                "name": item.get("name").and_then(Value::as_str).unwrap_or(""),
                "displayName": item.get("displayName").and_then(Value::as_str).unwrap_or(""),
                "isOnline": false
            }));
            if all.len() >= 500 {
                return Ok(all);
            }
        }
        let next = payload
            .get("NextCursor")
            .or_else(|| payload.get("nextCursor"))
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_string);
        if next.is_none() {
            break;
        }
        cursor = next;
    }
    Ok(all)
}

/// Check whether a stored `.ROBLOSECURITY` cookie is still accepted by Roblox.
pub async fn is_cookie_valid(cookie: &str) -> bool {
    let clean = roblox::normalize_cookie_value(cookie);
    if clean.is_empty() {
        return false;
    }
    roblox::fetch_json(
        "https://users.roblox.com/v1/users/authenticated",
        Some(clean),
    )
    .await
    .is_ok_and(|payload| payload.get("id").is_some())
}

/// Fetch display names for users that arrive with empty names (privacy mode).
pub async fn fetch_roblox_user_names(
    user_ids: &[String],
) -> std::collections::HashMap<String, Value> {
    let mut result = std::collections::HashMap::new();
    for batch in user_ids.chunks(100) {
        let body = json!({"userIds": batch, "excludeBannedUsers": false});
        match roblox::fetch_json_post("https://users.roblox.com/v1/users", &body, None).await {
            Ok(payload) => {
                if let Some(data) = payload.get("data").and_then(|d| d.as_array()) {
                    for user in data {
                        let id = user.get("id").map(|i| i.to_string()).unwrap_or_default();
                        result.insert(
                            id,
                            json!({
                                "name": user.get("name").and_then(|n| n.as_str()).unwrap_or(""),
                                "displayName": user.get("displayName").and_then(|d| d.as_str())
                                    .or_else(|| user.get("name").and_then(|n| n.as_str()))
                                    .unwrap_or("")
                            }),
                        );
                    }
                }
            }
            Err(_) => {}
        }
    }
    result
}

/// Fetch live presence (what game a user is playing). Requires the cookie for
/// accurate results — Roblox hides statuses from anonymous callers.
pub async fn fetch_roblox_presence(user_ids: &[String], cookie: &str) -> Vec<Value> {
    let mut presence = Vec::new();
    for batch in user_ids.chunks(100) {
        let body = json!({"userIds": batch});
        if let Ok(payload) = roblox::fetch_json_post(
            "https://presence.roblox.com/v1/presence/users",
            &body,
            (!cookie.is_empty()).then_some(cookie),
        )
        .await
        {
            if let Some(rows) = payload.get("userPresences").and_then(Value::as_array) {
                presence.extend(rows.iter().cloned());
            }
        }
    }
    presence
}

/// Fetch avatar headshot thumbnails for a batch of user IDs.
pub async fn fetch_roblox_user_thumbnails(
    state: &AppState,
    user_ids: &[String],
) -> std::collections::HashMap<String, String> {
    let mut result = std::collections::HashMap::new();
    for batch in user_ids.chunks(100) {
        let url = format!(
            "https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds={}&size=150x150&format=Png&isCircular=false",
            batch.join(",")
        );
        match roblox::fetch_cached_json(state, &url).await {
            Ok(payload) => {
                if let Some(data) = payload.get("data").and_then(|d| d.as_array()) {
                    for item in data {
                        let target_id = item.get("targetId");
                        let target = if let Some(tid) = target_id {
                            tid.to_string()
                        } else {
                            String::new()
                        };
                        let url = item.get("imageUrl").and_then(|u| u.as_str()).unwrap_or("");
                        let clean = crate::cache::clean_thumbnail(url);
                        result.insert(target, clean);
                    }
                }
            }
            Err(_) => {}
        }
    }
    result
}

/// Fetch the avatar headshot for a single user id.
pub async fn fetch_avatar_for_user(state: &AppState, user_id: &str) -> String {
    if user_id.is_empty() || user_id.len() > 20 || !user_id.chars().all(|c| c.is_ascii_digit()) {
        return String::new();
    }
    let url = format!(
        "https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds={}&size=150x150&format=Png&isCircular=false",
        user_id
    );
    match roblox::fetch_cached_json(state, &url).await {
        Ok(payload) => payload
            .get("data")
            .and_then(Value::as_array)
            .and_then(|items| items.first())
            .and_then(|item| item.get("imageUrl"))
            .and_then(Value::as_str)
            .map(crate::cache::clean_thumbnail)
            .unwrap_or_default(),
        Err(_) => String::new(),
    }
}

/// Identify the account the stored cookie belongs to. This is the reliable
/// source for the topbar avatar once the user pastes `.ROBLOSECURITY`.
pub async fn detect_authenticated_account(state: &AppState, cookie: &str) -> Option<Value> {
    if cookie.is_empty() {
        return None;
    }
    let payload = roblox::fetch_json(
        "https://users.roblox.com/v1/users/authenticated",
        Some(cookie),
    )
    .await
    .ok()?;
    let id = payload
        .get("id")
        .map(|value| value.to_string())
        .unwrap_or_default();
    if id.is_empty() || id.len() > 20 || !id.chars().all(|c| c.is_ascii_digit()) {
        return None;
    }
    let name = payload
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let display_name = payload
        .get("displayName")
        .and_then(Value::as_str)
        .unwrap_or(&name)
        .to_string();
    let currency_url = format!("https://economy.roblox.com/v1/users/{id}/currency");
    let (avatar, currency_res) = tokio::join!(
        fetch_avatar_for_user(state, &id),
        roblox::fetch_json(&currency_url, Some(cookie))
    );
    let robux = currency_res
        .ok()
        .and_then(|v| v.get("robux").and_then(Value::as_u64));
    Some(json!({
        "id": id,
        "name": name,
        "displayName": display_name,
        "avatar": avatar,
        "robux": robux,
        "source": "cookie"
    }))
}

/// Detect the local Roblox account by scanning %LOCALAPPDATA%\Roblox for numeric
/// folder names, then resolving the most recently active one via the public API.
pub async fn detect_local_roblox_account(state: &AppState) -> Option<Value> {
    let local_app_data = std::env::var("LOCALAPPDATA").ok()?;
    let roblox_folder = std::path::PathBuf::from(local_app_data).join("Roblox");

    let mut candidates: Vec<(String, u64)> = Vec::new();
    let entries = std::fs::read_dir(&roblox_folder).ok()?;
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            continue;
        }
        if !name.chars().all(|c| c.is_ascii_digit()) || name == "0" || name.len() < 3 {
            continue;
        }
        // Find the newest file mtime inside this account folder.
        let mut newest = 0u64;
        let account_path = roblox_folder.join(&name);
        if let Ok(file_iter) = std::fs::read_dir(&account_path) {
            for f in file_iter.flatten() {
                if let Ok(meta) = f.metadata() {
                    if let Ok(modified) = meta.modified() {
                        if let Ok(ms) = modified.duration_since(std::time::UNIX_EPOCH) {
                            let ms_val = ms.as_millis() as u64;
                            if ms_val > newest {
                                newest = ms_val;
                            }
                        }
                    }
                }
            }
        }
        if newest == 0 {
            if let Ok(meta) = entry.metadata() {
                if let Ok(modified) = meta.modified() {
                    newest = modified
                        .duration_since(std::time::UNIX_EPOCH)
                        .map(|d| d.as_millis() as u64)
                        .unwrap_or(0);
                }
            }
        }
        candidates.push((name, newest));
    }

    if candidates.is_empty() {
        return None;
    }
    candidates.sort_by(|a, b| b.1.cmp(&a.1));

    // Try the 3 freshest candidates via the public users API.
    for (user_id, last_active) in candidates.iter().take(3) {
        let url = format!("https://users.roblox.com/v1/users/{}", user_id);
        if let Ok(payload) = roblox::fetch_cached_json(state, &url).await {
            if let (Some(id), Some(name)) = (
                payload.get("id"),
                payload.get("name").and_then(|n| n.as_str()),
            ) {
                return Some(json!({
                    "id": id.to_string(),
                    "name": name,
                    "displayName": payload.get("displayName").and_then(|d| d.as_str()).unwrap_or(name),
                    "avatar": fetch_avatar_for_user(state, &id.to_string()).await,
                    "lastActive": last_active,
                    "source": "local"
                }));
            }
        }
    }
    None
}
