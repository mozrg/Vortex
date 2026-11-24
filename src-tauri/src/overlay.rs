use crate::overlay_fps::{Capture, Fps};
use crate::overlay_ping::{Ping, PingSnapshot, Probe};
use serde::{Deserialize, Serialize};
use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};
use tauri::{AppHandle, Emitter, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use windows::Win32::{
    Foundation::{HWND, POINT, RECT},
    Graphics::Gdi::{
        ClientToScreen, GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST,
    },
    UI::{
        HiDpi::GetDpiForWindow,
        WindowsAndMessaging::{
            GetClientRect, GetForegroundWindow, GetWindowThreadProcessId, IsIconic, SetWindowPos,
            HWND_TOPMOST, SWP_ASYNCWINDOWPOS, SWP_HIDEWINDOW, SWP_NOACTIVATE, SWP_NOMOVE,
            SWP_NOOWNERZORDER, SWP_NOSIZE, SWP_NOZORDER, SWP_SHOWWINDOW,
        },
    },
};

const LABEL: &str = "game-overlay";
const HEIGHT: i32 = 26;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "kebab-case")]
enum Corner {
    TopLeft,
    TopCenter,
    #[default]
    TopRight,
    BottomLeft,
    BottomCenter,
    BottomRight,
    Custom,
}

#[derive(Clone, Copy, Debug)]
struct LayoutSpec {
    corner: Corner,
    custom_x: i32,
    custom_y: i32,
    scale: i32,
    gap: i32,
    vertical: bool,
}

impl Default for LayoutSpec {
    fn default() -> Self {
        Self {
            corner: Corner::TopRight,
            custom_x: 96,
            custom_y: 4,
            scale: 100,
            gap: 5,
            vertical: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn positions_overlay_inside_all_corners_and_custom_coordinates() {
        let rect = RECT {
            left: -1000,
            top: -200,
            right: 200,
            bottom: 500,
        };
        for (corner, x, y) in [
            (Corner::TopLeft, -976, -176),
            (Corner::TopRight, -310, -176),
            (Corner::BottomLeft, -976, 437),
            (Corner::BottomRight, -310, 437),
        ] {
            assert_eq!(
                position(rect, 144, corner, 3),
                Some(Placement {
                    x,
                    y,
                    width: 486,
                    height: 39
                })
            );
        }
        let custom = position_with_spec(
            rect,
            96,
            LayoutSpec {
                corner: Corner::Custom,
                custom_x: 50,
                custom_y: 50,
                scale: 120,
                gap: 8,
                vertical: false,
            },
            3,
        );
        assert!(custom.is_some());
        assert!(position(
            RECT {
                right: -900,
                ..rect
            },
            144,
            Corner::TopLeft,
            3
        )
        .is_none());
    }

    #[test]
    fn rejects_the_launcher_as_a_game_target() {
        assert!(!crate::runtime::is_player_pid(std::process::id()));
    }

    #[test]
    fn parses_hotkeys_and_formats_server_invite_urls() {
        assert_eq!(
            Hotkey::parse("Alt+C"),
            Some(Hotkey {
                ctrl: false,
                alt: true,
                shift: false,
                vkey: 0x43
            })
        );
        assert_eq!(
            Hotkey::parse("ctrl + shift + f8"),
            Some(Hotkey {
                ctrl: true,
                alt: false,
                shift: true,
                vkey: 0x77
            })
        );
        assert_eq!(Hotkey::parse(""), None);
        assert_eq!(Hotkey::parse("Alt+"), None);
        assert_eq!(
            invite_url(
                "8304191830",
                Some("1003496f-b5f0-416a-ad22-f03f6056de76")
            ),
            Some("https://www.roblox.com/games/start?placeId=8304191830&gameInstanceId=1003496f-b5f0-416a-ad22-f03f6056de76".into())
        );
        assert_eq!(
            invite_url("8304191830", None),
            Some("https://www.roblox.com/games/start?placeId=8304191830".into())
        );
        assert_eq!(invite_url("invalid", None), None);
    }
}

#[link(name = "user32")]
extern "system" {
    fn OpenClipboard(hwnd: isize) -> i32;
    fn EmptyClipboard() -> i32;
    fn SetClipboardData(format: u32, mem: isize) -> isize;
    fn CloseClipboard() -> i32;
    fn GetAsyncKeyState(vkey: i32) -> i16;
}

#[repr(C)]
#[derive(Default)]
struct ProcessMemoryCounters {
    cb: u32,
    page_fault_count: u32,
    peak_working_set_size: usize,
    working_set_size: usize,
    quota_peak_paged_pool_usage: usize,
    quota_paged_pool_usage: usize,
    quota_peak_non_paged_pool_usage: usize,
    quota_non_paged_pool_usage: usize,
    pagefile_usage: usize,
    peak_pagefile_usage: usize,
}

#[link(name = "kernel32")]
extern "system" {
    fn GlobalAlloc(flags: u32, bytes: usize) -> isize;
    fn GlobalLock(mem: isize) -> *mut u16;
    fn GlobalUnlock(mem: isize) -> i32;
    fn GlobalFree(mem: isize) -> isize;
    fn OpenProcess(desired_access: u32, inherit_handle: i32, process_id: u32) -> isize;
    fn CloseHandle(object: isize) -> i32;
    fn K32GetProcessMemoryInfo(
        process: isize,
        ppsmemcounters: *mut ProcessMemoryCounters,
        cb: u32,
    ) -> i32;
    fn GetProcessTimes(
        process: isize,
        creation_time: *mut u64,
        exit_time: *mut u64,
        kernel_time: *mut u64,
        user_time: *mut u64,
    ) -> i32;
    fn GetSystemTimes(idle_time: *mut u64, kernel_time: *mut u64, user_time: *mut u64) -> i32;
}

const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;

#[derive(Default)]
struct ProcessPerfTracker {
    pid: u32,
    last_sampled: Option<std::time::Instant>,
    prev_proc_ticks: u64,
    prev_sys_ticks: u64,
    ram_mb: Option<u32>,
    cpu_percent: Option<u32>,
}

impl ProcessPerfTracker {
    fn sample(&mut self, pid: u32) -> (Option<u32>, Option<u32>) {
        if pid == 0 {
            *self = Self::default();
            return (None, None);
        }
        if self.pid != pid {
            *self = Self {
                pid,
                ..Self::default()
            };
        }
        if self
            .last_sampled
            .is_some_and(|at| at.elapsed() < Duration::from_millis(950))
        {
            return (self.ram_mb, self.cpu_percent);
        }
        self.last_sampled = Some(std::time::Instant::now());
        unsafe {
            let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if handle == 0 {
                return (self.ram_mb, self.cpu_percent);
            }
            let mut pmc = ProcessMemoryCounters {
                cb: std::mem::size_of::<ProcessMemoryCounters>() as u32,
                ..Default::default()
            };
            if K32GetProcessMemoryInfo(handle, &mut pmc, pmc.cb) != 0 && pmc.working_set_size > 0 {
                self.ram_mb = Some((pmc.working_set_size / (1024 * 1024)) as u32);
            }
            let (mut c, mut e, mut pk, mut pu) = (0_u64, 0_u64, 0_u64, 0_u64);
            let (mut idle, mut sk, mut su) = (0_u64, 0_u64, 0_u64);
            if GetProcessTimes(handle, &mut c, &mut e, &mut pk, &mut pu) != 0
                && GetSystemTimes(&mut idle, &mut sk, &mut su) != 0
            {
                let proc_total = pk.saturating_add(pu);
                let sys_total = sk.saturating_add(su);
                if self.prev_sys_ticks > 0 && sys_total > self.prev_sys_ticks {
                    let proc_delta = proc_total.saturating_sub(self.prev_proc_ticks);
                    let sys_delta = sys_total.saturating_sub(self.prev_sys_ticks);
                    let pct = ((proc_delta.saturating_mul(100)) / sys_delta).min(100) as u32;
                    self.cpu_percent = Some(pct);
                } else if self.cpu_percent.is_none() {
                    self.cpu_percent = Some(0);
                }
                self.prev_proc_ticks = proc_total;
                self.prev_sys_ticks = sys_total;
            }
            let _ = CloseHandle(handle);
        }
        (self.ram_mb, self.cpu_percent)
    }
}

const CF_UNICODETEXT: u32 = 13;
const GMEM_MOVEABLE: u32 = 0x0002;
const VK_SHIFT: i32 = 0x10;
const VK_CONTROL: i32 = 0x11;
const VK_MENU: i32 = 0x12;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct Hotkey {
    ctrl: bool,
    alt: bool,
    shift: bool,
    vkey: i32,
}

impl Hotkey {
    fn parse(spec: &str) -> Option<Self> {
        let mut ctrl = false;
        let mut alt = false;
        let mut shift = false;
        let mut vkey = None;
        for raw in spec.split('+') {
            let token = raw.trim();
            if token.is_empty() {
                return None;
            }
            if token.eq_ignore_ascii_case("ctrl") || token.eq_ignore_ascii_case("control") {
                ctrl = true;
            } else if token.eq_ignore_ascii_case("alt") {
                alt = true;
            } else if token.eq_ignore_ascii_case("shift") {
                shift = true;
            } else if vkey.is_none() {
                vkey = parse_vkey(token);
                vkey?;
            } else {
                return None;
            }
        }
        Some(Self {
            ctrl,
            alt,
            shift,
            vkey: vkey?,
        })
    }

    fn is_down(&self) -> bool {
        let down = |vk: i32| unsafe { (GetAsyncKeyState(vk) as u16 & 0x8000) != 0 };
        down(self.vkey)
            && down(VK_CONTROL) == self.ctrl
            && down(VK_MENU) == self.alt
            && down(VK_SHIFT) == self.shift
    }
}

fn parse_vkey(token: &str) -> Option<i32> {
    let bytes = token.as_bytes();
    if bytes.len() == 1 {
        let ch = bytes[0].to_ascii_uppercase();
        if ch.is_ascii_uppercase() || ch.is_ascii_digit() {
            return Some(i32::from(ch));
        }
    }
    let upper = token.to_ascii_uppercase();
    if let Some(num) = upper.strip_prefix("KEY") {
        if num.len() == 1 && num.as_bytes()[0].is_ascii_uppercase() {
            return Some(i32::from(num.as_bytes()[0]));
        }
    }
    if let Some(num) = upper.strip_prefix("DIGIT") {
        if num.len() == 1 && num.as_bytes()[0].is_ascii_digit() {
            return Some(i32::from(num.as_bytes()[0]));
        }
    }
    if let Some(num) = upper.strip_prefix('F') {
        if let Ok(index) = num.parse::<i32>() {
            if (1..=12).contains(&index) {
                return Some(0x6F + index);
            }
        }
    }
    match upper.as_str() {
        "INSERT" | "INS" => Some(0x2D),
        "DELETE" | "DEL" => Some(0x2E),
        "HOME" => Some(0x24),
        "END" => Some(0x23),
        "PAGEUP" | "PGUP" => Some(0x21),
        "PAGEDOWN" | "PGDN" => Some(0x22),
        "MINUS" | "-" => Some(0xBD),
        "EQUAL" | "=" => Some(0xBB),
        "BRACKETLEFT" | "[" => Some(0xDB),
        "BRACKETRIGHT" | "]" => Some(0xDD),
        "BACKSLASH" | "\\" => Some(0xDC),
        "SEMICOLON" | ";" => Some(0xBA),
        "QUOTE" | "'" => Some(0xDE),
        "BACKQUOTE" | "`" => Some(0xC0),
        "COMMA" | "," => Some(0xBC),
        "PERIOD" | "." => Some(0xBE),
        "SLASH" | "/" => Some(0xBF),
        _ => None,
    }
}

pub fn invite_url(place_id: &str, server_id: Option<&str>) -> Option<String> {
    if !(1..=20).contains(&place_id.len())
        || place_id == "0"
        || !place_id.bytes().all(|b| b.is_ascii_digit())
    {
        return None;
    }
    let server = server_id.map(str::trim).filter(|id| {
        (5..=64).contains(&id.len())
            && *id != "00000000-0000-0000-0000-000000000000"
            && id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
    });
    Some(match server {
        Some(id) => format!(
            "https://www.roblox.com/games/start?placeId={place_id}&gameInstanceId={id}"
        ),
        None => format!("https://www.roblox.com/games/start?placeId={place_id}"),
    })
}

pub fn set_clipboard_text(text: &str) -> Result<(), String> {
    if text.is_empty() || text.len() > 8192 {
        return Err("Invalid clipboard text length".into());
    }
    let wide: Vec<u16> = text.encode_utf16().chain(std::iter::once(0)).collect();
    let bytes = wide.len() * std::mem::size_of::<u16>();
    unsafe {
        if OpenClipboard(0) == 0 {
            return Err("Could not open the Windows clipboard".into());
        }
        let _ = EmptyClipboard();
        let mem = GlobalAlloc(GMEM_MOVEABLE, bytes);
        if mem == 0 {
            let _ = CloseClipboard();
            return Err("Could not allocate clipboard memory".into());
        }
        let ptr = GlobalLock(mem);
        if ptr.is_null() {
            let _ = GlobalFree(mem);
            let _ = CloseClipboard();
            return Err("Could not lock clipboard memory".into());
        }
        std::ptr::copy_nonoverlapping(wide.as_ptr(), ptr, wide.len());
        let _ = GlobalUnlock(mem);
        if SetClipboardData(CF_UNICODETEXT, mem) == 0 {
            let _ = GlobalFree(mem);
            let _ = CloseClipboard();
            return Err("Could not set clipboard data".into());
        }
        let _ = CloseClipboard();
    }
    Ok(())
}

#[tauri::command]
pub fn copy_to_clipboard(text: String) -> Result<(), String> {
    set_clipboard_text(&text)
}

#[tauri::command]
pub fn roblox_toggle_mute(muted: Option<bool>) -> Result<bool, String> {
    crate::overlay_audio::set_or_toggle_roblox_mute(muted).map(|(state, _)| state)
}

#[tauri::command]
pub fn roblox_terminate_player() -> Result<usize, String> {
    Ok(crate::runtime::terminate_player_processes())
}

#[tauri::command]
pub fn game_overlay_notify(app: AppHandle, text: String) -> Result<(), String> {
    let clean: String = text.chars().filter(|ch| !ch.is_control()).take(140).collect();
    if !clean.trim().is_empty() {
        let _ = app.emit_to(LABEL, "game-overlay:notice", clean);
    }
    Ok(())
}

fn default_true() -> bool {
    true
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct Session {
    pid: u32,
    started_at: u64,
    place_id: Option<String>,
    server_id: Option<String>,
    server_ip: Option<String>,
    server_port: Option<u16>,
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    enabled: bool,
    corner: Corner,
    #[serde(default)]
    custom_x: Option<i32>,
    #[serde(default)]
    custom_y: Option<i32>,
    #[serde(default)]
    scale: Option<u32>,
    #[serde(default)]
    gap: Option<u32>,
    #[serde(default)]
    opacity: Option<u32>,
    #[serde(default)]
    style: String,
    #[serde(default)]
    bad_ping_ms: Option<u32>,
    #[serde(default)]
    low_fps: Option<u32>,
    #[serde(default)]
    hide_fullscreen: bool,
    timer: bool,
    fps: bool,
    ping: bool,
    #[serde(default)]
    stability: bool,
    #[serde(default)]
    region: bool,
    #[serde(default = "default_true")]
    bad_ping_prompt: bool,
    #[serde(default)]
    system: bool,
    #[serde(default)]
    clock: bool,
    friends: bool,
    friend_count: Option<u32>,
    language: String,
    accent: String,
    motion: bool,
    #[serde(default)]
    invite_hotkey: String,
    #[serde(default)]
    toggle_hotkey: String,
    #[serde(default)]
    mute_hotkey: String,
    #[serde(default)]
    server_hop_hotkey: String,
    #[serde(default)]
    rejoin_hotkey: String,
    session: Option<Session>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Content {
    started_at: Option<u64>,
    fps: Option<Fps>,
    ping: Option<Ping>,
    show_stability: bool,
    jitter: Option<u32>,
    ping_history: Vec<u32>,
    show_region: bool,
    region: Option<String>,
    bad_server: bool,
    bad_ping_prompt: bool,
    server_hop_hotkey: String,
    show_system: bool,
    ram_mb: Option<u32>,
    cpu_percent: Option<u32>,
    show_clock: bool,
    show_friends: bool,
    friend_count: Option<u32>,
    scale: u32,
    gap: u32,
    opacity: u32,
    style: String,
    bad_ping_ms: u32,
    low_fps: u32,
    language: String,
    accent: String,
    motion: bool,
}

#[derive(Default)]
pub struct OverlayState {
    config: Mutex<Config>,
    ready: AtomicBool,
    content: Mutex<Content>,
    wake: tokio::sync::Notify,
}

#[tauri::command]
pub fn game_overlay_configure(
    config: Config,
    window: WebviewWindow,
    state: tauri::State<'_, Arc<OverlayState>>,
) -> Result<(), String> {
    if window.label() != "main" {
        return Err("Only the main window can configure the overlay.".into());
    }
    *state.config.lock().map_err(|error| error.to_string())? = config;
    state.wake.notify_one();
    Ok(())
}

#[tauri::command]
pub fn game_overlay_ready(
    window: WebviewWindow,
    state: tauri::State<'_, Arc<OverlayState>>,
) -> Result<Content, String> {
    if window.label() != LABEL {
        return Err("Only the overlay window can read its content.".into());
    }
    let content = state
        .content
        .lock()
        .map_err(|error| error.to_string())?
        .clone();
    state.ready.store(true, Ordering::Release);
    Ok(content)
}

fn create_window(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    let window = WebviewWindowBuilder::new(app, LABEL, WebviewUrl::App("game-overlay.html".into()))
        .title("Vortex Overlay")
        .inner_size(324.0, f64::from(HEIGHT))
        .min_inner_size(80.0, 20.0)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .resizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        .focused(false)
        .focusable(false)
        .build()?;
    if let Err(error) = window.set_ignore_cursor_events(true) {
        let _ = window.destroy();
        return Err(error);
    }
    Ok(window)
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct Placement {
    x: i32,
    y: i32,
    width: i32,
    height: i32,
}

#[cfg(test)]
fn position(rect: RECT, dpi: u32, corner: Corner, metrics: i32) -> Option<Placement> {
    position_with_spec(
        rect,
        dpi,
        LayoutSpec {
            corner,
            ..LayoutSpec::default()
        },
        metrics,
    )
}

fn position_with_spec(
    rect: RECT,
    dpi: u32,
    spec: LayoutSpec,
    metrics: i32,
) -> Option<Placement> {
    if metrics <= 0 {
        return None;
    }
    let hud_scale = spec.scale.clamp(70, 150);
    let gap_bonus = (spec.gap.clamp(0, 24) - 5) * 3;
    let scale = |size: i32| size * dpi as i32 / 96;
    let scale_hud = |size: i32| size * hud_scale * dpi as i32 / (96 * 100);
    let margin = scale(16);
    let room = rect.right - rect.left - 2 * margin;
    let room_h = rect.bottom - rect.top - 2 * margin;
    let (width, height) = if spec.vertical {
        let row_gap = spec.gap.clamp(0, 16);
        let col_w = scale_hud(156).min(room);
        let col_h = scale_hud(HEIGHT * metrics + (metrics - 1).max(0) * row_gap + 8);
        if room < scale_hud(112) || room_h < col_h {
            return None;
        }
        (col_w, col_h.min(room_h))
    } else {
        let height = scale_hud(HEIGHT).max(20);
        let min_cell = (82 + gap_bonus).max(68);
        let cell = (108 + gap_bonus).max(84);
        if room < scale_hud(min_cell * metrics) || room_h < height {
            return None;
        }
        (scale_hud(cell * metrics).min(room), height)
    };
    let avail_x = (rect.right - rect.left - 2 * margin - width).max(0);
    let avail_y = (rect.bottom - rect.top - 2 * margin - height).max(0);
    let x = match spec.corner {
        Corner::TopLeft | Corner::BottomLeft => rect.left + margin,
        Corner::TopCenter | Corner::BottomCenter => rect.left + margin + avail_x / 2,
        Corner::TopRight | Corner::BottomRight => rect.right - width - margin,
        Corner::Custom => rect.left + margin + avail_x * spec.custom_x.clamp(0, 100) / 100,
    };
    let y = match spec.corner {
        Corner::TopLeft | Corner::TopCenter | Corner::TopRight => rect.top + margin,
        Corner::BottomLeft | Corner::BottomCenter | Corner::BottomRight => {
            rect.bottom - height - margin
        }
        Corner::Custom => rect.top + margin + avail_y * spec.custom_y.clamp(0, 100) / 100,
    };
    Some(Placement {
        x,
        y,
        width,
        height,
    })
}

fn foreground_placement(
    pid: u32,
    spec: LayoutSpec,
    metrics: i32,
    hide_fullscreen: bool,
) -> Option<Placement> {
    unsafe {
        let game = GetForegroundWindow();
        let mut active_pid = 0;
        GetWindowThreadProcessId(game, Some(&mut active_pid));
        if pid != active_pid || IsIconic(game).as_bool() || !crate::runtime::is_player_pid(pid) {
            return None;
        }
        let mut rect = RECT::default();
        GetClientRect(game, &mut rect).ok()?;
        let mut origin = POINT::default();
        if !ClientToScreen(game, &mut origin).as_bool() {
            return None;
        }
        rect.left += origin.x;
        rect.right += origin.x;
        rect.top += origin.y;
        rect.bottom += origin.y;
        let mut info = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };
        let monitor = MonitorFromWindow(game, MONITOR_DEFAULTTONEAREST);
        if GetMonitorInfoW(monitor, &mut info).as_bool() {
            let is_fullscreen = rect.left <= info.rcMonitor.left
                && rect.top <= info.rcMonitor.top
                && rect.right >= info.rcMonitor.right
                && rect.bottom >= info.rcMonitor.bottom;
            if hide_fullscreen && is_fullscreen {
                return None;
            }
            rect.left = rect.left.max(info.rcMonitor.left);
            rect.top = rect.top.max(info.rcMonitor.top);
            rect.right = rect.right.min(info.rcMonitor.right);
            rect.bottom = rect.bottom.min(info.rcMonitor.bottom);
        }
        position_with_spec(rect, GetDpiForWindow(game).max(96), spec, metrics)
    }
}

fn show(window: &WebviewWindow, placement: Placement) -> tauri::Result<()> {
    let handle = HWND(window.hwnd()?.0);
    let Placement {
        x,
        y,
        width,
        height,
    } = placement;
    unsafe {
        SetWindowPos(
            handle,
            HWND_TOPMOST,
            x,
            y,
            width,
            height,
            SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_ASYNCWINDOWPOS | SWP_SHOWWINDOW,
        )
        .map_err(|error| tauri::Error::Anyhow(error.into()))
    }
}

fn hide(window: &WebviewWindow) {
    if let Ok(handle) = window.hwnd() {
        let _ = unsafe {
            SetWindowPos(
                HWND(handle.0),
                None,
                0,
                0,
                0,
                0,
                SWP_NOACTIVATE
                    | SWP_NOZORDER
                    | SWP_NOSIZE
                    | SWP_NOMOVE
                    | SWP_ASYNCWINDOWPOS
                    | SWP_HIDEWINDOW,
            )
        };
    }
}

fn update_content(app: &AppHandle, state: &OverlayState, content: Content) {
    if let Ok(mut current) = state.content.lock() {
        if *current != content {
            let _ = app.emit_to(LABEL, "game-overlay:content", &content);
            *current = content;
        }
    }
}

const FPS_RETRY: Duration = Duration::from_secs(5);

fn is_foreground_player(pid: u32) -> bool {
    if pid == 0 {
        return false;
    }
    unsafe {
        let game = GetForegroundWindow();
        let mut active_pid = 0;
        GetWindowThreadProcessId(game, Some(&mut active_pid));
        pid == active_pid && !IsIconic(game).as_bool() && crate::runtime::is_player_pid(pid)
    }
}

fn check_edge(spec: &str, was_down: &mut bool) -> bool {
    let Some(hotkey) = Hotkey::parse(spec) else {
        *was_down = false;
        return false;
    };
    let down = hotkey.is_down();
    let triggered = down && !*was_down;
    *was_down = down;
    triggered
}

pub async fn run(app: AppHandle, state: Arc<OverlayState>) {
    let mut window = None;
    let mut placement = None;
    let mut capture: Option<Capture> = None;
    let mut reported_fps = Fps::Idle;
    let mut probe: Option<Probe> = None;
    let mut fps_retry_at: Option<std::time::Instant> = None;
    let mut opened_at = None;
    let mut perf_tracker = ProcessPerfTracker::default();
    let mut invite_down = false;
    let mut toggle_down = false;
    let mut mute_down = false;
    let mut hop_down = false;
    let mut rejoin_down = false;
    let mut first_tick = true;
    loop {
        if !first_tick {
            let idle = state
                .config
                .lock()
                .map(|c| !c.session.as_ref().is_some_and(|s| s.pid != 0))
                .unwrap_or(true)
                && placement.is_none()
                && capture.is_none()
                && probe.is_none();
            let wait = if idle {
                Duration::from_millis(500)
            } else {
                Duration::from_millis(80)
            };
            tokio::select! {
                _ = state.wake.notified() => {}
                _ = tokio::time::sleep(wait) => {}
            }
        }
        first_tick = false;
        let mut config = state
            .config
            .lock()
            .map(|config| config.clone())
            .unwrap_or_default();
        if !config.session.as_ref().is_some_and(|s| s.pid != 0)
            && placement.is_none()
            && capture.is_none()
            && probe.is_none()
        {
            continue;
        }
        let in_foreground = config
            .session
            .as_ref()
            .is_some_and(|s| is_foreground_player(s.pid));
        if in_foreground {
            if check_edge(&config.invite_hotkey, &mut invite_down) {
                if let Some(session) = config.session.as_ref() {
                    if let Some(place_id) = session.place_id.as_deref() {
                        if let Some(url) = invite_url(place_id, session.server_id.as_deref()) {
                            if set_clipboard_text(&url).is_ok() {
                                let _ = app.emit_to("main", "game-overlay:invite-copied", &url);
                                let _ = app.emit_to(LABEL, "game-overlay:invite-copied", &url);
                            }
                        }
                    }
                }
            }
            if check_edge(&config.toggle_hotkey, &mut toggle_down) {
                config.enabled = !config.enabled;
                if let Ok(mut guard) = state.config.lock() {
                    guard.enabled = config.enabled;
                }
                let _ = app.emit_to("main", "game-overlay:toggled", config.enabled);
            }
            if check_edge(&config.mute_hotkey, &mut mute_down) {
                if let Ok((muted, _)) = crate::overlay_audio::set_or_toggle_roblox_mute(None) {
                    let _ = app.emit_to("main", "game-overlay:mute-toggled", muted);
                    let _ = app.emit_to(LABEL, "game-overlay:mute-toggled", muted);
                }
            }
            if check_edge(&config.server_hop_hotkey, &mut hop_down) {
                let _ = app.emit_to("main", "game-overlay:server-hop", ());
                let _ = app.emit_to(LABEL, "game-overlay:server-hop", ());
            }
            if check_edge(&config.rejoin_hotkey, &mut rejoin_down) {
                let _ = app.emit_to("main", "game-overlay:rejoin", ());
                let _ = app.emit_to(LABEL, "game-overlay:rejoin", ());
            }
        } else {
            invite_down = false;
            toggle_down = false;
            mute_down = false;
            hop_down = false;
            rejoin_down = false;
        }

        // Probe ping only when ping, stability, region, or bad-ping prompt is active
        // so the Minimal (FPS-only) profile avoids all background network probing.
        let need_ping = config.ping || config.stability || config.region || config.bad_ping_prompt;
        let active_session = config
            .session
            .as_ref()
            .filter(|session| config.enabled && session.pid != 0);
        let ping_target = active_session.filter(|_| need_ping).and_then(|session| {
            Some(crate::overlay_ping::Target {
                place_id: session.place_id.clone()?,
                server_id: session.server_id.clone().unwrap_or_default(),
                ip: session.server_ip.clone(),
                port: session.server_port,
            })
        });
        if probe
            .as_ref()
            .is_some_and(|probe| ping_target.as_ref() != Some(&probe.target))
        {
            if let Some(probe) = probe.take() {
                probe.stop().await;
            }
        }
        if probe.is_none() {
            if let Some(target) = ping_target.filter(|_| in_foreground) {
                probe = Some(Probe::start(target));
            }
        }
        let ping_snapshot: PingSnapshot = probe
            .as_ref()
            .map_or_else(PingSnapshot::default, |probe| probe.samples.borrow().clone());

        let bad_ping_threshold = config.bad_ping_ms.unwrap_or(130).clamp(50, 500);
        let low_fps_threshold = config.low_fps.unwrap_or(30).clamp(10, 120);
        let is_bad_server = match ping_snapshot.state {
            Ping::Measured(ms) => ms >= bad_ping_threshold,
            _ => false,
        } || ping_snapshot.jitter.is_some_and(|j| j >= crate::overlay_ping::BAD_JITTER_THRESHOLD_MS);
        let style_clean = match config.style.as_str() {
            "frameless" | "vertical" => config.style.clone(),
            _ => "capsule".to_string(),
        };

        let show_region_slot = config.region || is_bad_server;
        let extra_bad_prompt_slot = i32::from(is_bad_server && config.bad_ping_prompt);
        let count = i32::from(config.timer)
            + i32::from(config.fps)
            + i32::from(config.ping)
            + i32::from(config.stability)
            + i32::from(show_region_slot)
            + extra_bad_prompt_slot
            + i32::from(config.system)
            + i32::from(config.clock)
            + i32::from(config.friends);
        let active = active_session.filter(|_| count != 0);
        let layout_spec = LayoutSpec {
            corner: config.corner,
            custom_x: config.custom_x.unwrap_or(96),
            custom_y: config.custom_y.unwrap_or(4),
            scale: config.scale.unwrap_or(100) as i32,
            gap: config.gap.unwrap_or(5) as i32,
            vertical: style_clean == "vertical",
        };
        let next = active.and_then(|session| {
            foreground_placement(session.pid, layout_spec, count, config.hide_fullscreen)
        });
        if next.is_none() && placement.take().is_some() {
            if let Some(window) = &window {
                hide(window);
                update_content(&app, &state, Content::default());
            }
        }

        let fps_pid = active.filter(|_| config.fps).map(|session| session.pid);
        if capture
            .as_ref()
            .is_some_and(|capture| Some(capture.pid) != fps_pid)
        {
            if let Some(capture) = capture.take() {
                capture.stop().await;
            }
        }
        let mut fps_state = capture
            .as_ref()
            .map_or(Fps::Idle, |capture| *capture.samples.borrow());
        if matches!(fps_state, Fps::Idle | Fps::Unavailable) {
            if let Some(finished) = capture.take() {
                finished.stop().await;
            }
        }
        if let Some(pid) = fps_pid.filter(|_| {
            capture.is_none()
                && next.is_some()
                && fps_retry_at.is_none_or(|at| at.elapsed() >= FPS_RETRY)
        }) {
            fps_retry_at = Some(std::time::Instant::now());
            capture = Some(Capture::start(pid));
            fps_state = Fps::Collecting;
        }
        if reported_fps != fps_state {
            let _ = app.emit_to("main", "game-overlay:fps", fps_state);
            reported_fps = fps_state;
        }

        if next.is_none() {
            continue;
        }
        let Some(session) = active else { continue };
        if window.is_none()
            && opened_at.is_none_or(|at: std::time::Instant| at.elapsed().as_secs() >= 10)
        {
            opened_at = Some(std::time::Instant::now());
            window = create_window(&app).ok();
        }
        let Some(window) = &window else { continue };
        let (ram_mb, cpu_percent) = if config.system {
            perf_tracker.sample(session.pid)
        } else {
            (None, None)
        };
        let content = Content {
            started_at: config
                .timer
                .then_some(session.started_at)
                .filter(|start| *start > 0),
            fps: config.fps.then_some(fps_state),
            ping: config.ping.then_some(ping_snapshot.state),
            show_stability: config.stability,
            jitter: ping_snapshot.jitter,
            ping_history: ping_snapshot.history,
            show_region: config.region,
            region: ping_snapshot.region,
            bad_server: is_bad_server,
            bad_ping_prompt: config.bad_ping_prompt,
            server_hop_hotkey: config.server_hop_hotkey.clone(),
            show_system: config.system,
            ram_mb,
            cpu_percent,
            show_clock: config.clock,
            show_friends: config.friends,
            friend_count: config.friend_count,
            scale: config.scale.unwrap_or(100).clamp(70, 150),
            gap: config.gap.unwrap_or(5).clamp(0, 24),
            opacity: config.opacity.unwrap_or(74).clamp(20, 100),
            style: style_clean,
            bad_ping_ms: bad_ping_threshold,
            low_fps: low_fps_threshold,
            language: config.language,
            accent: config.accent,
            motion: config.motion,
        };
        update_content(&app, &state, content);
        if state.ready.load(Ordering::Acquire) && placement != next {
            let Some(current) =
                foreground_placement(session.pid, layout_spec, count, config.hide_fullscreen)
            else {
                hide(window);
                update_content(&app, &state, Content::default());
                placement = None;
                continue;
            };
            if show(window, current).is_ok() {
                placement = Some(current);
            }
        }
    }
}
