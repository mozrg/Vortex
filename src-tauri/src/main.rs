#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod announcements;
mod autostart;
mod cache;
mod cookie;
mod game_servers;
mod share_files;
mod shortcut_icon;
mod discord;
mod friends;
mod legacy_storage;
mod overlay;
mod overlay_audio;
mod overlay_fps;
mod overlay_ping;
mod plans;
mod roblox;
mod runtime;
mod state;
mod tray;
mod updates;

use serde_json::{json, Value};
use state::AppState;
use std::path::Path;
use std::sync::Arc;
use std::time::Instant;
use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewUrl,
    WebviewWindowBuilder, WindowEvent,
};
use uuid::Uuid;

fn value_string(value: Option<&Value>) -> String {
    value
        .and_then(|v| {
            v.as_str()
                .map(str::to_owned)
                .or_else(|| v.as_u64().map(|n| n.to_string()))
        })
        .unwrap_or_default()
}

fn valid_numeric_id(value: &str) -> bool {
    !value.is_empty() && value.len() <= 20 && value.chars().all(|c| c.is_ascii_digit())
}

fn valid_quick_code(value: &str, max_len: usize) -> bool {
    !value.is_empty()
        && value.len() <= max_len
        && value
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

fn encode_query(value: &str) -> String {
    url::form_urlencoded::byte_serialize(value.as_bytes()).collect()
}

/// Open a validated URL using its registered system handler.
fn open_url(url: &str) -> Result<(), String> {
    let parsed = url::Url::parse(url).map_err(|_| "invalid URL".to_string())?;
    let scheme = parsed.scheme().to_ascii_lowercase();
    if !matches!(scheme.as_str(), "http" | "https" | "roblox") {
        return Err("unsupported URL scheme".to_string());
    }
    tauri_plugin_opener::open_url(url, None::<&str>)
        .map_err(|e| format!("failed to open URL: {}", e))
}

fn game_row_to_raw(row: &Value) -> Option<Value> {
    let universe_id = row.get("universeId").or_else(|| row.get("id"));
    let place_id = row.get("placeId").or_else(|| row.get("rootPlaceId"));
    if universe_id.is_none() && place_id.is_none() {
        return None;
    }
    let mut game = row.clone();
    if let Some(obj) = game.as_object_mut() {
        if !obj.contains_key("id") {
            if let Some(id) = universe_id {
                obj.insert("id".to_string(), id.clone());
            }
        }
        if let Some(pid) = place_id {
            obj.insert("rootPlaceId".to_string(), pid.clone());
        }
        if !obj.contains_key("name") {
            if let Some(title) = row.get("title") {
                obj.insert("name".to_string(), title.clone());
            }
        }
    }
    Some(game)
}

fn map_content_rows(payload: &Value) -> Vec<Value> {
    let mut rows = Vec::new();
    fn visit(value: &Value, rows: &mut Vec<Value>) {
        if let Some(row) = game_row_to_raw(value) {
            rows.push(row);
            return;
        }
        match value {
            Value::Array(items) => items.iter().for_each(|v| visit(v, rows)),
            Value::Object(map) => map.values().for_each(|v| visit(v, rows)),
            _ => {}
        }
    }
    if let Some(groups) = payload.get("searchResults").and_then(Value::as_array) {
        for group in groups {
            if group
                .get("contentGroupType")
                .and_then(Value::as_str)
                .map(|s| s.eq_ignore_ascii_case("game"))
                .unwrap_or(true)
            {
                if let Some(contents) = group.get("contents") {
                    visit(contents, &mut rows);
                }
            }
        }
    }
    if rows.is_empty() {
        if let Some(items) = payload
            .get("content")
            .or_else(|| payload.get("games"))
            .or_else(|| payload.get("data"))
        {
            visit(items, &mut rows);
        }
    }
    let mut seen = std::collections::HashSet::new();
    rows.into_iter()
        .filter(|row| {
            let key = value_string(
                row.get("universeId")
                    .or_else(|| row.get("id"))
                    .or_else(|| row.get("rootPlaceId")),
            );
            !key.is_empty() && seen.insert(key)
        })
        .collect()
}

fn map_game_rows(rows: &[Value]) -> Vec<Value> {
    rows.iter()
        .map(|row| {
            let thumb = row
                .get("thumbnail")
                .or_else(|| row.get("imageUrl"))
                .and_then(Value::as_str)
                .unwrap_or("");
            roblox::map_game(
                row,
                thumb,
                row.get("placeId").map(|v| value_string(Some(v))).as_deref(),
            )
        })
        .collect()
}

#[tauri::command]
async fn window_minimize(handle: AppHandle) {
    if let Some(window) = handle.get_webview_window("main") {
        let _ = window.minimize();
    }
}

#[tauri::command]
async fn window_toggle_maximize(handle: AppHandle) -> bool {
    if let Some(window) = handle.get_webview_window("main") {
        if window.is_maximized().unwrap_or(false) {
            let _ = window.unmaximize();
        } else {
            let _ = window.maximize();
        }
        window.is_maximized().unwrap_or(false)
    } else {
        false
    }
}

#[tauri::command]
async fn window_close(handle: AppHandle) {
    if let Some(window) = handle.get_webview_window("main") {
        save_window_state(&window);
        let _ = window.hide();
    }
}

// Window geometry is remembered across hides/restarts: the app closes to the
// tray instead of exiting, so the last visible size/position is the natural
// restore point.
fn window_state_path() -> std::path::PathBuf {
    AppState::user_data_dir().join("window-state.json")
}

fn persist_window_geometry(
    position: Option<PhysicalPosition<i32>>,
    size: Option<PhysicalSize<u32>>,
    maximized: bool,
) {
    let mut payload = serde_json::Map::new();
    if let Some(position) = position {
        payload.insert("x".into(), json!(position.x));
        payload.insert("y".into(), json!(position.y));
    }
    if let Some(size) = size {
        payload.insert("width".into(), json!(size.width));
        payload.insert("height".into(), json!(size.height));
    }
    payload.insert("maximized".into(), json!(maximized));
    let path = window_state_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let _ = std::fs::write(path, Value::Object(payload).to_string());
}

fn save_window_state<R: tauri::Runtime>(window: &tauri::WebviewWindow<R>) {
    // Windows reports -32000/-32000 for a minimized window. Persisting that
    // position made the next launch restore itself completely off-screen.
    let minimized = window.is_minimized().unwrap_or(false);
    let position = if minimized {
        None
    } else {
        window
            .outer_position()
            .ok()
            .filter(|position| position.x > -30000 && position.y > -30000)
    };
    persist_window_geometry(
        position,
        window.inner_size().ok(),
        window.is_maximized().unwrap_or(false),
    );
}

fn window_has_visible_position<R: tauri::Runtime>(window: &tauri::WebviewWindow<R>) -> bool {
    let Ok(position) = window.outer_position() else {
        return false;
    };
    if position.x <= -30000 || position.y <= -30000 {
        return false;
    }
    let size = window.outer_size().unwrap_or(PhysicalSize::new(800, 600));
    window
        .monitor_from_point(
            position.x as f64 + size.width as f64 / 2.0,
            position.y as f64 + size.height as f64 / 2.0,
        )
        .ok()
        .flatten()
        .is_some()
}

fn center_window<R: tauri::Runtime>(window: &tauri::WebviewWindow<R>) {
    let Ok(Some(monitor)) = window.current_monitor() else {
        return;
    };
    let monitor_position = monitor.position();
    let monitor_size = monitor.size();
    let window_size = window.outer_size().unwrap_or(PhysicalSize::new(1200, 800));
    let x =
        monitor_position.x + ((monitor_size.width as i32 - window_size.width as i32) / 2).max(0);
    let y =
        monitor_position.y + ((monitor_size.height as i32 - window_size.height as i32) / 2).max(0);
    let _ = window.set_position(PhysicalPosition::new(x, y));
}

fn ensure_window_on_screen<R: tauri::Runtime>(window: &tauri::WebviewWindow<R>) {
    if !window_has_visible_position(window) {
        center_window(window);
    }
}

fn restore_window_geometry<R: tauri::Runtime>(window: &tauri::WebviewWindow<R>) {
    let Ok(raw) = std::fs::read_to_string(window_state_path()) else {
        return;
    };
    let Ok(state) = serde_json::from_str::<Value>(&raw) else {
        return;
    };
    if let (Some(width), Some(height)) = (
        state.get("width").and_then(Value::as_u64),
        state.get("height").and_then(Value::as_u64),
    ) {
        if width >= 640 && height >= 480 {
            let _ = window.set_size(PhysicalSize::new(width as u32, height as u32));
        }
    }
    let mut positioned = false;
    if let (Some(x), Some(y)) = (
        state.get("x").and_then(Value::as_i64),
        state.get("y").and_then(Value::as_i64),
    ) {
        if x > -30000 && y > -30000 {
            let _ = window.set_position(PhysicalPosition::new(x as i32, y as i32));
            positioned = window_has_visible_position(window);
        }
    }
    if !positioned {
        center_window(window);
    }
    if state
        .get("maximized")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        let _ = window.maximize();
    }
}

#[tauri::command]
async fn get_window_state(handle: AppHandle) -> serde_json::Value {
    if let Some(window) = handle.get_webview_window("main") {
        let is_maximized = window.is_maximized().unwrap_or(false);
        json!({"isMaximized": is_maximized})
    } else {
        json!({"isMaximized": false})
    }
}

#[tauri::command]
async fn shell_open_external(url: String) -> bool {
    open_url(&url).is_ok()
}

#[tauri::command]
async fn games_search(
    state: tauri::State<'_, Arc<AppState>>,
    query: String,
    session_id: Option<String>,
    page_token: Option<String>,
) -> Result<serde_json::Value, String> {
    let query = query.trim();
    if query.len() < 1 || query.len() > 100 {
        return Ok(json!({"items": [], "nextPageToken": null, "sessionId": session_id}));
    }
    let session = session_id
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    let mut url = format!(
        "https://apis.roblox.com/search-api/omni-search?searchQuery={}&sessionId={}&pageType=all",
        encode_query(query),
        encode_query(&session)
    );
    if let Some(token) = page_token.filter(|s| !s.is_empty()) {
        url.push_str("&pageToken=");
        url.push_str(&encode_query(&token));
    }
    let payload = roblox::fetch_cached_json(&*state, &url).await?;
    let rows = map_content_rows(&payload);
    let ids: Vec<String> = rows
        .iter()
        .filter_map(|row| {
            let id = value_string(row.get("universeId").or_else(|| row.get("id")));
            valid_numeric_id(&id).then_some(id)
        })
        .collect();
    let mut items = roblox::get_game_details_by_universe(&*state, &ids).await;
    // Keep the search endpoint useful if the details endpoint is temporarily unavailable.
    if items.is_empty() {
        items = map_game_rows(&rows);
    }
    Ok(
        json!({"items": items, "nextPageToken": payload.get("nextPageToken").cloned().unwrap_or(Value::Null), "sessionId": session}),
    )
}

async fn detail_media(state: &AppState, universe_id: &str) -> Vec<Value> {
    let media_url = format!(
        "https://games.roblox.com/v2/games/{}/media?maxItems=30",
        universe_id
    );
    let Ok(payload) = roblox::fetch_cached_json(state, &media_url).await else {
        return Vec::new();
    };
    let entries = payload
        .get("data")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let image_ids: Vec<String> = entries
        .iter()
        .filter(|item| {
            item.get("assetType")
                .and_then(Value::as_str)
                .map(|kind| kind.eq_ignore_ascii_case("image"))
                .unwrap_or(false)
                && item
                    .get("approved")
                    .and_then(Value::as_bool)
                    .unwrap_or(false)
        })
        .filter_map(|item| {
            let id = value_string(item.get("imageId"));
            valid_numeric_id(&id).then_some(id)
        })
        .take(12)
        .collect();
    let mut image_urls = std::collections::HashMap::new();
    for batch in image_ids.chunks(50) {
        let url = format!(
            "https://thumbnails.roblox.com/v1/assets?assetIds={}&size=768x432&format=Png",
            batch.join(",")
        );
        if let Ok(payload) = roblox::fetch_cached_json(state, &url).await {
            if let Some(rows) = payload.get("data").and_then(Value::as_array) {
                for row in rows {
                    let id = value_string(row.get("targetId"));
                    let image = row
                        .get("imageUrl")
                        .and_then(Value::as_str)
                        .map(cache::clean_thumbnail)
                        .unwrap_or_default();
                    if !id.is_empty() && !image.is_empty() {
                        image_urls.insert(id, image);
                    }
                }
            }
        }
    }

    entries.iter()
        .filter(|item| item.get("approved").and_then(Value::as_bool) == Some(true))
        .filter_map(|item| {
            let kind = item.get("assetType")?.as_str()?;
            let caption = item.get("altText").and_then(Value::as_str).unwrap_or("");
            if kind.eq_ignore_ascii_case("image") {
                let id = value_string(item.get("imageId"));
                return Some(json!({"type": "image", "url": image_urls.get(&id)?, "altText": caption}));
            }
            if kind.to_ascii_lowercase().contains("video") {
                let hash = item.get("videoHash").and_then(Value::as_str).unwrap_or("");
                let title = item.get("videoTitle").and_then(Value::as_str).unwrap_or("");
                let youtube = (hash.len() == 11 && valid_quick_code(hash, 11))
                    .then(|| format!("https://www.youtube.com/watch?v={hash}"));
                let id = value_string(item.get("videoId"));
                if youtube.is_some() || valid_numeric_id(&id) {
                    return Some(json!({"type": "video", "title": title, "externalUrl": youtube}));
                }
            }
            None
        })
        .take(12)
        .collect()
}

async fn detail_badges(state: &AppState, universe_id: &str) -> Vec<Value> {
    let url = format!(
        "https://badges.roblox.com/v1/universes/{}/badges?limit=100&sortOrder=Asc",
        universe_id
    );
    let Ok(payload) = roblox::fetch_cached_json(state, &url).await else {
        return Vec::new();
    };
    let rows = payload
        .get("data")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let badge_ids: Vec<String> = rows
        .iter()
        .filter(|badge| {
            badge
                .get("enabled")
                .and_then(Value::as_bool)
                .unwrap_or(true)
        })
        .filter_map(|badge| {
            let id = value_string(badge.get("id"));
            valid_numeric_id(&id).then_some(id)
        })
        .take(100)
        .collect();
    let mut icons = std::collections::HashMap::new();
    for batch in badge_ids.chunks(100) {
        let icon_url = format!(
            "https://thumbnails.roblox.com/v1/badges/icons?badgeIds={}&size=150x150&format=Png&isCircular=false",
            batch.join(",")
        );
        if let Ok(payload) = roblox::fetch_cached_json(state, &icon_url).await {
            if let Some(items) = payload.get("data").and_then(Value::as_array) {
                for item in items {
                    let id = value_string(item.get("targetId"));
                    let image = item
                        .get("imageUrl")
                        .and_then(Value::as_str)
                        .map(cache::clean_thumbnail)
                        .unwrap_or_default();
                    if !id.is_empty() && !image.is_empty() {
                        icons.insert(id, image);
                    }
                }
            }
        }
    }
    rows.iter()
        .filter(|badge| {
            badge
                .get("enabled")
                .and_then(Value::as_bool)
                .unwrap_or(true)
        })
        .take(100)
        .map(|badge| {
            let id = value_string(badge.get("id"));
            json!({
                "id": id,
                "name": badge.get("displayName").and_then(Value::as_str)
                    .or_else(|| badge.get("name").and_then(Value::as_str)).unwrap_or("Badge"),
                "description": badge.get("displayDescription").and_then(Value::as_str)
                    .or_else(|| badge.get("description").and_then(Value::as_str)).unwrap_or(""),
                "icon": icons.get(&id).cloned().unwrap_or_default()
            })
        })
        .collect()
}

#[tauri::command]
async fn games_details(
    state: tauri::State<'_, Arc<AppState>>,
    universe_id: Option<String>,
    place_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let mut universe = universe_id.unwrap_or_default();
    let place = place_id.unwrap_or_default();
    if !valid_numeric_id(&universe) && valid_numeric_id(&place) {
        if let Ok(payload) = roblox::fetch_cached_json(
            &*state,
            &format!(
                "https://apis.roblox.com/universes/v1/places/{}/universe",
                place
            ),
        )
        .await
        {
            universe = value_string(payload.get("universeId"));
        }
    }
    if !valid_numeric_id(&universe) {
        return Ok(json!({"ok": false, "game": {}, "error": "invalid-id"}));
    }
    let mut games = roblox::get_game_details_by_universe(&*state, &[universe.clone()]).await;
    let mut game = games
        .pop()
        .unwrap_or_else(|| json!({"universeId": universe}));
    // Details endpoint data is richer than the compact list shape.
    if let Ok(payload) = roblox::fetch_cached_json(
        &*state,
        &format!("https://games.roblox.com/v1/games?universeIds={}", universe),
    )
    .await
    {
        if let Some(raw) = payload
            .get("data")
            .and_then(Value::as_array)
            .and_then(|a| a.first())
        {
            let thumb = game.get("thumbnail").and_then(Value::as_str).unwrap_or("");
            game = roblox::map_game(
                raw,
                thumb,
                if valid_numeric_id(&place) {
                    Some(place.as_str())
                } else {
                    None
                },
            );
            if let Some(obj) = game.as_object_mut() {
                for key in ["updated", "visits", "favorites", "playing", "universeId"] {
                    if let Some(v) = raw.get(key) {
                        obj.insert(key.to_string(), v.clone());
                    }
                }
            }
        }
    }
    // Roblox's thumbnails endpoint provides a stable icon URL for details.
    if let Ok(payload) = roblox::fetch_cached_json(&*state, &format!("https://thumbnails.roblox.com/v1/games/icons?universeIds={}&size=512x512&format=Png&isCircular=false", universe)).await {
        if let Some(url) = payload.get("data").and_then(Value::as_array).and_then(|a| a.first()).and_then(|v| v.get("imageUrl")).and_then(Value::as_str) {
            game["thumbnail"] = json!(cache::clean_thumbnail(url));
        }
    }
    let votes_url = format!("https://games.roblox.com/v1/games/{}/votes", universe);
    let (votes, media, badges) = tokio::join!(
        roblox::fetch_cached_json(&*state, &votes_url),
        detail_media(&*state, &universe),
        detail_badges(&*state, &universe)
    );
    if let Ok(votes) = votes {
        for key in ["upVotes", "downVotes"] {
            if let Some(value) = votes.get(key) {
                game[key] = value.clone();
            }
        }
    }
    game["media"] = json!(media);
    game["badges"] = json!(badges);
    Ok(json!({"ok": true, "game": game}))
}

#[tauri::command]
async fn games_similar(
    state: tauri::State<'_, Arc<AppState>>,
    universe_id: String,
    genre: Option<String>,
    title: Option<String>,
) -> Result<Vec<serde_json::Value>, String> {
    let query = title
        .filter(|value| !value.trim().is_empty())
        .or(genre)
        .unwrap_or_else(|| "popular".to_string());
    let session = Uuid::new_v4().to_string();
    let url = format!(
        "https://apis.roblox.com/search-api/omni-search?searchQuery={}&sessionId={}&pageType=all",
        encode_query(&query),
        encode_query(&session)
    );
    let payload = roblox::fetch_cached_json(&*state, &url).await?;
    let rows = map_content_rows(&payload);
    let ids: Vec<String> = rows
        .iter()
        .map(|row| value_string(row.get("universeId").or_else(|| row.get("id"))))
        .filter(|id| valid_numeric_id(id) && id != &universe_id)
        .collect();
    Ok(roblox::get_game_details_by_universe(&*state, &ids).await)
}

#[tauri::command]
async fn games_online(
    state: tauri::State<'_, Arc<AppState>>,
    universe_id: Option<String>,
    place_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let mut universe = universe_id.unwrap_or_default();
    let place = place_id.unwrap_or_default();
    if !valid_numeric_id(&universe) && valid_numeric_id(&place) {
        if let Ok(payload) = roblox::fetch_cached_json(
            &*state,
            &format!(
                "https://apis.roblox.com/universes/v1/places/{}/universe",
                place
            ),
        )
        .await
        {
            universe = value_string(payload.get("universeId"));
        }
    }
    if !valid_numeric_id(&universe) {
        return Ok(json!({"ok": false, "error": "invalid-id"}));
    }
    let payload = roblox::fetch_json(
        &format!("https://games.roblox.com/v1/games?universeIds={}", universe),
        None,
    )
    .await?;
    let Some(raw) = payload
        .get("data")
        .and_then(Value::as_array)
        .and_then(|rows| rows.first())
    else {
        return Ok(json!({"ok": false, "error": "not-found"}));
    };
    let votes = roblox::fetch_json(
        &format!("https://games.roblox.com/v1/games/{}/votes", universe),
        None,
    )
    .await
    .unwrap_or(Value::Null);
    Ok(json!({
        "ok": true,
        "playing": raw.get("playing").cloned().unwrap_or(json!(0)),
        "visits": raw.get("visits").cloned().unwrap_or(json!(0)),
        "favorites": raw.get("favorites").cloned().unwrap_or(json!(0)),
        "updated": raw.get("updated").cloned().unwrap_or(Value::Null),
        "upVotes": votes.get("upVotes").cloned().unwrap_or(json!(0)),
        "downVotes": votes.get("downVotes").cloned().unwrap_or(json!(0)),
        "fetchedAt": chrono::Utc::now().to_rfc3339()
    }))
}

#[tauri::command]
async fn roblox_runtime_status() -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(runtime::status)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn games_featured(
    state: tauri::State<'_, Arc<AppState>>,
    place_ids: Vec<String>,
) -> Result<Vec<serde_json::Value>, String> {
    let places: Vec<String> = place_ids
        .into_iter()
        .filter(|id| valid_numeric_id(id))
        .collect();
    if places.is_empty() {
        return Ok(Vec::new());
    }
    let mut universe_ids = Vec::new();
    let mut place_to_universe = std::collections::HashMap::new();
    for place in &places {
        if let Ok(payload) = roblox::fetch_cached_json(
            &*state,
            &format!(
                "https://apis.roblox.com/universes/v1/places/{}/universe",
                place
            ),
        )
        .await
        {
            let universe = value_string(payload.get("universeId"));
            if valid_numeric_id(&universe) {
                universe_ids.push(universe.clone());
                place_to_universe.insert(place.clone(), universe);
            }
        }
    }
    let games = roblox::get_game_details_by_universe(&*state, &universe_ids).await;
    Ok(places
        .iter()
        .filter_map(|place| {
            let uid = place_to_universe.get(place)?;
            games
                .iter()
                .find(|game| value_string(game.get("universeId")) == *uid)
                .map(|game| {
                    let mut value = game.clone();
                    value["id"] = json!(place);
                    value
                })
        })
        .collect())
}

#[tauri::command]
async fn games_discover(
    state: tauri::State<'_, Arc<AppState>>,
    sort_id: Option<String>,
    session_id: Option<String>,
    force: Option<bool>,
) -> Result<serde_json::Value, String> {
    let session = session_id
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    let selected = sort_id
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "top-trending".to_string());
    // The public discover API accepts the same sort IDs used by the web catalog.
    let url = format!(
        "https://apis.roblox.com/explore-api/v1/get-sorts?sessionId={}&device=computer&country=all",
        encode_query(&session)
    );
    let mut sorts = Vec::new();
    let payload = roblox::fetch_cached_json(&*state, &url).await?;
    if let Some(arr) = payload
        .get("sorts")
        .or_else(|| payload.get("data"))
        .and_then(Value::as_array)
    {
        sorts = arr
            .iter()
            .filter_map(|sort| {
                if sort
                    .get("contentType")
                    .and_then(Value::as_str)
                    .is_some_and(|kind| !kind.eq_ignore_ascii_case("games"))
                {
                    return None;
                }
                let id = value_string(sort.get("sortId").or_else(|| sort.get("id")));
                if id.is_empty() {
                    return None;
                }
                let title = sort
                    .get("sortDisplayName")
                    .or_else(|| sort.get("title"))
                    .or_else(|| sort.get("name"));
                let title_value = title
                    .filter(|value| !value.as_str().unwrap_or_default().is_empty())
                    .cloned()
                    .unwrap_or_else(|| json!(id.clone()));
                Some(json!({"id": id, "title": title_value}))
            })
            .collect();
    }
    if sorts.is_empty() {
        sorts = vec![
            "top-trending",
            "up-and-coming",
            "top-playing-now",
            "fun-with-friends",
            "top-revisited",
        ]
        .into_iter()
        .map(|id| json!({"id": id, "title": id}))
        .collect();
    }
    let sort_url = format!(
        "https://apis.roblox.com/explore-api/v1/get-sort-content?sessionId={}&sortId={}&device=computer&country=all",
        encode_query(&session),
        encode_query(&selected)
    );
    let payload = if force.unwrap_or(false) {
        roblox::refresh_cached_json(&state, &sort_url).await?
    } else {
        roblox::fetch_cached_json(&state, &sort_url).await?
    };
    let rows: Vec<Value> = map_content_rows(&payload)
        .into_iter()
        .filter(|row| row.get("isSponsored").and_then(Value::as_bool) != Some(true))
        .collect();
    let ids: Vec<String> = rows
        .iter()
        .map(|row| value_string(row.get("universeId").or_else(|| row.get("id"))))
        .filter(|id| valid_numeric_id(id))
        .collect();
    let mut details: std::collections::HashMap<String, Value> =
        roblox::get_game_details_by_universe(&*state, &ids)
            .await
            .into_iter()
            .map(|game| (value_string(game.get("universeId")), game))
            .collect();
    let items: Vec<Value> = rows
        .iter()
        .zip(map_game_rows(&rows))
        .enumerate()
        .map(|(index, (row, summary))| {
            let universe = value_string(summary.get("universeId"));
            let mut game = details.remove(&universe).unwrap_or(summary);
            for (source, target) in [
                ("playerCount", "playerCount"),
                ("totalUpVotes", "upVotes"),
                ("totalDownVotes", "downVotes"),
                ("genreL1", "genre"),
            ] {
                if let Some(value) = row.get(source).filter(|value| !value.is_null()) {
                    game[target] = value.clone();
                }
            }
            game["catalogRank"] = json!(index + 1);
            game
        })
        .collect();
    Ok(
        json!({"sessionId": session, "sorts": sorts, "selectedSortId": selected, "items": items, "nextSortsPageToken": null}),
    )
}

#[tauri::command]
async fn games_paid(
    state: tauri::State<'_, Arc<AppState>>,
    force: Option<bool>,
    fast: Option<bool>,
) -> Result<serde_json::Value, String> {
    if fast.unwrap_or(false) && !force.unwrap_or(false) {
        let cached = {
            let cache = state::lock_or_recover(&state.paid_cache);
            cache.data.clone()
        };
        let games = if cached.is_empty() {
            roblox::read_paid_index().await
        } else {
            cached
        };
        if !games.is_empty() {
            return Ok(json!({"games": games, "complete": false}));
        }
    }
    if !force.unwrap_or(false) {
        let cache = state::lock_or_recover(&state.paid_cache);
        if cache
            .at
            .map(|at| at.elapsed() < std::time::Duration::from_secs(10 * 60))
            .unwrap_or(false)
        {
            return Ok(json!({"games": cache.data, "complete": cache.complete}));
        }
    }
    // Run one bounded incremental scan using the paid-games index helper;
    // fetching details also records priced experiences in the on-disk index.
    let (ids, _cursor, complete) = roblox::collect_paid_universe_ids(&*state).await;
    let mut games = roblox::get_game_details_by_universe(&*state, &ids).await;
    games.retain(|game| {
        game.get("price").and_then(Value::as_u64).unwrap_or(0) > 0
            && game.get("availability").and_then(Value::as_str) != Some("unavailable")
    });
    if games.is_empty() {
        // Preserve the last known index when a network scan returned nothing.
        let cache = state::lock_or_recover(&state.paid_cache);
        games = cache.data.clone();
    }
    let mut cache = state::lock_or_recover(&state.paid_cache);
    cache.at = Some(Instant::now());
    cache.data = games.clone();
    cache.complete = complete;
    Ok(json!({"games": games, "complete": complete}))
}

#[tauri::command]
async fn games_release_history(
    state: tauri::State<'_, Arc<AppState>>,
    universe_id: String,
) -> Result<Vec<serde_json::Value>, String> {
    if !valid_numeric_id(&universe_id) {
        return Ok(Vec::new());
    }
    let key = format!("release-history:{}", universe_id);
    let previous = cache::read_disk_cache("search", &key)
        .await
        .and_then(|value| value.as_array().cloned())
        .unwrap_or_default();
    let url = format!(
        "https://games.roblox.com/v1/games?universeIds={}",
        universe_id
    );
    let updated = roblox::fetch_cached_json(&*state, &url)
        .await
        .ok()
        .and_then(|payload| {
            payload
                .get("data")
                .and_then(Value::as_array)
                .and_then(|arr| arr.first())
                .and_then(|row| row.get("updated"))
                .cloned()
        });
    let Some(updated) = updated else {
        return Ok(Vec::new());
    };
    let now = updated.as_str().unwrap_or("").to_string();
    if now.is_empty() {
        return Ok(Vec::new());
    }
    let mut history = vec![json!({"updated": now})];
    history.extend(previous);
    let mut seen = std::collections::HashSet::new();
    history.retain(|entry| seen.insert(value_string(entry.get("updated"))));
    history.truncate(8);
    cache::write_disk_cache("search", &key, &Value::Array(history.clone())).await;
    Ok(history)
}

#[tauri::command]
async fn cache_set_disk_enabled(
    state: tauri::State<'_, Arc<AppState>>,
    enabled: bool,
) -> Result<bool, String> {
    *state::lock_or_recover(&state.disk_cache_enabled) = enabled;
    Ok(enabled)
}

#[tauri::command]
async fn cache_disk_stats(
    _state: tauri::State<'_, Arc<AppState>>,
) -> Result<serde_json::Value, String> {
    let (thumbs, search, shortcuts) = tokio::join!(
        cache::count_disk_cache("thumbs"),
        cache::count_disk_cache("search"),
        shortcut_icon::count_shortcut_icons()
    );
    Ok(json!({"thumbnails": thumbs, "search": search, "shortcutIcons": shortcuts}))
}

#[tauri::command]
async fn cache_clear_disk(
    _state: tauri::State<'_, Arc<AppState>>,
    kind: Option<String>,
) -> Result<bool, String> {
    let target = kind.unwrap_or_default();
    cache::clear_disk_cache(&target).await;
    if target.is_empty() || target == "shortcuts" {
        shortcut_icon::clear_shortcut_icons().await;
    }
    Ok(true)
}

#[tauri::command]
async fn clear_search_cache(state: tauri::State<'_, Arc<AppState>>) -> Result<bool, String> {
    state::lock_or_recover(&state.response_cache).clear();
    Ok(true)
}

fn open_game_links(
    place_id: &str,
    game_id: Option<&str>,
    access_code: Option<&str>,
) -> Result<(String, String), String> {
    if !valid_numeric_id(place_id) {
        return Err("invalid place id".to_string());
    }
    let mut params = format!("placeId={}", place_id);
    if let Some(server) = game_id.map(str::trim).filter(|id| !id.is_empty()) {
        if server.len() > 64 || !server.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
            return Err("invalid server id".to_string());
        }
        params.push_str("&gameInstanceId=");
        params.push_str(&encode_query(server));
    }
    if let Some(code) = access_code.map(str::trim).filter(|code| !code.is_empty()) {
        if !valid_quick_code(code, 128) {
            return Err("invalid private server access code".to_string());
        }
        params.push_str("&accessCode=");
        params.push_str(&encode_query(code));
    }
    Ok((
        format!("roblox://experiences/start?{}", params),
        format!("https://www.roblox.com/games/start?{}", params),
    ))
}

#[tauri::command]
async fn open_game(
    place_id: String,
    game_id: Option<String>,
    access_code: Option<String>,
) -> Result<String, String> {
    let (url, browser) = open_game_links(&place_id, game_id.as_deref(), access_code.as_deref())?;
    match open_url(&url) {
        Ok(()) => Ok("roblox".to_string()),
        Err(_) => {
            open_url(&browser).map_err(|e| format!("failed to launch Roblox: {}", e))?;
            Ok("browser".to_string())
        }
    }
}

fn quick_game_links(
    method: &str,
    place_id: Option<String>,
    link_code: Option<String>,
    share_code: Option<String>,
    share_type: Option<String>,
    server_id: Option<String>,
    access_code: Option<String>,
) -> Result<(String, String), String> {
    let place = place_id.unwrap_or_default();
    let links = match method {
        // Roblox deep links use `experiences/start` with `placeId` and `linkCode` query parameters.
        "private" => {
            let code = link_code.unwrap_or_default();
            if !valid_numeric_id(&place) || !valid_quick_code(&code, 100) {
                return Err("invalid private server link".to_string());
            }
            let params = format!("placeId={}&linkCode={}", place, encode_query(&code));
            (
                format!("roblox://experiences/start?{}", params),
                format!("https://www.roblox.com/games/start?{}", params),
            )
        }
        // Share links are opened through Roblox's native share-links route.
        "share" => {
            let code = share_code.unwrap_or_default();
            let kind = share_type.unwrap_or_else(|| "Server".to_string());
            if !valid_quick_code(&code, 128) {
                return Err("invalid Roblox share code".to_string());
            }
            if !matches!(
                kind.as_str(),
                "Server" | "ExperienceInvite" | "ExperienceDetails"
            ) {
                return Err("invalid Roblox share link type".to_string());
            }
            (
                format!(
                    "roblox://navigation/share_links?code={}&type={}",
                    encode_query(&code),
                    encode_query(&kind)
                ),
                format!(
                    "https://www.roblox.com/share?code={}&type={}",
                    encode_query(&code),
                    encode_query(&kind)
                ),
            )
        }
        // Public place launch requires only its Place ID.
        "public" => {
            if !valid_numeric_id(&place) {
                return Err("invalid place id".to_string());
            }
            (
                format!("roblox://experiences/start?placeId={}", place),
                format!("https://www.roblox.com/games/{}", place),
            )
        }
        "instance" | "access" => {
            let (parameter, value, limit) = if method == "instance" {
                ("gameInstanceId", server_id.unwrap_or_default(), 64)
            } else {
                ("accessCode", access_code.unwrap_or_default(), 128)
            };
            let value = value.trim();
            if !valid_numeric_id(&place) || !valid_quick_code(value, limit) {
                return Err("invalid server launch target".to_string());
            }
            let params = format!("placeId={}&{}={}", place, parameter, encode_query(value));
            (
                format!("roblox://experiences/start?{}", params),
                format!("https://www.roblox.com/games/start?{}", params),
            )
        }
        _ => return Err("unsupported quick launch method".to_string()),
    };
    Ok(links)
}

#[tauri::command]
async fn launch_quick_game(
    method: String,
    place_id: Option<String>,
    link_code: Option<String>,
    share_code: Option<String>,
    share_type: Option<String>,
    server_id: Option<String>,
    access_code: Option<String>,
) -> Result<String, String> {
    let (deep_link, browser_url) = quick_game_links(&method, place_id, link_code, share_code, share_type, server_id, access_code)?;
    match open_url(&deep_link) {
        Ok(()) => Ok("roblox".to_string()),
        Err(_) => {
            open_url(&browser_url).map_err(|e| format!("failed to launch Roblox: {}", e))?;
            Ok("browser".to_string())
        }
    }
}

#[tauri::command]
async fn create_desktop_shortcut(
    title: String,
    method: String,
    place_id: Option<String>,
    link_code: Option<String>,
    share_code: Option<String>,
    share_type: Option<String>,
    server_id: Option<String>,
    access_code: Option<String>,
    thumbnail: Option<String>,
) -> Result<bool, String> {
    let (deep_link, _) = quick_game_links(
        &method, place_id, link_code, share_code, share_type, server_id, access_code,
    )?;
    let url = desktop_shortcut_url(&deep_link);
    let desktop = dirs::desktop_dir().ok_or("Desktop folder not found")?;
    let name: String = title
        .chars()
        .filter(|c| c.is_alphanumeric() || matches!(c, ' ' | '-' | '_'))
        .take(64)
        .collect();
    let name = if name.trim().is_empty() { "Roblox" } else { name.trim() };
    let art = shortcut_icon::load_shortcut_icon(thumbnail.as_deref()).await;
    let fallback = std::env::current_exe().ok();
    let icon = art.as_deref().or(fallback.as_deref());
    for index in 1..=100 {
        let suffix = if index == 1 { String::new() } else { format!(" ({index})") };
        let filename = desktop.join(format!("Vortex - {name}{suffix}.url"));
        if filename.with_extension("lnk").exists() {
            continue;
        }
        match write_windows_shortcut(&filename, &url, icon) {
            Ok(()) => return Ok(art.is_some()),
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(_) => return Err("Windows could not save the shortcut".to_string()),
        }
    }
    Err("No available shortcut name".to_string())
}

fn desktop_shortcut_url(deep_link: &str) -> String {
    // Use the explicit experience launch route for desktop activations.
    match deep_link.strip_prefix("roblox://placeId=") {
        Some(target) => format!("roblox://experiences/start?placeId={target}"),
        None => deep_link.to_owned(),
    }
}

fn write_windows_shortcut(filename: &Path, url: &str, icon: Option<&Path>) -> std::io::Result<()> {
    use std::io::Write;

    let mut shortcut = format!("[InternetShortcut]\r\nURL={url}\r\n");
    if let Some(icon) = icon.and_then(Path::to_str) {
        shortcut.push_str(&format!("IconFile={icon}\r\nIconIndex=0\r\n"));
    }
    // A UTF-16 BOM keeps paths with non-ASCII characters readable by Explorer.
    let data: Vec<_> = std::iter::once(0xfeff)
        .chain(shortcut.encode_utf16())
        .flat_map(u16::to_le_bytes)
        .collect();
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(filename)?;
    if let Err(error) = file.write_all(&data) {
        drop(file);
        let _ = std::fs::remove_file(filename);
        return Err(error);
    }
    Ok(())
}

#[cfg(test)]
mod shortcut_tests {
    use super::*;

    #[test]
    fn shortcut_preserves_the_exact_server_target_and_icon() {
        let (deep_link, _) = quick_game_links(
            "private",
            Some("812001".into()),
            Some("example_link".into()),
            None,
            None,
            None,
            None,
        )
        .unwrap();
        let url = desktop_shortcut_url(&deep_link);
        assert_eq!(
            url,
            "roblox://experiences/start?placeId=812001&linkCode=example_link"
        );
        let path = std::env::temp_dir().join(format!("vortex-shortcut-{}.url", Uuid::new_v4()));
        let icon_path = std::env::temp_dir().join("Vortex — обложка.ico");
        write_windows_shortcut(&path, &url, Some(&icon_path)).unwrap();
        let bytes = std::fs::read(&path).unwrap();
        let duplicate = write_windows_shortcut(&path, &url, None).unwrap_err();
        let _ = std::fs::remove_file(path);
        assert_eq!(duplicate.kind(), std::io::ErrorKind::AlreadyExists);
        let words = bytes
            .chunks_exact(2)
            .map(|pair| u16::from_le_bytes([pair[0], pair[1]]))
            .collect::<Vec<_>>();
        assert_eq!(
            String::from_utf16(&words).unwrap(),
            format!(
                "\u{feff}[InternetShortcut]\r\nURL={url}\r\nIconFile={}\r\nIconIndex=0\r\n",
                icon_path.display()
            )
        );
    }

    #[test]
    fn shortcut_keeps_roblox_share_navigation() {
        let share = "roblox://navigation/share_links?code=example_share&type=Server";
        assert_eq!(desktop_shortcut_url(share), share);
        assert_eq!(
            desktop_shortcut_url("roblox://placeId=1818"),
            "roblox://experiences/start?placeId=1818"
        );
        assert_eq!(
            desktop_shortcut_url("roblox://placeId=1818&gameInstanceId=example"),
            "roblox://experiences/start?placeId=1818&gameInstanceId=example"
        );
    }

    #[test]
    fn private_server_access_code_uses_canonical_experiences_start_deeplink() {
        let (deep_link, browser) = quick_game_links(
            "access",
            Some("8304191830".into()),
            None,
            None,
            None,
            None,
            Some("3f12ab45-1234-5678-9abc-def012345678".into()),
        )
        .unwrap();
        assert_eq!(
            deep_link,
            "roblox://experiences/start?placeId=8304191830&accessCode=3f12ab45-1234-5678-9abc-def012345678"
        );
        assert_eq!(
            browser,
            "https://www.roblox.com/games/start?placeId=8304191830&accessCode=3f12ab45-1234-5678-9abc-def012345678"
        );
        assert_eq!(desktop_shortcut_url(&deep_link), deep_link);

        let (open_deep, open_browser) = open_game_links(
            "8304191830",
            None,
            Some("vip_code-12345678"),
        )
        .unwrap();
        assert_eq!(
            open_deep,
            "roblox://experiences/start?placeId=8304191830&accessCode=vip_code-12345678"
        );
        assert_eq!(
            open_browser,
            "https://www.roblox.com/games/start?placeId=8304191830&accessCode=vip_code-12345678"
        );

        // Malformed accessCode must fail instead of silently joining a public server.
        assert!(open_game_links("8304191830", None, Some("bad code with spaces!")).is_err());
    }
}

#[tauri::command]
async fn roblox_api_status(
    _state: tauri::State<'_, Arc<AppState>>,
) -> Result<serde_json::Value, String> {
    let checks = [
        ("games", "https://games.roblox.com/v1/games?universeIds=1"),
        ("thumbnails", "https://thumbnails.roblox.com/v1/games/icons?universeIds=1&size=150x150&format=Png&isCircular=false"),
        ("badges", "https://badges.roblox.com/v1/universes/1/badges?limit=10&sortOrder=Asc"),
        ("search", "https://apis.roblox.com/search-api/omni-search?searchQuery=roblox&sessionId=vortex-status&pageType=all"),
        ("discover", "https://apis.roblox.com/explore-api/v1/get-sorts?sessionId=vortex-status&device=computer&country=all"),
        ("users", "https://users.roblox.com/v1/users/1"),
    ];
    let mut handles = Vec::with_capacity(checks.len());
    for (id, url) in checks {
        handles.push(tokio::spawn(async move {
            let started = Instant::now();
            let ok = roblox::shared_http_client()
                .get(url)
                .timeout(std::time::Duration::from_secs(6))
                .send()
                .await
                .map(|response| response.status().is_success())
                .unwrap_or(false);
            json!({"id": id, "ok": ok, "ms": started.elapsed().as_millis()})
        }));
    }
    let mut services = Vec::with_capacity(handles.len());
    for handle in handles {
        if let Ok(row) = handle.await {
            services.push(row);
        }
    }
    Ok(json!({"checkedAt": chrono::Utc::now().to_rfc3339(), "services": services}))
}

#[tauri::command]
async fn import_legacy_local_storage() -> Result<legacy_storage::LegacyStorageImport, String> {
    legacy_storage::import_legacy_local_storage()
}

#[tauri::command]
async fn roblox_account(
    state: tauri::State<'_, Arc<AppState>>,
    profile_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let cookie = profile_cookie(&state, profile_id.as_deref());
    if let Some(account) = friends::detect_authenticated_account(&*state, &cookie).await {
        return Ok(json!({"ok": true, "account": account}));
    }
    if is_main_profile(profile_id.as_deref()) {
        if let Some(account) = friends::detect_local_roblox_account(&*state).await {
        return Ok(json!({"ok": true, "account": account}));
        }
    }
    Ok(json!({"ok": false, "account": null}))
}

#[tauri::command]
async fn friends_detect_account(
    state: tauri::State<'_, Arc<AppState>>,
) -> Result<serde_json::Value, String> {
    if let Some(account) = friends::detect_local_roblox_account(&*state).await {
        Ok(json!({"ok": true, "account": account}))
    } else {
        Ok(json!({"ok": false, "account": null}))
    }
}

#[tauri::command]
async fn friends_list(
    state: tauri::State<'_, Arc<AppState>>,
    username: String,
    profile_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let account = match friends::resolve_roblox_user_id(&username).await {
        Ok(Some(account)) => account,
        Ok(None) => return Ok(json!({"ok": false, "error": "not-found", "friends": []})),
        Err(error) => {
            return Ok(json!({"ok": false, "error": "network", "message": error, "friends": []}))
        }
    };
    let user_id = value_string(account.get("id"));
    if !valid_numeric_id(&user_id) {
        return Ok(json!({"ok": false, "error": "not-found", "friends": []}));
    }
    let cookie = profile_cookie(&state, profile_id.as_deref());
    let mut list = match friends::fetch_roblox_friends(&*state, &user_id, &cookie).await {
        Ok(list) => list,
        Err(error) => {
            let code = if error.contains("403") || error.contains("401") {
                if cookie.trim().is_empty() {
                    "auth-required"
                } else if !friends::is_cookie_valid(&cookie).await {
                    "cookie-expired"
                } else {
                    "auth-required"
                }
            } else if error.contains("429") {
                "rate-limited"
            } else {
                "network"
            };
            return Ok(json!({"ok": false, "error": code, "message": error, "friends": []}));
        }
    };
    if list.is_empty() {
        return Ok(json!({"ok": true, "friends": [], "livePresence": false}));
    }
    let ids: Vec<String> = list
        .iter()
        .map(|friend| value_string(friend.get("id")))
        .filter(|id| valid_numeric_id(id))
        .collect();
    let missing_name_ids: Vec<String> = list
        .iter()
        .filter(|friend| {
            friend
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or("")
                .trim()
                .is_empty()
                || friend
                    .get("displayName")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .trim()
                    .is_empty()
        })
        .map(|friend| value_string(friend.get("id")))
        .filter(|id| valid_numeric_id(id))
        .collect();
    let (names, avatars, presences) = tokio::join!(
        friends::fetch_roblox_user_names(&missing_name_ids),
        friends::fetch_roblox_user_thumbnails(&*state, &ids),
        friends::fetch_roblox_presence(&ids, &cookie)
    );
    let playing_universe_ids: Vec<String> = presences
        .iter()
        .filter(|p| p.get("userPresenceType").and_then(Value::as_u64) == Some(2))
        .map(|p| value_string(p.get("universeId")))
        .filter(|uid| valid_numeric_id(uid))
        .collect();
    let playing_meta = friends::fetch_playing_game_meta(&*state, &playing_universe_ids).await;
    let mut presence_by_id = std::collections::HashMap::new();
    for presence in presences {
        let id = value_string(presence.get("userId"));
        if !id.is_empty() {
            presence_by_id.insert(id, presence);
        }
    }
    for friend in &mut list {
        let id = value_string(friend.get("id"));
        let friend_is_online = friend
            .get("isOnline")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        if let Some(obj) = friend.as_object_mut() {
            if let Some(avatar) = avatars.get(&id) {
                obj.insert("avatar".to_string(), json!(avatar));
            }
            if let Some(name) = names.get(&id) {
                if obj
                    .get("name")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .trim()
                    .is_empty()
                {
                    obj.insert(
                        "name".to_string(),
                        name.get("name").cloned().unwrap_or(Value::Null),
                    );
                }
                if obj
                    .get("displayName")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .trim()
                    .is_empty()
                {
                    obj.insert(
                        "displayName".to_string(),
                        name.get("displayName").cloned().unwrap_or(Value::Null),
                    );
                }
            }
            if obj
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or("")
                .trim()
                .is_empty()
            {
                let fallback = format!("Roblox user {}", id);
                obj.insert("name".to_string(), json!(fallback.clone()));
                if obj
                    .get("displayName")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .trim()
                    .is_empty()
                {
                    obj.insert("displayName".to_string(), json!(fallback));
                }
            }
            let presence = presence_by_id.get(&id);
            let type_id = presence
                .and_then(|p| p.get("userPresenceType"))
                .and_then(Value::as_u64)
                .unwrap_or(0);
            let playing = type_id == 2;
            let online = if presence.is_some() {
                type_id > 0
            } else {
                friend_is_online
            };
            obj.insert(
                "presence".to_string(),
                json!(if playing {
                    "playing"
                } else if online {
                    "online"
                } else {
                    "offline"
                }),
            );
            obj.insert("isOnline".to_string(), json!(online));
            if playing {
                if let Some(p) = presence {
                    for key in ["rootPlaceId", "universeId"] {
                        let id = value_string(p.get(key));
                        if valid_numeric_id(&id) { obj.insert(key.to_string(), json!(id)); }
                    }
                    if let Some(place) = p.get("placeId") {
                        obj.insert("placeId".to_string(), json!(value_string(Some(place))));
                    }
                    if let Some(game) = p.get("gameId") {
                        obj.insert("gameId".to_string(), json!(value_string(Some(game))));
                    }
                    let uid = value_string(p.get("universeId"));
                    let meta = playing_meta.get(&uid);
                    if let Some((orig_title, icon_url)) = meta {
                        if !orig_title.is_empty() {
                            obj.insert("gameName".to_string(), json!(orig_title));
                        } else if let Some(s) = p
                            .get("lastLocation")
                            .or_else(|| p.get("gameName"))
                            .and_then(Value::as_str)
                        {
                            obj.insert("gameName".to_string(), json!(s));
                        }
                        if !icon_url.is_empty() {
                            obj.insert("gameThumbnail".to_string(), json!(icon_url));
                        }
                    } else if let Some(name) = p.get("lastLocation").or_else(|| p.get("gameName")) {
                        if let Some(s) = name.as_str() {
                            obj.insert("gameName".to_string(), json!(s));
                        }
                    }
                    if let Some(place) = p.get("placeId") {
                        obj.insert(
                            "playingPlaceId".to_string(),
                            json!(value_string(Some(place))),
                        );
                    }
                }
            } else {
                for key in [
                    "placeId",
                    "rootPlaceId",
                    "universeId",
                    "gameId",
                    "gameName",
                    "gameThumbnail",
                    "playingPlaceId",
                ] {
                    obj.remove(key);
                }
            }
        }
    }
    Ok(json!({"ok": true, "friends": list, "livePresence": !presence_by_id.is_empty()}))
}

fn is_main_profile(id: Option<&str>) -> bool {
    matches!(id, None | Some("default"))
}

pub(crate) fn profile_cookie(state: &AppState, id: Option<&str>) -> String {
    if is_main_profile(id) {
        state::lock_or_recover(&state.roblox_cookie).clone()
    } else {
        cookie::load_cookie(id)
    }
}

#[tauri::command]
async fn friends_presence_status(
    state: tauri::State<'_, Arc<AppState>>,
    profile_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let cookie = profile_cookie(&state, profile_id.as_deref());
    Ok(json!({"enabled": !cookie.is_empty()}))
}

#[tauri::command]
async fn friends_presence_cookie(
    state: tauri::State<'_, Arc<AppState>>,
    cookie: Option<String>,
    remove: Option<bool>,
    profile_id: Option<String>,
    username: Option<String>,
) -> Result<serde_json::Value, String> {
    let profile = profile_id.as_deref();
    if remove.unwrap_or(false) {
        if !cookie::save_cookie("", profile) {
            return Ok(json!({"ok": false, "error": "rejected"}));
        }
        if is_main_profile(profile) {
            *state::lock_or_recover(&state.roblox_cookie) = String::new();
        }
        Ok(json!({"ok": true, "enabled": false}))
    } else if let Some(raw_cookie) = cookie {
        let c = roblox::normalize_cookie_value(&raw_cookie).to_string();
        if c.len() < 100 || c.len() > 4096 || c.chars().any(|ch| ch.is_whitespace() || ch.is_control() || matches!(ch, '"' | '\''))
        {
            return Ok(json!({"ok": false, "error": "invalid"}));
        }
        if !is_main_profile(profile) {
            let matched = friends::detect_authenticated_account(&state, &c).await
                .and_then(|account| account.get("name").and_then(Value::as_str).map(str::to_owned))
                .zip(username)
                .is_some_and(|(actual, expected)| actual.eq_ignore_ascii_case(&expected));
            if !matched {
                return Ok(json!({"ok": false, "error": "profile-mismatch"}));
            }
        }
        if cookie::save_cookie(&c, profile) {
            if is_main_profile(profile) {
                *state::lock_or_recover(&state.roblox_cookie) = c;
            }
            Ok(json!({"ok": true, "enabled": true}))
        } else {
            Ok(json!({"ok": false, "error": "rejected"}))
        }
    } else {
        Ok(json!({"ok": false, "error": "invalid"}))
    }
}

#[tauri::command]
async fn announcements_list(
    state: tauri::State<'_, Arc<AppState>>,
    force: Option<bool>,
) -> Result<serde_json::Value, String> {
    let (items, source) = announcements::load_announcements(&*state, force.unwrap_or(false)).await;
    Ok(json!({"items": items, "source": source}))
}

#[tauri::command]
async fn plans_list(
    state: tauri::State<'_, Arc<AppState>>,
    force: Option<bool>,
) -> Result<serde_json::Value, String> {
    let (items, source) = plans::load_plans(&state, force.unwrap_or(false)).await;
    Ok(json!({"items": items, "source": source}))
}

#[tauri::command]
async fn announcements_open(url: String) -> Result<bool, String> {
    if !url::Url::parse(&url)
        .ok()
        .map(|parsed| matches!(parsed.scheme(), "http" | "https"))
        .unwrap_or(false)
    {
        return Ok(false);
    }
    Ok(open_url(&url).is_ok())
}

#[tauri::command]
async fn notifications_friend_playing(
    app: AppHandle,
    friend: String,
    game: String,
) -> Result<bool, String> {
    use tauri_plugin_notification::NotificationExt;
    let friend: String = friend.chars().filter(|ch| !ch.is_control()).take(64).collect();
    let game: String = game.chars().filter(|ch| !ch.is_control()).take(120).collect();
    Ok(app.notification().builder().title("Vortex").body(format!("{friend} · {game}")).show().is_ok())
}

#[tauri::command]
fn notifications_activity_break(app: AppHandle, title: String, body: String) -> bool {
    use tauri_plugin_notification::NotificationExt;
    let title: String = title.chars().filter(|ch| !ch.is_control()).take(64).collect();
    let body: String = body.chars().filter(|ch| !ch.is_control()).take(160).collect();
    app.notification().builder().title(title).body(body).show().is_ok()
}

#[tauri::command]
async fn discord_set_enabled(
    state: tauri::State<'_, Arc<AppState>>,
    enabled: bool,
) -> Result<serde_json::Value, String> {
    let activity = {
        let mut discord = state
            .discord
            .lock()
            .map_err(|_| "Discord state unavailable".to_string())?;
        discord.enabled = enabled;
        if !enabled {
            discord.connected = false;
            discord.error.clear();
        }
        discord
            .activity
            .as_ref()
            .map(|value| value.to_rpc_json())
    };
    if enabled {
        let _ = discord::send_activity(&state, true, activity, false).await;
    } else {
        let _ = discord::send_activity(&state, false, None, false).await;
    }
    discord::public_status(&state, enabled)
}

#[tauri::command]
async fn discord_set_client_id(
    state: tauri::State<'_, Arc<AppState>>,
    client_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let clean = client_id
        .unwrap_or_default()
        .chars()
        .filter(|character| character.is_ascii_digit())
        .take(22)
        .collect::<String>();
    let valid = clean.is_empty() || (clean.len() >= 15 && clean.len() <= 22);
    let stored = if valid { clean } else { String::new() };
    *state::lock_or_recover(&state.discord_client_id) = stored;
    let enabled = state
        .discord
        .lock()
        .map(|discord| discord.enabled)
        .unwrap_or(false);
    let activity = state.discord.lock().ok().and_then(|discord| {
        discord
            .activity
            .as_ref()
            .map(|value| value.to_rpc_json())
    });
    // Wake the worker so a changed id triggers a new IPC handshake right away.
    let _ = discord::send_activity(&*state, enabled, activity, false).await;
    discord::public_status(&*state, enabled)
}

#[tauri::command]
async fn discord_status(
    state: tauri::State<'_, Arc<AppState>>,
) -> Result<serde_json::Value, String> {
    let enabled = state
        .discord
        .lock()
        .map(|value| value.enabled)
        .unwrap_or(false);
    if enabled {
        let activity = state.discord.lock().ok().and_then(|discord| {
            discord
                .activity
                .as_ref()
                .map(|value| value.to_rpc_json())
        });
        let update_activity = activity.is_some();
        let _ = discord::send_activity(&state, true, activity, update_activity).await;
    }
    discord::public_status(&state, enabled)
}

#[tauri::command]
async fn discord_set_activity(
    state: tauri::State<'_, Arc<AppState>>,
    activity: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let (enabled, rpc_payload) = {
        let mut discord = state
            .discord
            .lock()
            .map_err(|_| "Discord state unavailable".to_string())?;
        discord.activity = activity
            .as_ref()
            .map(|value| {
                let start_timestamp = value
                    .get("startTimestamp")
                    .and_then(Value::as_u64)
                    .or_else(|| {
                        value
                            .get("timestamps")
                            .and_then(|t| t.get("start"))
                            .and_then(Value::as_u64)
                    });
                let first_button = value
                    .get("buttons")
                    .and_then(Value::as_array)
                    .and_then(|arr| arr.first());
                let button_label = value
                    .get("buttonLabel")
                    .and_then(Value::as_str)
                    .or_else(|| first_button.and_then(|b| b.get("label")).and_then(Value::as_str))
                    .map(|text| text.chars().take(32).collect::<String>())
                    .filter(|text| !text.trim().is_empty());
                let button_url = value
                    .get("buttonUrl")
                    .and_then(Value::as_str)
                    .or_else(|| first_button.and_then(|b| b.get("url")).and_then(Value::as_str))
                    .map(|text| text.trim().chars().take(256).collect::<String>())
                    .filter(|url| url.starts_with("https://www.roblox.com/"));
                let large_image = value
                    .get("largeImage")
                    .and_then(Value::as_str)
                    .map(|text| text.trim().chars().take(256).collect::<String>())
                    .filter(|url| url.starts_with("https://"));
                let large_text = value
                    .get("largeText")
                    .and_then(Value::as_str)
                    .map(|text| text.trim().chars().take(128).collect::<String>())
                    .filter(|text| !text.is_empty());
                crate::state::DiscordActivity {
                    details: value
                        .get("details")
                        .and_then(Value::as_str)
                        .map(|text| text.chars().take(128).collect()),
                    state: value
                        .get("state")
                        .and_then(Value::as_str)
                        .map(|text| text.chars().take(128).collect()),
                    start_timestamp,
                    button_label,
                    button_url,
                    large_image,
                    large_text,
                }
            });
        let payload = discord.activity.as_ref().map(|a| a.to_rpc_json());
        (discord.enabled, payload)
    };
    if enabled {
        let _ = discord::send_activity(&state, true, rpc_payload, true).await;
    }
    discord::public_status(&state, true)
}

static MAIN_WINDOW_REVEALED: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);
static APP_STARTED_AT: std::sync::OnceLock<Instant> = std::sync::OnceLock::new();

fn reveal_main_window(app: &AppHandle) {
    if MAIN_WINDOW_REVEALED.swap(true, std::sync::atomic::Ordering::AcqRel) {
        return;
    }
    let handle = app.clone();
    std::thread::spawn(move || {
        // Keep the splash visible briefly so it finishes its entrance smoothly
        // and never flashes over the main window.
        let min_splash = std::time::Duration::from_millis(750);
        if let Some(started) = APP_STARTED_AT.get() {
            if let Some(remaining) = min_splash.checked_sub(started.elapsed()) {
                std::thread::sleep(remaining);
            }
        }
        if let Some(splash) = handle.get_webview_window("splash") {
            let _ = splash.emit("splash:done", ());
            std::thread::sleep(std::time::Duration::from_millis(220));
            let _ = splash.hide();
            let _ = splash.close();
            std::thread::sleep(std::time::Duration::from_millis(40));
        }
        if let Some(window) = handle.get_webview_window("main") {
            restore_window_geometry(&window);
            let _ = window.show();
            let _ = window.set_focus();
        }
    });
}

#[tauri::command]
fn app_ready(app: AppHandle) {
    reveal_main_window(&app);
}

#[cfg(windows)]
struct SingleInstanceGuard(isize);

#[cfg(windows)]
impl Drop for SingleInstanceGuard {
    fn drop(&mut self) {
        if self.0 != 0 {
            unsafe {
                #[link(name = "kernel32")]
                extern "system" {
                    fn CloseHandle(object: isize) -> i32;
                }
                CloseHandle(self.0);
            }
        }
    }
}

#[cfg(windows)]
fn acquire_single_instance() -> Option<SingleInstanceGuard> {
    const ERROR_ALREADY_EXISTS: u32 = 183;
    const SW_SHOW: i32 = 5;
    const SW_RESTORE: i32 = 9;
    #[link(name = "kernel32")]
    extern "system" {
        fn CreateMutexW(
            attrs: *const std::ffi::c_void,
            initial_owner: i32,
            name: *const u16,
        ) -> isize;
        fn GetLastError() -> u32;
        fn CloseHandle(object: isize) -> i32;
    }
    #[link(name = "user32")]
    extern "system" {
        fn FindWindowW(class_name: *const u16, window_name: *const u16) -> isize;
        fn IsIconic(hwnd: isize) -> i32;
        fn ShowWindow(hwnd: isize, cmd_show: i32) -> i32;
        fn SetForegroundWindow(hwnd: isize) -> i32;
    }

    let mutex_name: Vec<u16> = "Local\\VortexLauncherSingleInstance\0"
        .encode_utf16()
        .collect();
    unsafe {
        let handle = CreateMutexW(std::ptr::null(), 1, mutex_name.as_ptr());
        if handle == 0 {
            return Some(SingleInstanceGuard(0));
        }
        if GetLastError() == ERROR_ALREADY_EXISTS {
            CloseHandle(handle);
            let title: Vec<u16> = "Vortex — Roblox Place Launcher\0".encode_utf16().collect();
            let hwnd = FindWindowW(std::ptr::null(), title.as_ptr());
            if hwnd != 0 {
                if IsIconic(hwnd) != 0 {
                    ShowWindow(hwnd, SW_RESTORE);
                } else {
                    ShowWindow(hwnd, SW_SHOW);
                }
                SetForegroundWindow(hwnd);
            }
            return None;
        }
        Some(SingleInstanceGuard(handle))
    }
}

fn main() {
    if std::env::args().any(|arg| arg == "--updater-mode") {
        updates::run_updater_mode();
        return;
    }
    if std::env::args().any(|arg| arg == "--test-updater") {
        updates::run_updater_preview_mode();
        return;
    }

    #[cfg(windows)]
    let _single_instance = match acquire_single_instance() {
        Some(guard) => guard,
        None => return,
    };

    let app_state = Arc::new(AppState::new());

    // Load the stored cookie on startup.
    *state::lock_or_recover(&app_state.roblox_cookie) = cookie::load_cookie(None);

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .manage(app_state)
        .manage(Arc::new(overlay::OverlayState::default()))
        .setup(|app| {
            tauri::async_runtime::spawn(overlay::run(app.handle().clone(), app.state::<Arc<overlay::OverlayState>>().inner().clone()));
            let state = app.state::<Arc<AppState>>().inner().clone();
            let (discord_tx, discord_rx) = tokio::sync::mpsc::unbounded_channel();
            *state::lock_or_recover(&state.discord_commands) = Some(discord_tx);
            tauri::async_runtime::spawn(discord::run(discord_rx, state));
            let _tray_window =
                WebviewWindowBuilder::new(app, "tray", WebviewUrl::App("tray.html".into()))
                    .title("Vortex Quick Access")
                    .inner_size(338.0, 220.0)
                    .decorations(false)
                    .transparent(true)
                    .shadow(false)
                    .resizable(false)
                    .always_on_top(true)
                    .skip_taskbar(true)
                    .visible(false)
                    .focused(true)
                    .build()?;
            let _tray = TrayIconBuilder::new()
                .icon(
                    app.default_window_icon()
                        .expect("the app icon is configured")
                        .clone(),
                )
                .tooltip("Vortex Launcher")
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button,
                        button_state: MouseButtonState::Up,
                        rect,
                        ..
                    } = event
                    {
                        if matches!(button, MouseButton::Left | MouseButton::Right) {
                            tray::show_tray_popup(&tray.app_handle(), rect);
                        }
                    }
                })
                .build(app)?;
            let _ = APP_STARTED_AT.set(Instant::now());
            // Show the frameless Splash Screen immediately while the main
            // WebView finishes booting; `app_ready` swaps them seamlessly, with
            // a 4-second safety fallback so the user is never stuck.
            let _splash =
                WebviewWindowBuilder::new(app, "splash", WebviewUrl::App("splash.html".into()))
                    .title("Vortex Launcher")
                    .inner_size(360.0, 248.0)
                    .decorations(false)
                    .transparent(true)
                    .shadow(false)
                    .resizable(false)
                    .always_on_top(true)
                    .skip_taskbar(true)
                    .center()
                    .visible(true)
                    .build();
            let fallback_app = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(4000));
                reveal_main_window(&fallback_app);
            });
            std::thread::spawn(|| {
                std::thread::sleep(std::time::Duration::from_secs(2));
                updates::cleanup_updater_artifacts();
            });
            let update_app = app.handle().clone();
            let update_state = app.state::<Arc<AppState>>().inner().clone();
            tauri::async_runtime::spawn(async move {
                let _ = updates::run_update_check(update_app.clone(), update_state.clone()).await;
                let mut periodic = tokio::time::interval(std::time::Duration::from_secs(4 * 60 * 60));
                periodic.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
                periodic.tick().await;
                loop {
                    periodic.tick().await;
                    let should_recheck = {
                        let guard = state::lock_or_recover(&update_state.update_state);
                        !matches!(
                            guard.status.as_str(),
                            "available" | "downloading" | "downloaded" | "applying"
                        )
                    };
                    if should_recheck {
                        let _ = updates::run_update_check(
                            update_app.clone(),
                            update_state.clone(),
                        )
                        .await;
                    }
                }
            });
            tauri::async_runtime::spawn(async {
                tokio::time::sleep(std::time::Duration::from_secs(15)).await;
                cache::prune_expired_disk_cache().await;
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "tray" && matches!(event, WindowEvent::Focused(false)) {
                let _ = window.hide();
            }
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    if let Some(main) = window.app_handle().get_webview_window("main") {
                        save_window_state(&main);
                    }
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            app_ready,
            window_minimize,
            window_toggle_maximize,
            window_close,
            get_window_state,
            shell_open_external,
            games_search,
            games_details,
            autostart::windows_autostart_status,
            autostart::windows_autostart_set,
            game_servers::games_public_servers,
            game_servers::games_private_servers,
            game_servers::games_private_server_create,
            game_servers::games_private_server_get,
            game_servers::games_private_server_update,
            game_servers::games_private_server_permissions,
            game_servers::games_resolve_servers,
            game_servers::games_ping_regions,
            games_online,
            games_similar,
            games_featured,
            games_discover,
            games_paid,
            games_release_history,
            cache_set_disk_enabled,
            cache_disk_stats,
            cache_clear_disk,
            clear_search_cache,
            open_game,
            create_desktop_shortcut,
            share_files::save_share_file,
            launch_quick_game,
            tray::report_recent_games,
            tray::tray_get_state,
            tray::tray_fit_content,
            tray::tray_set_collapsed,
            tray::tray_open_app,
            tray::tray_dismiss,
            tray::tray_quit_app,
            tray::tray_launch_game,
            roblox_api_status,
            roblox_runtime_status,
            overlay::game_overlay_configure,
            overlay::game_overlay_ready,
            overlay::game_overlay_notify,
            overlay::copy_to_clipboard,
            overlay::roblox_toggle_mute,
            overlay::roblox_terminate_player,
            roblox_account,
            friends_detect_account,
            friends_list,
            friends_presence_status,
            friends_presence_cookie,
            import_legacy_local_storage,
            announcements_list,
            announcements::announcement_release_log,
            announcements::announcement_all_releases,
            plans_list,
            announcements_open,
            notifications_friend_playing,
            notifications_activity_break,
            discord_set_enabled,
            discord_set_client_id,
            discord_status,
            discord_set_activity,
            updates::updates_get_state,
            updates::updates_retry,
            updates::updates_download,
            updates::updates_install,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
