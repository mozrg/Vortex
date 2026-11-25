use crate::state::AppState;
use serde_json::{json, Value};
use std::time::Instant;
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize};

static MAIN_WINDOW_REVEALED: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);
static APP_STARTED_AT: std::sync::OnceLock<Instant> = std::sync::OnceLock::new();
static STARTUP_STAGE: std::sync::atomic::AtomicU8 = std::sync::atomic::AtomicU8::new(0);

pub fn mark_app_started() {
    let _ = APP_STARTED_AT.set(Instant::now());
}

fn publish_startup_stage(stage: u8) {
    STARTUP_STAGE.fetch_max(stage, std::sync::atomic::Ordering::AcqRel);
}

#[tauri::command]
pub fn startup_progress(window: tauri::WebviewWindow, stage: u8) {
    if window.label() == "main" && (1..=3).contains(&stage) {
        publish_startup_stage(stage);
    }
}

#[tauri::command]
pub fn splash_progress() -> u8 {
    STARTUP_STAGE.load(std::sync::atomic::Ordering::Acquire)
}

#[tauri::command]
pub async fn window_minimize(handle: AppHandle) {
    if let Some(window) = handle.get_webview_window("main") {
        let _ = window.minimize();
    }
}

#[tauri::command]
pub async fn window_toggle_maximize(handle: AppHandle) -> bool {
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
pub async fn window_close(handle: AppHandle) {
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

pub fn save_window_state<R: tauri::Runtime>(window: &tauri::WebviewWindow<R>) {
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

pub fn ensure_window_on_screen<R: tauri::Runtime>(window: &tauri::WebviewWindow<R>) {
    if !window_has_visible_position(window) {
        center_window(window);
    }
}

pub fn restore_window_geometry<R: tauri::Runtime>(window: &tauri::WebviewWindow<R>) {
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
pub async fn get_window_state(handle: AppHandle) -> serde_json::Value {
    if let Some(window) = handle.get_webview_window("main") {
        let is_maximized = window.is_maximized().unwrap_or(false);
        json!({"isMaximized": is_maximized})
    } else {
        json!({"isMaximized": false})
    }
}

pub fn reveal_main_window(app: &AppHandle) {
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
            if splash_progress() == 4 {
                std::thread::sleep(std::time::Duration::from_millis(220));
            }
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
pub fn app_ready(app: AppHandle) {
    publish_startup_stage(4);
    reveal_main_window(&app);
}

#[cfg(windows)]
pub struct SingleInstanceGuard(isize);

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
const SINGLE_INSTANCE_EVENT_NAME: &str = "Local\\VortexLauncherActivateEvent\0";

#[cfg(windows)]
pub fn acquire_single_instance() -> Option<SingleInstanceGuard> {
    const ERROR_ALREADY_EXISTS: u32 = 183;
    const EVENT_MODIFY_STATE: u32 = 0x0002;
    const ASFW_ANY: u32 = 0xFFFF_FFFF;
    const SW_SHOW: i32 = 5;
    const SW_RESTORE: i32 = 9;
    #[link(name = "kernel32")]
    extern "system" {
        fn CreateMutexW(
            attrs: *const std::ffi::c_void,
            initial_owner: i32,
            name: *const u16,
        ) -> isize;
        fn OpenEventW(desired_access: u32, inherit_handle: i32, name: *const u16) -> isize;
        fn SetEvent(event: isize) -> i32;
        fn GetLastError() -> u32;
        fn CloseHandle(object: isize) -> i32;
    }
    #[link(name = "user32")]
    extern "system" {
        fn AllowSetForegroundWindow(process_id: u32) -> i32;
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
            let _ = AllowSetForegroundWindow(ASFW_ANY);
            let event_name: Vec<u16> = SINGLE_INSTANCE_EVENT_NAME.encode_utf16().collect();
            let ev = OpenEventW(EVENT_MODIFY_STATE, 0, event_name.as_ptr());
            if ev != 0 {
                let _ = SetEvent(ev);
                let _ = CloseHandle(ev);
                return None;
            }
            // Fallback for older Vortex instances that don't expose the activation event.
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

#[cfg(windows)]
pub fn start_single_instance_activator(app: AppHandle) {
    const INFINITE: u32 = 0xFFFF_FFFF;
    const WAIT_OBJECT_0: u32 = 0;
    #[link(name = "kernel32")]
    extern "system" {
        fn CreateEventW(
            attrs: *const std::ffi::c_void,
            manual_reset: i32,
            initial_state: i32,
            name: *const u16,
        ) -> isize;
        fn WaitForSingleObject(handle: isize, milliseconds: u32) -> u32;
        fn CloseHandle(object: isize) -> i32;
    }

    std::thread::spawn(move || {
        let event_name: Vec<u16> = SINGLE_INSTANCE_EVENT_NAME.encode_utf16().collect();
        let ev = unsafe { CreateEventW(std::ptr::null(), 0, 0, event_name.as_ptr()) };
        if ev == 0 {
            return;
        }
        loop {
            let wait = unsafe { WaitForSingleObject(ev, INFINITE) };
            if wait != WAIT_OBJECT_0 {
                break;
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                ensure_window_on_screen(&window);
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        unsafe {
            let _ = CloseHandle(ev);
        }
    });
}
