use crate::state::AppState;
use serde_json::{json, Value};
use std::sync::Arc;
use tauri::{
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};

#[tauri::command]
pub async fn report_recent_games(
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
    let (favorites_collapsed, quick_collapsed) = state
        .tray_collapsed
        .lock()
        .map(|collapsed| *collapsed)
        .unwrap_or((false, false));
    let (width, height) = tray_window_dimensions(
        tray_scale,
        favorites_count,
        quick_count,
        now_playing,
        favorites_collapsed,
        quick_collapsed,
    );
    if let Some(window) = app.get_webview_window("tray") {
        let _ = window.set_size(LogicalSize::new(width, height));
        if window.is_visible().unwrap_or(false) {
            position_tray_window(&app, width, height);
        }
        let _ = app.emit_to("tray", "tray:updated", tray_json);
    }
    Ok(())
}

fn tray_window_dimensions(
    scale: &str,
    favorites: usize,
    quick_launch: usize,
    now_playing: bool,
    favorites_collapsed: bool,
    quick_collapsed: bool,
) -> (f64, f64) {
    let (width, factor) = match scale {
        "compact" => (310.0, 0.82),
        "large" => (370.0, 1.0),
        _ => (338.0, 0.9),
    };
    let list_height = |count: usize, cap: usize, collapsed: bool| {
        if collapsed {
            return 0.0;
        }
        if count == 0 {
            return 39.0;
        }
        if count > cap {
            return cap as f64 * 39.0 * factor + if cap == 8 { 28.0 } else { 20.0 };
        }
        let row = (39.0 * factor).max(30.0 * factor + 8.0);
        count as f64 * row + count.saturating_sub(1) as f64 * 4.0
    };
    let mut height = 209.0 + if now_playing { 41.0 } else { 0.0 };
    height += list_height(favorites, 8, favorites_collapsed);
    height += list_height(quick_launch, 6, quick_collapsed);
    (width, height.ceil() + 3.0)
}

fn position_tray_window(app: &AppHandle, logical_width: f64, logical_height: f64) {
    let Some(window) = app.get_webview_window("tray") else {
        return;
    };
    let scale = window.scale_factor().unwrap_or(1.0);
    let width = logical_width * scale;
    let height = logical_height * scale;
    let state = app.state::<Arc<AppState>>();
    let anchor = state.tray_anchor.lock().ok().and_then(|anchor| *anchor);
    let Some((icon_x, icon_y, icon_width, icon_height)) = anchor else {
        return;
    };
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
}

#[tauri::command]
pub async fn tray_get_state(
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
pub async fn tray_set_collapsed(
    app: AppHandle,
    state: tauri::State<'_, Arc<AppState>>,
    favorites: bool,
    quick: bool,
) -> Result<(), String> {
    if let Ok(mut collapsed) = state.tray_collapsed.lock() {
        *collapsed = (favorites, quick);
    }
    let Some(window) = app.get_webview_window("tray") else {
        return Ok(());
    };
    let (tray_scale, favorites_count, quick_count, now_playing) = state
        .tray
        .lock()
        .map(|tray| {
            (
                tray.style.tray_scale.clone(),
                tray.favorites.len(),
                tray.quick_launch.len(),
                tray.now_playing.is_some(),
            )
        })
        .unwrap_or(("normal".to_string(), 0, 0, false));
    let (width, height) = tray_window_dimensions(
        &tray_scale,
        favorites_count,
        quick_count,
        now_playing,
        favorites,
        quick,
    );
    window
        .set_size(LogicalSize::new(width, height))
        .map_err(|error| error.to_string())?;
    if window.is_visible().unwrap_or(false) {
        position_tray_window(&app, width, height);
    }
    Ok(())
}

#[tauri::command]
pub async fn tray_fit_content(app: AppHandle, height: f64) -> Result<(), String> {
    let window = app
        .get_webview_window("tray")
        .ok_or_else(|| "tray window unavailable".to_string())?;
    if window.is_visible().unwrap_or(false) {
        return Ok(());
    }
    let width = window
        .inner_size()
        .map_err(|error| error.to_string())?
        .to_logical::<f64>(window.scale_factor().unwrap_or(1.0))
        .width;
    let height = height.clamp(120.0, 680.0);
    window
        .set_size(LogicalSize::new(width, height))
        .map_err(|error| error.to_string())?;
    position_tray_window(&app, width, height);
    Ok(())
}

#[tauri::command]
pub async fn tray_open_app(app: AppHandle) -> Result<(), String> {
    if let Some(tray_window) = app.get_webview_window("tray") {
        let _ = tray_window.hide();
    }
    if let Some(window) = app.get_webview_window("main") {
        window.unminimize().map_err(|error| error.to_string())?;
        crate::ensure_window_on_screen(&window);
        window.show().map_err(|error| error.to_string())?;
        window.set_focus().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn tray_dismiss(app: AppHandle) {
    if let Some(window) = app.get_webview_window("tray") {
        let _ = window.hide();
    }
}

#[tauri::command]
pub async fn tray_quit_app(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        crate::save_window_state(&window);
    }
    app.exit(0);
}

#[tauri::command]
pub async fn tray_launch_game(app: AppHandle, kind: String, id: String) -> Result<(), String> {
    if !matches!(
        kind.as_str(),
        "favorite" | "quick" | "session-invite" | "session-hop" | "session-rejoin" | "session-mute"
    ) || id.len() > 64
        || (matches!(kind.as_str(), "favorite" | "quick") && id.is_empty())
    {
        return Err("invalid tray shortcut".to_string());
    }
    app.emit_to("main", "tray:launch", json!({ "kind": kind, "id": id }))
        .map_err(|error| error.to_string())
}

fn ensure_tray_window(app: &AppHandle, width: f64, height: f64) -> Option<WebviewWindow> {
    if let Some(window) = app.get_webview_window("tray") {
        return Some(window);
    }
    WebviewWindowBuilder::new(app, "tray", WebviewUrl::App("tray.html".into()))
        .title("Vortex Quick Access")
        .inner_size(width, height)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .resizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        .focused(true)
        .build()
        .ok()
}

pub fn show_tray_popup(app: &AppHandle, rect: tauri::Rect) {
    if let Some(existing) = app.get_webview_window("tray") {
        if existing.is_visible().unwrap_or(false) {
            let _ = existing.hide();
            return;
        }
    }

    let icon_position = rect.position.to_physical::<f64>(1.0);
    let icon_size = rect.size.to_physical::<f64>(1.0);
    let icon_x = icon_position.x;
    let icon_y = icon_position.y;
    let icon_width = icon_size.width;
    let icon_height = icon_size.height;
    let state = app.state::<Arc<AppState>>();
    if let Ok(mut anchor) = state.tray_anchor.lock() {
        *anchor = Some((icon_x, icon_y, icon_width, icon_height));
    }
    let (tray_scale, favorites_count, quick_count, now_playing) = state
        .tray
        .lock()
        .map(|tray| {
            (
                tray.style.tray_scale.clone(),
                tray.favorites.len(),
                tray.quick_launch.len(),
                tray.now_playing.is_some(),
            )
        })
        .unwrap_or(("normal".to_string(), 0, 0, false));
    let (favorites_collapsed, quick_collapsed) = state
        .tray_collapsed
        .lock()
        .map(|collapsed| *collapsed)
        .unwrap_or((false, false));
    let (width, height) = tray_window_dimensions(
        &tray_scale,
        favorites_count,
        quick_count,
        now_playing,
        favorites_collapsed,
        quick_collapsed,
    );
    let Some(window) = ensure_tray_window(app, width, height) else {
        return;
    };
    let _ = window.set_size(LogicalSize::new(width, height));
    position_tray_window(app, width, height);
    let _ = window.show();
    let _ = window.set_focus();
    let _ = app.emit_to("tray", "tray:opened", ());
}
