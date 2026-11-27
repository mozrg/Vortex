#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod announcements;
mod autostart;
mod cache;
mod cookie;
mod discord;
mod friends;
mod game_servers;
mod games_catalog;
mod launch;
mod legacy_storage;
mod overlay;
mod overlay_audio;
mod overlay_fps;
mod overlay_ping;
mod plans;
mod roblox;
mod runtime;
mod share_files;
mod shortcut_icon;
mod state;
mod tray;
mod updates;
mod window_state;

pub(crate) use games_catalog::value_string;
pub(crate) use launch::{encode_query, open_url, valid_numeric_id};
pub(crate) use window_state::{ensure_window_on_screen, save_window_state};

use serde_json::{json, Value};
use state::AppState;
use std::sync::Arc;
use std::time::Instant;
use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};

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
    match target.as_str() {
        "" => {
            cache::clear_disk_cache("").await?;
            shortcut_icon::clear_shortcut_icons().await;
            Ok(true)
        }
        "thumbs" | "search" => {
            cache::clear_disk_cache(&target).await?;
            Ok(true)
        }
        "shortcuts" => {
            shortcut_icon::clear_shortcut_icons().await;
            Ok(true)
        }
        _ => Err("Invalid cache kind".to_string()),
    }
}

#[tauri::command]
async fn clear_search_cache(state: tauri::State<'_, Arc<AppState>>) -> Result<bool, String> {
    state::lock_or_recover(&state.response_cache).clear();
    Ok(true)
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
    discord::public_status(&state, enabled)
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
    let _single_instance = match window_state::acquire_single_instance() {
        Some(guard) => guard,
        None => return,
    };

    let app_state = Arc::new(AppState::new());

    // Load the stored cookie on startup.
    *state::lock_or_recover(&app_state.roblox_cookie) = cookie::load_cookie(None);

    tauri::Builder::default()
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
            #[cfg(windows)]
            window_state::start_single_instance_activator(app.handle().clone());
            // The tray WebView window is created lazily on the first tray icon click
            // inside `tray::show_tray_popup` to save ~40-70 MB of idle RAM at startup.
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
            window_state::mark_app_started();
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
                std::thread::sleep(std::time::Duration::from_secs(12));
                window_state::reveal_main_window(&fallback_app);
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
            window_state::app_ready,
            window_state::startup_progress,
            window_state::splash_progress,
            window_state::window_minimize,
            window_state::window_toggle_maximize,
            window_state::window_close,
            window_state::get_window_state,
            launch::shell_open_external,
            games_catalog::games_search,
            games_catalog::games_details,
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
            games_catalog::games_online,
            games_catalog::games_similar,
            games_catalog::games_featured,
            games_catalog::games_discover,
            games_catalog::games_paid,
            games_catalog::games_release_history,
            cache_set_disk_enabled,
            cache_disk_stats,
            cache_clear_disk,
            clear_search_cache,
            launch::open_game,
            launch::create_desktop_shortcut,
            share_files::save_share_file,
            launch::launch_quick_game,
            tray::report_recent_games,
            tray::tray_get_state,
            tray::tray_fit_content,
            tray::tray_set_collapsed,
            tray::tray_open_app,
            tray::tray_dismiss,
            tray::tray_quit_app,
            tray::tray_launch_game,
            roblox_api_status,
            games_catalog::roblox_runtime_status,
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
