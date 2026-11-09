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

/// Fetch a user's friends list from the public friends API.
pub async fn fetch_roblox_friends(
    state: &AppState,
    user_id: &str,
    cookie: &str,
) -> Result<Vec<Value>, String> {
    let url = format!("https://friends.roblox.com/v1/users/{}/friends", user_id);
    let payload = if cookie.is_empty() {
        roblox::fetch_cached_json(state, &url).await?
    } else {
        // An authenticated friends response may be private to the account and
        // must not be shared through the public response cache.
        roblox::fetch_json(&url, Some(cookie)).await?
    };
    if let Some(data) = payload.get("data").and_then(|d| d.as_array()) {
        Ok(data
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
            .collect())
    } else {
        Err("Roblox returned an unexpected friends response".to_string())
    }
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
    if user_ids.is_empty() {
        return Vec::new();
    }
    let body = json!({"userIds": user_ids.iter().take(100).collect::<Vec<_>>()});
    match roblox::fetch_json_post(
        "https://presence.roblox.com/v1/presence/users",
        &body,
        if cookie.is_empty() {
            None
        } else {
            Some(cookie)
        },
    )
    .await
    {
        Ok(payload) => payload
            .get("userPresences")
            .and_then(|p| p.as_array())
            .map(|arr| arr.iter().cloned().collect::<Vec<_>>())
            .unwrap_or_default(),
        Err(_) => Vec::new(),
    }
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
    let avatar = fetch_avatar_for_user(state, &id).await;
    Some(json!({
        "id": id,
        "name": name,
        "displayName": display_name,
        "avatar": avatar,
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
