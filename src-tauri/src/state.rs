use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// Global app state shared across all Tauri commands.
pub struct AppState {
    /// In-memory HTTP response cache: URL -> (value, expiry)
    pub response_cache: Mutex<HashMap<String, CacheEntry<serde_json::Value>>>,
    /// Whether the on-disk cache is enabled (mirrors the renderer preference).
    pub disk_cache_enabled: Mutex<bool>,
    /// The optional .ROBLOSECURITY cookie, stored encrypted on disk via DPAPI.
    pub roblox_cookie: Mutex<String>,
    /// Discord Rich Presence state.
    pub discord: Mutex<DiscordState>,
    /// Optional custom Discord application (client) id from Settings.
    pub discord_client_id: Mutex<String>,
    /// Tray state pushed by the renderer.
    pub tray: Mutex<TrayData>,
    /// Physical rect of the tray icon used to anchor the popup after resizes.
    pub tray_anchor: Mutex<Option<(f64, f64, f64, f64)>>,
    /// Collapsed tray sections, mirrored from the tray renderer so the popup can
    /// be sized correctly before it is shown.
    pub tray_collapsed: Mutex<(bool, bool)>,
    /// Update check state broadcast to the renderer.
    pub update_state: Mutex<UpdateState>,
    /// Metadata for the release asset selected by the last update check.
    pub update_pending: Mutex<Option<PendingUpdate>>,
    /// Guards against starting two installer downloads at once.
    pub update_downloading: Mutex<bool>,
    /// Whether an update check is currently running.
    pub update_check_running: Mutex<bool>,
    /// Cached announcement feed.
    pub announcement_cache: Mutex<Option<AnnouncementCache>>,
    /// Cached roadmap content.
    pub plans_cache: Mutex<Option<AnnouncementCache>>,
    /// Sender for the Discord IPC worker.
    pub discord_commands:
        Mutex<Option<tokio::sync::mpsc::UnboundedSender<crate::discord::DiscordCommand>>>,
    /// Paid-games scan cursor + in-memory cache.
    pub paid_cursor: Mutex<i32>,
    pub paid_cache: Mutex<PaidCache>,
}

#[derive(Clone)]
pub struct CacheEntry<T> {
    pub value: T,
    pub expires_at: Instant,
}

impl<T: Clone> CacheEntry<T> {
    pub fn fresh_for(value: T, ttl: Duration) -> Self {
        Self {
            value,
            expires_at: Instant::now() + ttl,
        }
    }
    pub fn is_expired(&self) -> bool {
        Instant::now() >= self.expires_at
    }
}

#[derive(Default)]
pub struct DiscordState {
    pub enabled: bool,
    pub connected: bool,
    pub error: String,
    pub activity: Option<DiscordActivity>,
    pub account: Option<DiscordAccount>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct DiscordActivity {
    pub details: Option<String>,
    pub state: Option<String>,
    pub start_timestamp: Option<u64>,
    pub button_label: Option<String>,
    pub button_url: Option<String>,
    pub large_image: Option<String>,
    pub large_text: Option<String>,
}

fn truncate_utf8_bytes(text: &str, max_bytes: usize) -> String {
    let mut out = String::new();
    for ch in text.chars() {
        if out.len() + ch.len_utf8() > max_bytes {
            break;
        }
        out.push(ch);
    }
    out.trim().to_string()
}

impl DiscordActivity {
    pub fn to_rpc_json(&self) -> serde_json::Value {
        let mut obj = serde_json::json!({
            "details": self.details,
            "state": self.state
        });
        if let Some(start) = self.start_timestamp.filter(|&ts| ts > 0) {
            obj["timestamps"] = serde_json::json!({ "start": start });
        }
        if let Some(image) = self
            .large_image
            .as_deref()
            .filter(|url| url.starts_with("https://"))
        {
            let mut assets = serde_json::json!({ "large_image": image });
            if let Some(text) = self.large_text.as_deref().filter(|t| !t.trim().is_empty()) {
                assets["large_text"] = serde_json::json!(text);
            }
            obj["assets"] = assets;
        }
        if let (Some(label), Some(url)) = (&self.button_label, &self.button_url) {
            let safe_label = truncate_utf8_bytes(label, 32);
            if !safe_label.is_empty() && url.starts_with("https://www.roblox.com/") {
                obj["buttons"] = serde_json::json!([
                    { "label": safe_label, "url": url }
                ]);
            }
        }
        obj
    }
}

#[derive(Clone, Serialize, Deserialize)]
pub struct DiscordAccount {
    pub name: String,
    pub id: String,
}

#[derive(Default, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayData {
    pub favorites: Vec<TrayGame>,
    pub quick_launch: Vec<TrayShortcut>,
    pub now_playing: Option<TrayNowPlaying>,
    pub style: TrayStyle,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayGame {
    pub id: String,
    pub title: String,
    pub thumbnail: String,
    pub last_played: u64,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayShortcut {
    pub id: String,
    pub title: String,
    pub thumbnail: String,
    pub last_played: u64,
    pub method: String,
    pub place_id: String,
    pub link_code: String,
    pub share_code: String,
    pub share_type: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayNowPlaying {
    pub id: String,
    pub title: String,
    pub thumbnail: String,
    pub started_at: u64,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayStyle {
    #[serde(default = "default_accent")]
    pub accent: String,
    #[serde(default = "default_accent_secondary")]
    pub accent_secondary: String,
    #[serde(default = "default_accent_mode")]
    pub accent_mode: String,
    #[serde(default = "default_gradient_angle")]
    pub gradient_angle: f64,
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default)]
    pub theme_background: String,
    #[serde(default)]
    pub theme_surface: String,
    #[serde(default = "default_corners")]
    pub corners: String,
    #[serde(default = "default_tray_scale")]
    pub tray_scale: String,
    #[serde(default)]
    pub motion: Option<bool>,
    #[serde(default)]
    pub tooltips: Option<bool>,
    #[serde(default)]
    pub animation_speed: Option<String>,
    #[serde(default = "default_language")]
    pub language: String,
    #[serde(default)]
    pub accent_text: String,
    #[serde(default = "default_tray_favorite_limit")]
    pub tray_favorite_limit: usize,
    #[serde(default = "default_tray_quick_limit")]
    pub tray_quick_limit: usize,
    #[serde(default)]
    pub css: HashMap<String, String>,
}

impl Default for TrayStyle {
    fn default() -> Self {
        Self {
            accent: default_accent(),
            accent_secondary: default_accent_secondary(),
            accent_mode: default_accent_mode(),
            gradient_angle: default_gradient_angle(),
            theme: default_theme(),
            theme_background: String::new(),
            theme_surface: String::new(),
            corners: default_corners(),
            tray_scale: default_tray_scale(),
            motion: None,
            tooltips: None,
            animation_speed: None,
            language: default_language(),
            accent_text: String::new(),
            tray_favorite_limit: default_tray_favorite_limit(),
            tray_quick_limit: default_tray_quick_limit(),
            css: HashMap::new(),
        }
    }
}

#[derive(Clone, Serialize, Deserialize)]
pub struct UpdateState {
    pub status: String,
    pub progress: u32,
    pub stage: Option<String>,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub speed_bps: u64,
    pub current_version: String,
    pub latest_version: Option<String>,
    pub release_url: Option<String>,
    pub error_message: Option<String>,
}

impl Default for UpdateState {
    fn default() -> Self {
        Self {
            status: "idle".to_string(),
            progress: 0,
            stage: None,
            downloaded_bytes: 0,
            total_bytes: 0,
            speed_bps: 0,
            current_version: env!("CARGO_PKG_VERSION").to_string(),
            latest_version: None,
            release_url: None,
            error_message: None,
        }
    }
}

impl UpdateState {
    /// The fields the renderer is allowed to see.
    pub fn public(&self) -> serde_json::Value {
        serde_json::json!({
            "status": self.status,
            "progress": self.progress,
            "stage": self.stage,
            "downloadedBytes": self.downloaded_bytes,
            "totalBytes": self.total_bytes,
            "speedBps": self.speed_bps,
            "currentVersion": self.current_version,
            "latestVersion": self.latest_version,
            "releaseUrl": self.release_url,
            "errorMessage": self.error_message,
            "downloadReady": self.status == "downloaded",
        })
    }
}

#[derive(Clone, Default)]
pub struct PendingUpdate {
    #[allow(dead_code)]
    pub version: String,
    pub asset_name: String,
    pub asset_url: String,
    pub sha256: String,
    pub sha_url: String,
    pub path: Option<PathBuf>,
}

#[derive(Clone)]
pub struct AnnouncementCache {
    pub items: Vec<serde_json::Value>,
    pub at: Instant,
    pub source: String,
}

#[derive(Default)]
pub struct PaidCache {
    pub at: Option<Instant>,
    pub data: Vec<serde_json::Value>,
    pub complete: bool,
}

fn default_accent() -> String {
    "#9b7cff".to_string()
}
fn default_accent_secondary() -> String {
    "#c274ec".to_string()
}
fn default_accent_mode() -> String {
    "solid".to_string()
}
fn default_gradient_angle() -> f64 {
    135.0
}
fn default_theme() -> String {
    "dark".to_string()
}
fn default_corners() -> String {
    "soft".to_string()
}
fn default_tray_scale() -> String {
    "normal".to_string()
}
fn default_tray_favorite_limit() -> usize {
    5
}
fn default_tray_quick_limit() -> usize {
    3
}
fn default_language() -> String {
    "ru".to_string()
}

impl AppState {
    pub fn new() -> Self {
        Self {
            response_cache: Mutex::new(HashMap::new()),
            disk_cache_enabled: Mutex::new(true),
            roblox_cookie: Mutex::new(String::new()),
            discord: Mutex::new(DiscordState::default()),
            discord_client_id: Mutex::new(String::new()),
            tray: Mutex::new(TrayData::default()),
            tray_anchor: Mutex::new(None),
            tray_collapsed: Mutex::new((false, false)),
            update_state: Mutex::new(UpdateState::default()),
            update_pending: Mutex::new(None),
            update_downloading: Mutex::new(false),
            update_check_running: Mutex::new(false),
            announcement_cache: Mutex::new(None),
            plans_cache: Mutex::new(None),
            discord_commands: Mutex::new(None),
            paid_cursor: Mutex::new(0),
            paid_cache: Mutex::new(PaidCache::default()),
        }
    }

    /// %APPDATA%\vortex-roblox-launcher — stable local data path.
    pub fn user_data_dir() -> PathBuf {
        dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("vortex-roblox-launcher")
    }
}

/// Acquire a Mutex without panicking if another thread panicked while holding it.
pub fn lock_or_recover<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}
