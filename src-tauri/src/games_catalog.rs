use crate::cache;
use crate::launch::{encode_query, valid_numeric_id, valid_quick_code};
use crate::roblox;
use crate::runtime;
use crate::state::{self, AppState};
use serde_json::{json, Value};
use std::sync::Arc;
use std::time::Instant;
use uuid::Uuid;

pub fn value_string(value: Option<&Value>) -> String {
    value
        .and_then(|v| {
            v.as_str()
                .map(str::to_owned)
                .or_else(|| v.as_u64().map(|n| n.to_string()))
        })
        .unwrap_or_default()
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
pub async fn games_search(
    state: tauri::State<'_, Arc<AppState>>,
    query: String,
    session_id: Option<String>,
    page_token: Option<String>,
) -> Result<serde_json::Value, String> {
    let query = query.trim();
    if query.is_empty() || query.len() > 100 {
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

    entries
        .iter()
        .filter(|item| item.get("approved").and_then(Value::as_bool) == Some(true))
        .filter_map(|item| {
            let kind = item.get("assetType")?.as_str()?;
            let caption = item.get("altText").and_then(Value::as_str).unwrap_or("");
            if kind.eq_ignore_ascii_case("image") {
                let id = value_string(item.get("imageId"));
                return Some(
                    json!({"type": "image", "url": image_urls.get(&id)?, "altText": caption}),
                );
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
pub async fn games_details(
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
    if let Ok(payload) = roblox::fetch_cached_json(
        &*state,
        &format!(
            "https://thumbnails.roblox.com/v1/games/icons?universeIds={}&size=512x512&format=Png&isCircular=false",
            universe
        ),
    )
    .await
    {
        if let Some(url) = payload
            .get("data")
            .and_then(Value::as_array)
            .and_then(|a| a.first())
            .and_then(|v| v.get("imageUrl"))
            .and_then(Value::as_str)
        {
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
pub async fn games_similar(
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
pub async fn games_online(
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
pub async fn roblox_runtime_status() -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(runtime::status)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn games_featured(
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
pub async fn games_discover(
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
pub async fn games_paid(
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
pub async fn games_release_history(
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
