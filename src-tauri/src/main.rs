#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod announcements;
mod cache;
mod cookie;
mod discord;
mod friends;
mod legacy_storage;
mod plans;
mod roblox;
mod state;

use serde_json::{json, Value};
use state::AppState;
use std::sync::Arc;
use std::time::Instant;
use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, WebviewUrl, WebviewWindowBuilder,
    WindowEvent,
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

fn compare_versions(left: &str, right: &str) -> std::cmp::Ordering {
    let numbers = |version: &str| {
        version
            .trim()
            .trim_start_matches(['v', 'V'])
            .split(['-', '+'])
            .next()
            .unwrap_or_default()
            .split('.')
            .map(|part| part.parse::<u64>().unwrap_or(0))
            .collect::<Vec<_>>()
    };
    let left = numbers(left);
    let right = numbers(right);
    for index in 0..left.len().max(right.len()) {
        let ordering = left
            .get(index)
            .copied()
            .unwrap_or(0)
            .cmp(&right.get(index).copied().unwrap_or(0));
        if ordering != std::cmp::Ordering::Equal {
            return ordering;
        }
    }
    std::cmp::Ordering::Equal
}

async fn run_update_check(app: AppHandle, state: Arc<AppState>) -> Result<(), String> {
    {
        let mut running = state
            .update_check_running
            .lock()
            .map_err(|_| "update state unavailable")?;
        if *running {
            return Ok(());
        }
        *running = true;
    }
    let checking = {
        let mut update = state
            .update_state
            .lock()
            .map_err(|_| "update state unavailable")?;
        update.status = "checking".to_string();
        update.progress = 0;
        update.error_message = None;
        update.clone()
    };
    let _ = app.emit("updates:state", checking.public());

    let result = async {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(8))
            .user_agent(concat!(
                "Vortex/",
                env!("CARGO_PKG_VERSION"),
                " (+https://github.com/mozrg/Vortex)"
            ))
            .build()
            .map_err(|error| error.to_string())?;
        let response = client
            .get("https://api.github.com/repos/mozrg/Vortex/releases/latest")
            .header("Accept", "application/vnd.github+json")
            .send()
            .await
            .map_err(|error| error.to_string())?;
        if !response.status().is_success() {
            return Err(format!("GitHub вернул HTTP {}", response.status().as_u16()));
        }
        let release: Value = response.json().await.map_err(|error| error.to_string())?;
        let version = release
            .get("tag_name")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|version| !version.is_empty())
            .ok_or_else(|| "В ответе GitHub нет версии релиза".to_string())?;
        let url = release
            .get("html_url")
            .and_then(Value::as_str)
            .filter(|url| url.starts_with("https://github.com/mozrg/Vortex/"))
            .map(str::to_owned);
        Ok::<_, String>((version.trim_start_matches(['v', 'V']).to_string(), url))
    }
    .await;

    let final_state = {
        let mut update = state
            .update_state
            .lock()
            .map_err(|_| "update state unavailable")?;
        update.progress = 100;
        update.stage = None;
        match result {
            Ok((latest, url)) => {
                update.status = if compare_versions(&update.current_version, &latest)
                    == std::cmp::Ordering::Less
                {
                    "available".to_string()
                } else {
                    "current".to_string()
                };
                update.latest_version = Some(latest);
                update.release_url = url;
                update.error_message = None;
            }
            Err(error) => {
                update.status = "error".to_string();
                update.progress = 0;
                update.error_message = Some(error.chars().take(240).collect());
            }
        }
        update.clone()
    };
    if let Ok(mut running) = state.update_check_running.lock() {
        *running = false;
    }
    let _ = app.emit("updates:state", final_state.public());
    Ok(())
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
        let _ = window.hide();
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
    if image_ids.is_empty() {
        return Vec::new();
    }

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

    entries
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
            let url = image_urls.get(&id)?;
            Some(json!({
                "type": "image",
                "url": url,
                "altText": item.get("altText").and_then(Value::as_str).unwrap_or("")
            }))
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
    _universe_id: String,
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
        .filter(|id| valid_numeric_id(id))
        .collect();
    Ok(roblox::get_game_details_by_universe(&*state, &ids).await)
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
    let payload = roblox::fetch_cached_json(&*state, &sort_url).await?;
    let rows = map_content_rows(&payload);
    let ids: Vec<String> = rows
        .iter()
        .map(|row| value_string(row.get("universeId").or_else(|| row.get("id"))))
        .filter(|id| valid_numeric_id(id))
        .collect();
    let mut items = roblox::get_game_details_by_universe(&*state, &ids).await;
    if items.is_empty() {
        items = map_game_rows(&rows);
    }
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
            let cache = state.paid_cache.lock().unwrap();
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
        let cache = state.paid_cache.lock().unwrap();
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
        let cache = state.paid_cache.lock().unwrap();
        games = cache.data.clone();
    }
    let mut cache = state.paid_cache.lock().unwrap();
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
    *state.disk_cache_enabled.lock().unwrap() = enabled;
    Ok(enabled)
}

#[tauri::command]
async fn cache_disk_stats(
    state: tauri::State<'_, Arc<AppState>>,
) -> Result<serde_json::Value, String> {
    let thumbs = cache::count_disk_cache("thumbs").await;
    let search = cache::count_disk_cache("search").await;
    Ok(json!({"thumbnails": thumbs, "search": search}))
}

#[tauri::command]
async fn cache_clear_disk(
    state: tauri::State<'_, Arc<AppState>>,
    kind: Option<String>,
) -> Result<bool, String> {
    cache::clear_disk_cache(&kind.unwrap_or_default()).await;
    Ok(true)
}

#[tauri::command]
async fn clear_search_cache(state: tauri::State<'_, Arc<AppState>>) -> Result<bool, String> {
    state.response_cache.lock().unwrap().clear();
    Ok(true)
}

#[tauri::command]
async fn open_game(
    place_id: String,
    game_id: Option<String>,
    access_code: Option<String>,
) -> Result<String, String> {
    if !valid_numeric_id(&place_id) {
        return Err("invalid place id".to_string());
    }
    let mut url = format!("roblox://placeId={}", place_id);
    if let Some(server) = game_id.filter(|id| !id.is_empty()) {
        if server.len() <= 64
            && server
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || "-".contains(c))
        {
            url.push_str("&gameInstanceId=");
            url.push_str(&server);
        }
    }
    if let Some(code) = access_code.filter(|code| !code.is_empty()) {
        if code.len() <= 100 && code.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
            url.push_str("&accessCode=");
            url.push_str(&code);
        }
    }
    match open_url(&url) {
        Ok(()) => Ok("roblox".to_string()),
        Err(_) => {
            let browser = format!("https://www.roblox.com/games/start?placeId={}", place_id);
            open_url(&browser).map_err(|e| format!("failed to launch Roblox: {}", e))?;
            Ok("browser".to_string())
        }
    }
}

#[tauri::command]
async fn launch_quick_game(
    method: String,
    place_id: Option<String>,
    link_code: Option<String>,
    share_code: Option<String>,
    share_type: Option<String>,
) -> Result<String, String> {
    let place = place_id.unwrap_or_default();
    let (deep_link, browser_url) = match method.as_str() {
        // Roblox deep links use `placeId` and `linkCode` parameters.
        "private" => {
            let code = link_code.unwrap_or_default();
            if !valid_numeric_id(&place) || !valid_quick_code(&code, 100) {
                return Err("invalid private server link".to_string());
            }
            (
                format!(
                    "roblox://placeId={}&linkCode={}",
                    place,
                    encode_query(&code)
                ),
                format!(
                    "https://www.roblox.com/games/start?placeId={}&linkCode={}",
                    place,
                    encode_query(&code)
                ),
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
                format!("roblox://placeId={}", place),
                format!("https://www.roblox.com/games/{}", place),
            )
        }
        _ => return Err("unsupported quick launch method".to_string()),
    };

    match open_url(&deep_link) {
        Ok(()) => Ok("roblox".to_string()),
        Err(_) => {
            open_url(&browser_url).map_err(|e| format!("failed to launch Roblox: {}", e))?;
            Ok("browser".to_string())
        }
    }
}

#[tauri::command]
async fn report_recent_games(
    app: AppHandle,
    state: tauri::State<'_, Arc<AppState>>,
    payload: serde_json::Value,
) -> Result<(), String> {
    let favorites = payload
        .get("favorites")
        .cloned()
        .unwrap_or_else(|| json!([]));
    let quick_launch = payload
        .get("quickLaunch")
        .cloned()
        .unwrap_or_else(|| json!([]));
    let now_playing = payload.get("nowPlaying").cloned().unwrap_or(Value::Null);
    let style = payload.get("style").cloned().unwrap_or_else(|| json!({}));
    let tray_json = {
        let mut tray = state
            .tray
            .lock()
            .map_err(|_| "tray state unavailable".to_string())?;
        tray.favorites = serde_json::from_value(favorites).unwrap_or_default();
        tray.quick_launch = serde_json::from_value(quick_launch).unwrap_or_default();
        tray.now_playing = if now_playing.is_null() {
            None
        } else {
            serde_json::from_value(now_playing).ok()
        };
        tray.style = serde_json::from_value(style).unwrap_or_default();
        json!({
            "favorites": tray.favorites,
            "quickLaunch": tray.quick_launch,
            "nowPlaying": tray.now_playing,
            "style": tray.style
        })
    };
    let tray_scale = tray_json
        .get("style")
        .and_then(|style| style.get("trayScale"))
        .and_then(Value::as_str)
        .unwrap_or("normal");
    let favorites_count = tray_json
        .get("favorites")
        .and_then(Value::as_array)
        .map_or(0, Vec::len);
    let quick_count = tray_json
        .get("quickLaunch")
        .and_then(Value::as_array)
        .map_or(0, Vec::len);
    let now_playing = tray_json
        .get("nowPlaying")
        .is_some_and(|value| !value.is_null());
    let (width, height) =
        tray_window_dimensions(tray_scale, favorites_count, quick_count, now_playing);
    if let Some(window) = app.get_webview_window("tray") {
        let _ = window.set_size(LogicalSize::new(width, height));
    }
    let _ = app.emit_to("tray", "tray:updated", tray_json);
    Ok(())
}

fn tray_window_dimensions(
    scale: &str,
    favorites: usize,
    quick_launch: usize,
    now_playing: bool,
) -> (f64, f64) {
    let (width, factor) = match scale {
        "compact" => (310.0, 0.82),
        "large" => (370.0, 1.0),
        _ => (338.0, 0.9),
    };
    // The UI renders one placeholder row for each empty section. Match its
    // intrinsic content height so the transparent popup never has a blank tail.
    let favorite_rows = favorites.clamp(0, 5).max(1) as f64;
    let quick_rows = quick_launch.clamp(0, 3).max(1) as f64;
    let row_height = favorite_rows * if favorites == 0 { 39.0 } else { 39.0 * factor }
        + quick_rows
            * if quick_launch == 0 {
                39.0
            } else {
                39.0 * factor
            };
    let height = 133.0 + row_height + if now_playing { 40.0 } else { 0.0 };
    (width, height.ceil())
}

#[tauri::command]
async fn tray_get_state(
    state: tauri::State<'_, Arc<AppState>>,
) -> Result<serde_json::Value, String> {
    let tray = state
        .tray
        .lock()
        .map_err(|_| "tray state unavailable".to_string())?;
    Ok(json!({
        "favorites": tray.favorites,
        "quickLaunch": tray.quick_launch,
        "nowPlaying": tray.now_playing,
        "style": tray.style
    }))
}

#[tauri::command]
async fn tray_fit_content(window: tauri::WebviewWindow, height: f64) -> Result<(), String> {
    let width = window
        .inner_size()
        .map_err(|error| error.to_string())?
        .to_logical::<f64>(window.scale_factor().unwrap_or(1.0))
        .width;
    window
        .set_size(LogicalSize::new(width, height.clamp(160.0, 680.0)))
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn tray_open_app(app: AppHandle) -> Result<(), String> {
    if let Some(tray_window) = app.get_webview_window("tray") {
        let _ = tray_window.hide();
    }
    if let Some(window) = app.get_webview_window("main") {
        window.unminimize().map_err(|error| error.to_string())?;
        window.show().map_err(|error| error.to_string())?;
        window.set_focus().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn tray_dismiss(app: AppHandle) {
    if let Some(window) = app.get_webview_window("tray") {
        let _ = window.hide();
    }
}

#[tauri::command]
async fn tray_quit_app(app: AppHandle) {
    app.exit(0);
}

#[tauri::command]
async fn tray_launch_game(app: AppHandle, kind: String, id: String) -> Result<(), String> {
    if !matches!(kind.as_str(), "favorite" | "quick") || id.is_empty() || id.len() > 64 {
        return Err("invalid tray shortcut".to_string());
    }
    app.emit_to("main", "tray:launch", json!({ "kind": kind, "id": id }))
        .map_err(|error| error.to_string())
}

fn show_tray_popup(app: &AppHandle, rect: tauri::Rect) {
    let Some(window) = app.get_webview_window("tray") else {
        return;
    };
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
        return;
    }

    let scale = window.scale_factor().unwrap_or(1.0);
    let current_size = window.inner_size().ok();
    let width = current_size
        .map(|size| size.width as f64)
        .unwrap_or(338.0 * scale);
    let height = current_size
        .map(|size| size.height as f64)
        .unwrap_or(470.0 * scale);
    let icon_position = rect.position.to_physical::<f64>(1.0);
    let icon_size = rect.size.to_physical::<f64>(1.0);
    let icon_x = icon_position.x;
    let icon_y = icon_position.y;
    let icon_width = icon_size.width;
    let icon_height = icon_size.height;
    let monitor = window
        .monitor_from_point(icon_x + icon_width / 2.0, icon_y + icon_height / 2.0)
        .ok()
        .flatten();
    let (monitor_x, monitor_y, monitor_width, monitor_height) = monitor
        .map(|monitor| {
            let position = monitor.position();
            let size = monitor.size();
            (
                position.x as f64,
                position.y as f64,
                size.width as f64,
                size.height as f64,
            )
        })
        .unwrap_or((0.0, 0.0, 1920.0, 1080.0));
    let x = (icon_x + icon_width - width - 8.0).clamp(
        monitor_x,
        (monitor_x + monitor_width - width).max(monitor_x),
    );
    let above = icon_y - height - 8.0;
    let below = icon_y + icon_height + 8.0;
    let y = if above >= monitor_y {
        above
    } else if below + height <= monitor_y + monitor_height {
        below
    } else {
        (monitor_y + monitor_height - height).max(monitor_y)
    };

    let _ = window.set_position(PhysicalPosition::new(x.round() as i32, y.round() as i32));
    let _ = window.show();
    let _ = window.set_focus();
    let _ = app.emit_to("tray", "tray:opened", ());
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
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .user_agent("Vortex-Place-Launcher")
        .build()
        .map_err(|e| e.to_string())?;
    let mut services = Vec::new();
    for (id, url) in checks {
        let started = Instant::now();
        let ok = client
            .get(url)
            .send()
            .await
            .map(|response| response.status().is_success())
            .unwrap_or(false);
        services.push(json!({"id": id, "ok": ok, "ms": started.elapsed().as_millis()}));
    }
    Ok(json!({"checkedAt": chrono::Utc::now().to_rfc3339(), "services": services}))
}

#[tauri::command]
async fn import_legacy_local_storage() -> Result<legacy_storage::LegacyStorageImport, String> {
    legacy_storage::import_legacy_local_storage()
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
    let cookie = state.roblox_cookie.lock().unwrap().clone();
    let mut list = match friends::fetch_roblox_friends(&*state, &user_id, &cookie).await {
        Ok(list) => list,
        Err(error) => {
            let code = if error.contains("403") && cookie.is_empty() {
                "auth-required"
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
    let names = friends::fetch_roblox_user_names(&missing_name_ids).await;
    let avatars = friends::fetch_roblox_user_thumbnails(&*state, &ids).await;
    let presences = friends::fetch_roblox_presence(&ids, &cookie).await;
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
                    if let Some(place) = p.get("placeId") {
                        obj.insert("placeId".to_string(), json!(value_string(Some(place))));
                    }
                    if let Some(game) = p.get("gameId") {
                        obj.insert("gameId".to_string(), json!(value_string(Some(game))));
                    }
                    if let Some(name) = p.get("lastLocation").or_else(|| p.get("gameName")) {
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

#[tauri::command]
async fn friends_presence_status(
    state: tauri::State<'_, Arc<AppState>>,
) -> Result<serde_json::Value, String> {
    let cookie = state.roblox_cookie.lock().unwrap();
    Ok(json!({"enabled": !cookie.is_empty()}))
}

#[tauri::command]
async fn friends_presence_cookie(
    state: tauri::State<'_, Arc<AppState>>,
    cookie: Option<String>,
    remove: Option<bool>,
) -> Result<serde_json::Value, String> {
    if remove.unwrap_or(false) {
        cookie::save_cookie("");
        *state.roblox_cookie.lock().unwrap() = String::new();
        Ok(json!({"ok": true, "enabled": false}))
    } else if let Some(c) = cookie {
        if c.len() < 100 || c.len() > 2200 || c.contains(' ') || c.contains('"') || c.contains('\'')
        {
            return Ok(json!({"ok": false, "error": "invalid"}));
        }
        if cookie::save_cookie(&c) {
            *state.roblox_cookie.lock().unwrap() = c;
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
async fn notifications_friend_playing(_friend: String, _game: String) -> Result<bool, String> {
    Ok(false)
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
            .clone()
            .map(|value| json!({"details": value.details, "state": value.state}))
    };
    if enabled {
        let _ = discord::send_activity(&state, true, activity, false).await;
    } else {
        let _ = discord::send_activity(&state, false, None, false).await;
    }
    discord::public_status(&state, enabled)
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
                .map(|value| json!({"details": value.details, "state": value.state}))
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
    let enabled = {
        let mut discord = state
            .discord
            .lock()
            .map_err(|_| "Discord state unavailable".to_string())?;
        discord.activity = activity
            .as_ref()
            .map(|value| crate::state::DiscordActivity {
                details: value
                    .get("details")
                    .and_then(Value::as_str)
                    .map(|text| text.chars().take(128).collect()),
                state: value
                    .get("state")
                    .and_then(Value::as_str)
                    .map(|text| text.chars().take(128).collect()),
            });
        discord.enabled
    };
    if enabled {
        let _ = discord::send_activity(&state, true, activity, true).await;
    }
    discord::public_status(&state, true)
}

#[tauri::command]
async fn updates_get_state(
    state: tauri::State<'_, Arc<AppState>>,
) -> Result<serde_json::Value, String> {
    let update_state = state.update_state.lock().unwrap();
    Ok(update_state.public())
}

#[tauri::command]
async fn updates_retry(
    app: AppHandle,
    state: tauri::State<'_, Arc<AppState>>,
) -> Result<(), String> {
    run_update_check(app, state.inner().clone()).await
}

fn main() {
    let app_state = Arc::new(AppState::new());

    // Load the stored cookie on startup.
    *app_state.roblox_cookie.lock().unwrap() = cookie::load_cookie();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .manage(app_state)
        .setup(|app| {
            let state = app.state::<Arc<AppState>>().inner().clone();
            let (discord_tx, discord_rx) = tokio::sync::mpsc::unbounded_channel();
            *state.discord_commands.lock().unwrap() = Some(discord_tx);
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
                            show_tray_popup(&tray.app_handle(), rect);
                        }
                    }
                })
                .build(app)?;
            // The window is declared with `visible: false` so the user never sees
            // a white flash; show it once the webview has had time to paint.
            let window = app
                .get_webview_window("main")
                .expect("the main window is declared in tauri.conf.json");
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(400));
                let _ = window.show();
                let _ = window.set_focus();
            });
            let update_app = app.handle().clone();
            let update_state = app.state::<Arc<AppState>>().inner().clone();
            tauri::async_runtime::spawn(async move {
                let _ = run_update_check(update_app, update_state).await;
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
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            window_minimize,
            window_toggle_maximize,
            window_close,
            get_window_state,
            shell_open_external,
            games_search,
            games_details,
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
            launch_quick_game,
            report_recent_games,
            tray_get_state,
            tray_fit_content,
            tray_open_app,
            tray_dismiss,
            tray_quit_app,
            tray_launch_game,
            roblox_api_status,
            friends_detect_account,
            friends_list,
            friends_presence_status,
            friends_presence_cookie,
            import_legacy_local_storage,
            announcements_list,
            plans_list,
            announcements_open,
            notifications_friend_playing,
            discord_set_enabled,
            discord_status,
            discord_set_activity,
            updates_get_state,
            updates_retry,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
