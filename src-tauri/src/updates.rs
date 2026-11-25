use crate::state::{AppState, PendingUpdate};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

fn compare_versions(left: &str, right: &str) -> std::cmp::Ordering {
    fn parse(version: &str) -> (Vec<u64>, Option<&str>) {
        let trimmed = version.trim().trim_start_matches(['v', 'V']);
        let without_build = trimmed.split('+').next().unwrap_or_default();
        let (core, pre) = match without_build.split_once('-') {
            Some((core, pre)) if !pre.is_empty() => (core, Some(pre)),
            Some((core, _)) => (core, None),
            None => (without_build, None),
        };
        let nums = core
            .split('.')
            .map(|part| part.parse::<u64>().unwrap_or(0))
            .collect();
        (nums, pre)
    }

    let (left_nums, left_pre) = parse(left);
    let (right_nums, right_pre) = parse(right);
    for index in 0..left_nums.len().max(right_nums.len()) {
        let ordering = left_nums
            .get(index)
            .copied()
            .unwrap_or(0)
            .cmp(&right_nums.get(index).copied().unwrap_or(0));
        if ordering != std::cmp::Ordering::Equal {
            return ordering;
        }
    }

    match (left_pre, right_pre) {
        (None, None) => std::cmp::Ordering::Equal,
        (None, Some(_)) => std::cmp::Ordering::Greater,
        (Some(_), None) => std::cmp::Ordering::Less,
        (Some(l), Some(r)) => {
            let l_parts: Vec<&str> = l.split('.').collect();
            let r_parts: Vec<&str> = r.split('.').collect();
            for index in 0..l_parts.len().min(r_parts.len()) {
                let lp = l_parts[index];
                let rp = r_parts[index];
                let ord = match (lp.parse::<u64>(), rp.parse::<u64>()) {
                    (Ok(ln), Ok(rn)) => ln.cmp(&rn),
                    (Ok(_), Err(_)) => std::cmp::Ordering::Less,
                    (Err(_), Ok(_)) => std::cmp::Ordering::Greater,
                    (Err(_), Err(_)) => lp.cmp(rp),
                };
                if ord != std::cmp::Ordering::Equal {
                    return ord;
                }
            }
            l_parts.len().cmp(&r_parts.len())
        }
    }
}

fn update_dir() -> PathBuf {
    AppState::user_data_dir().join("updates")
}

fn valid_update_asset_url(url: &str) -> bool {
    url.starts_with("https://github.com/mozrg/Vortex/releases/download/")
}

fn safe_update_filename(name: &str) -> Option<String> {
    let safe: String = name
        .chars()
        .filter(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '.' | '-' | '_' | ' ')
        })
        .collect();
    safe.to_ascii_lowercase()
        .ends_with(".exe")
        .then_some(safe)
        .filter(|name| !name.is_empty() && name.len() <= 180)
}

fn pending_from_asset(version: &str, asset: &Value, assets: &[Value]) -> Option<PendingUpdate> {
    let asset_name = asset.get("name").and_then(Value::as_str)?.to_string();
    let asset_url = asset
        .get("browser_download_url")
        .and_then(Value::as_str)
        .filter(|url| valid_update_asset_url(url))?
        .to_string();
    let digest = asset
        .get("digest")
        .and_then(Value::as_str)
        .and_then(|digest| digest.strip_prefix("sha256:"))
        .unwrap_or_default()
        .to_ascii_lowercase();
    let sha_name = format!("{asset_name}.sha256");
    let sha_url = assets
        .iter()
        .find(|candidate| {
            candidate
                .get("name")
                .and_then(Value::as_str)
                .is_some_and(|name| name.eq_ignore_ascii_case(&sha_name))
        })
        .and_then(|candidate| candidate.get("browser_download_url"))
        .and_then(Value::as_str)
        .filter(|url| valid_update_asset_url(url))
        .unwrap_or_default()
        .to_string();
    Some(PendingUpdate {
        version: version.to_string(),
        asset_name,
        asset_url,
        asset_size: asset.get("size").and_then(Value::as_u64).unwrap_or(0),
        sha256: digest,
        sha_url,
        path: None,
    })
}

pub async fn run_update_check(app: AppHandle, state: Arc<AppState>) -> Result<(), String> {
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
        let client = crate::roblox::shared_github_client();
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
        let latest = version.trim_start_matches(['v', 'V']).to_string();
        let url = release
            .get("html_url")
            .and_then(Value::as_str)
            .filter(|url| url.starts_with("https://github.com/mozrg/Vortex/"))
            .map(str::to_owned);
        let assets: Vec<Value> = release
            .get("assets")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        let asset = assets
            .iter()
            .find(|asset| {
                let name = asset
                    .get("name")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_ascii_lowercase();
                name.ends_with(".exe") && (name.contains("setup") || name.contains("installer"))
            })
            .or_else(|| {
                assets.iter().find(|asset| {
                    asset
                        .get("name")
                        .and_then(Value::as_str)
                        .unwrap_or_default()
                        .to_ascii_lowercase()
                        .ends_with(".exe")
                })
            });
        let pending = asset.and_then(|asset| pending_from_asset(&latest, asset, &assets));
        Ok::<_, String>((latest, url, pending))
    }
    .await;

    let mut pending_update = None;
    let final_state = {
        let mut update = state
            .update_state
            .lock()
            .map_err(|_| "update state unavailable")?;
        match result {
            Ok((latest, url, pending)) => {
                if compare_versions(&update.current_version, &latest) == std::cmp::Ordering::Less {
                    if pending.is_some() {
                        update.status = "available".to_string();
                        update.progress = 0;
                        pending_update = pending;
                        update.error_message = None;
                    } else {
                        update.status = "error".to_string();
                        update.progress = 0;
                        update.error_message =
                            Some("В релизе нет подходящего установщика Vortex (.exe)".to_string());
                    }
                } else {
                    update.status = "current".to_string();
                    update.progress = 100;
                    update.error_message = None;
                }
                update.stage = None;
                update.latest_version = Some(latest);
                update.release_url = url;
            }
            Err(error) => {
                update.status = "error".to_string();
                update.progress = 0;
                update.stage = None;
                update.error_message = Some(error.chars().take(240).collect());
            }
        }
        update.clone()
    };
    if let Ok(mut pending) = state.update_pending.lock() {
        *pending = pending_update.clone();
    }
    if let Ok(mut running) = state.update_check_running.lock() {
        *running = false;
    }
    let _ = app.emit("updates:state", final_state.public());
    Ok(())
}

fn publish_update_state(app: &AppHandle, state: &AppState) {
    if let Ok(update) = state.update_state.lock() {
        let _ = app.emit("updates:state", update.public());
    }
}

async fn download_update_inner(app: AppHandle, state: Arc<AppState>) -> Result<(), String> {
    {
        let mut downloading = state
            .update_downloading
            .lock()
            .map_err(|_| "update state unavailable".to_string())?;
        if *downloading {
            return Ok(());
        }
        *downloading = true;
    }

    let result = async {
        let pending = state
            .update_pending
            .lock()
            .map_err(|_| "update state unavailable".to_string())?
            .clone()
            .ok_or_else(|| "Нет установщика для этой версии в релизе GitHub".to_string())?;
        if !valid_update_asset_url(&pending.asset_url) {
            return Err("Небезопасная ссылка на установщик".to_string());
        }
        let filename = safe_update_filename(&pending.asset_name)
            .ok_or_else(|| "Некорректное имя установщика".to_string())?;
        let folder = update_dir();
        tokio::fs::create_dir_all(&folder)
            .await
            .map_err(|error| format!("Не удалось создать папку обновления: {error}"))?;
        let final_path = folder.join(filename);
        let partial_path = final_path.with_extension("exe.part");
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(300))
            .user_agent(concat!("Vortex/", env!("CARGO_PKG_VERSION")))
            .build()
            .map_err(|error| error.to_string())?;
        let mut response = client
            .get(&pending.asset_url)
            .send()
            .await
            .map_err(|error| format!("Не удалось скачать установщик: {error}"))?;
        if !response.status().is_success() {
            return Err(format!(
                "GitHub вернул HTTP {} при скачивании",
                response.status().as_u16()
            ));
        }
        let total = installer_download_size(response.content_length(), pending.asset_size)
            .map_err(|()| "Некорректный размер установщика".to_string())?;
        {
            let mut update = state
                .update_state
                .lock()
                .map_err(|_| "update state unavailable".to_string())?;
            update.status = "downloading".to_string();
            update.progress = 0;
            update.stage = Some("downloading".to_string());
            update.downloaded_bytes = 0;
            update.total_bytes = total;
            update.speed_bps = 0;
        }
        publish_update_state(&app, &state);

        let mut file = tokio::fs::File::create(&partial_path)
            .await
            .map_err(|error| format!("Не удалось создать файл обновления: {error}"))?;
        let mut downloaded = 0u64;
        let mut hasher = Sha256::new();
        let started_at = Instant::now();
        let mut last_emit = Instant::now() - Duration::from_millis(200);
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|error| format!("Ошибка загрузки установщика: {error}"))?
        {
            downloaded = downloaded.saturating_add(chunk.len() as u64);
            if downloaded > MAX_INSTALLER_BYTES || (total > 0 && downloaded > total) {
                return Err("Размер загруженного файла не совпал с ожидаемым".to_string());
            }
            hasher.update(&chunk);
            file.write_all(&chunk)
                .await
                .map_err(|error| format!("Не удалось записать установщик: {error}"))?;
            if last_emit.elapsed() >= Duration::from_millis(80) || downloaded == total {
                last_emit = Instant::now();
                let elapsed = started_at.elapsed().as_secs_f64().max(0.05);
                let speed_bps = (downloaded as f64 / elapsed) as u64;
                let progress = downloaded.saturating_mul(100).checked_div(total).unwrap_or(0).min(99) as u32;
                {
                    let mut update = state
                        .update_state
                        .lock()
                        .map_err(|_| "update state unavailable".to_string())?;
                    update.status = "downloading".to_string();
                    update.progress = progress;
                    update.stage = Some("downloading".to_string());
                    update.downloaded_bytes = downloaded;
                    update.total_bytes = total;
                    update.speed_bps = speed_bps;
                }
                publish_update_state(&app, &state);
            }
        }
        file.flush()
            .await
            .map_err(|error| format!("Не удалось завершить запись установщика: {error}"))?;
        drop(file);
        if downloaded == 0 || (total > 0 && downloaded != total) {
            return Err("Загрузка установщика завершилась не полностью".to_string());
        }
        let actual_hash = format!("{:x}", hasher.finalize());
        let expected_hash = if pending.sha256.len() == 64
            && pending
                .sha256
                .chars()
                .all(|character| character.is_ascii_hexdigit())
        {
            pending.sha256.to_ascii_lowercase()
        } else if !pending.sha_url.is_empty() && valid_update_asset_url(&pending.sha_url) {
            let response = client
                .get(&pending.sha_url)
                .send()
                .await
                .map_err(|error| format!("Не удалось скачать контрольную сумму: {error}"))?;
            if !response.status().is_success() {
                return Err(format!(
                    "GitHub вернул HTTP {} для контрольной суммы",
                    response.status().as_u16()
                ));
            }
            let text = response.text().await.map_err(|error| error.to_string())?;
            text.split_whitespace()
                .find(|token| {
                    token.len() == 64
                        && token.chars().all(|character| character.is_ascii_hexdigit())
                })
                .map(str::to_ascii_lowercase)
                .ok_or_else(|| "Файл контрольной суммы имеет неверный формат".to_string())?
        } else {
            return Err("В релизе отсутствует SHA-256 контрольная сумма".to_string());
        };
        if actual_hash != expected_hash {
            return Err("SHA-256 установщика не совпадает с релизом".to_string());
        }
        tokio::fs::rename(&partial_path, &final_path)
            .await
            .map_err(|error| format!("Не удалось сохранить проверенный установщик: {error}"))?;
        let mut ready = pending;
        ready.path = Some(final_path);
        if let Ok(mut stored) = state.update_pending.lock() {
            *stored = Some(ready);
        }
        Ok::<(), String>(())
    }
    .await;

    if let Ok(mut downloading) = state.update_downloading.lock() {
        *downloading = false;
    }
    match result {
        Ok(()) => {
            if let Ok(mut update) = state.update_state.lock() {
                update.status = "downloaded".to_string();
                update.progress = 100;
                update.stage = None;
                update.error_message = None;
            }
        }
        Err(ref error) => {
            let partial_path = state
                .update_pending
                .lock()
                .ok()
                .and_then(|pending| {
                    pending
                        .as_ref()
                        .and_then(|pending| safe_update_filename(&pending.asset_name))
                })
                .map(|filename| update_dir().join(filename).with_extension("exe.part"));
            if let Some(partial_path) = partial_path {
                let _ = tokio::fs::remove_file(partial_path).await;
            }
            if let Ok(mut update) = state.update_state.lock() {
                update.status = "error".to_string();
                update.progress = 0;
                update.stage = None;
                update.error_message = Some(error.chars().take(240).collect());
            }
        }
    }
    publish_update_state(&app, &state);
    result
}

fn normalize_windows_path_for_compare(path: &std::path::Path) -> String {
    let raw = path.to_string_lossy();
    let stripped = raw.strip_prefix(r"\\?\").unwrap_or(&raw);
    stripped
        .replace('/', "\\")
        .trim_end_matches('\\')
        .to_ascii_lowercase()
}

fn has_parent_traversal(path: &std::path::Path) -> bool {
    path.components()
        .any(|c| matches!(c, std::path::Component::ParentDir))
}

fn validate_installer_path_in_dir(
    raw_installer_path: &str,
    asset_name: &str,
    allowed_dir: &std::path::Path,
) -> Result<PathBuf, String> {
    let expected_dir = normalize_windows_path_for_compare(allowed_dir);
    let candidate_name = if !raw_installer_path.trim().is_empty() {
        let p = PathBuf::from(raw_installer_path.trim());
        if has_parent_traversal(&p) {
            return Err("Invalid installer path.".to_string());
        }
        let parent = p
            .parent()
            .ok_or_else(|| "Invalid installer path.".to_string())?;
        if normalize_windows_path_for_compare(parent) != expected_dir {
            return Err("Installer path must reside inside the updates directory.".to_string());
        }
        let raw_name = p
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or_else(|| "Invalid installer filename.".to_string())?;
        safe_update_filename(raw_name)
            .filter(|safe| safe == raw_name)
            .ok_or_else(|| "Invalid installer filename.".to_string())?
    } else if let Some(safe) = safe_update_filename(asset_name) {
        safe
    } else {
        return Err("Invalid installer path.".to_string());
    };

    if candidate_name.eq_ignore_ascii_case("vortex-updater.exe") {
        return Err("Invalid installer filename.".to_string());
    }
    Ok(allowed_dir.join(candidate_name))
}

fn validate_app_path_against_updates(
    raw_app_path: &str,
    updates_dir: &std::path::Path,
) -> Result<PathBuf, String> {
    let trimmed = raw_app_path.trim();
    if trimmed.is_empty() {
        return Err("Missing target application path.".to_string());
    }
    let path = PathBuf::from(trimmed);
    if !path.is_absolute() || has_parent_traversal(&path) {
        return Err("Invalid target application path.".to_string());
    }
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "Invalid target application executable.".to_string())?;
    let lower_name = file_name.to_ascii_lowercase();
    if !lower_name.ends_with(".exe")
        || !lower_name.contains("vortex")
        || lower_name == "vortex-updater.exe"
    {
        return Err("Untrusted target application executable.".to_string());
    }
    let norm_path = normalize_windows_path_for_compare(&path);
    let norm_updates = normalize_windows_path_for_compare(updates_dir);
    if norm_path == norm_updates || norm_path.starts_with(&format!("{norm_updates}\\")) {
        return Err("Target application path cannot reside inside updates directory.".to_string());
    }
    Ok(path)
}

#[tauri::command]
pub async fn updates_get_state(
    state: tauri::State<'_, Arc<AppState>>,
) -> Result<serde_json::Value, String> {
    let update_state = crate::state::lock_or_recover(&state.update_state);
    Ok(update_state.public())
}

#[tauri::command]
pub async fn updates_retry(
    app: AppHandle,
    state: tauri::State<'_, Arc<AppState>>,
) -> Result<(), String> {
    run_update_check(app, state.inner().clone()).await
}

#[tauri::command]
pub async fn updates_download(
    app: AppHandle,
    state: tauri::State<'_, Arc<AppState>>,
) -> Result<(), String> {
    download_update_inner(app, state.inner().clone()).await
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdaterJob {
    #[serde(default)]
    installer_path: String,
    #[serde(default)]
    asset_url: String,
    #[serde(default)]
    asset_name: String,
    #[serde(default)]
    asset_size: u64,
    #[serde(default)]
    sha256: String,
    #[serde(default)]
    sha_url: String,
    app_path: String,
    from_version: String,
    to_version: String,
    parent_pid: u32,
    theme: String,
    accent: String,
    accent_secondary: String,
    language: String,
}

#[derive(Default)]
struct UpdaterRuntime {
    job: Mutex<UpdaterJob>,
    started: AtomicBool,
    running: AtomicBool,
    snapshot: Mutex<Value>,
    preview: bool,
}

fn updater_job_path() -> PathBuf {
    update_dir().join("updater-job.json")
}

fn updater_host_exe_path() -> PathBuf {
    update_dir().join("vortex-updater.exe")
}

/// Remove temporary updater files and old downloaded installers left behind
/// after a completed update so `%APPDATA%\vortex-roblox-launcher\updates`
/// never accumulates gigabytes of obsolete `.exe` setups over time.
pub fn cleanup_updater_artifacts() {
    let dir = update_dir();
    if let Err(error) = std::fs::remove_file(updater_host_exe_path()) {
        if error.kind() != std::io::ErrorKind::NotFound {
            return; // The updater may still be using the download and job.
        }
    }
    let _ = std::fs::remove_file(updater_job_path());
    let _ = std::fs::remove_file(dir.join("apply-update.ps1"));
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let name = entry.file_name().to_string_lossy().to_ascii_lowercase();
            if name.ends_with(".exe")
                || name.ends_with(".exe.part")
                || name.ends_with(".sha256")
            {
                let _ = std::fs::remove_file(path);
            }
        }
    }
}

#[cfg(windows)]
fn spawn_updater_host(job: &UpdaterJob) -> Result<(), String> {
    let dir = update_dir();
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let host_exe = updater_host_exe_path();
    std::fs::copy(&current_exe, &host_exe)
        .map_err(|e| format!("Не удалось подготовить окно обновления: {e}"))?;
    let serialized = serde_json::to_string_pretty(job).map_err(|e| e.to_string())?;
    std::fs::write(updater_job_path(), serialized).map_err(|e| e.to_string())?;
    std::process::Command::new(&host_exe)
        .arg("--updater-mode")
        .spawn()
        .map_err(|e| format!("Не удалось запустить окно обновления: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn updates_install(
    app: AppHandle,
    state: tauri::State<'_, Arc<AppState>>,
    theme: Option<String>,
    accent: Option<String>,
    accent_secondary: Option<String>,
    language: Option<String>,
) -> Result<(), String> {
    let pending = state
        .update_pending
        .lock()
        .map_err(|_| "update state unavailable".to_string())?
        .clone()
        .ok_or_else(|| "Нет доступного обновления для установки".to_string())?;
    if !valid_update_asset_url(&pending.asset_url) {
        return Err("Небезопасная ссылка на установщик".to_string());
    }
    let has_valid_sha = (pending.sha256.len() == 64
        && pending.sha256.chars().all(|c| c.is_ascii_hexdigit()))
        || (!pending.sha_url.is_empty() && valid_update_asset_url(&pending.sha_url));
    if !has_valid_sha {
        return Err("В релизе отсутствует SHA-256 контрольная сумма".to_string());
    }
    let filename = safe_update_filename(&pending.asset_name)
        .ok_or_else(|| "Некорректное имя установщика".to_string())?;
    let installer = pending
        .path
        .filter(|path| path.is_file())
        .unwrap_or_else(|| update_dir().join(&filename));
    #[cfg(windows)]
    {
        let current_exe = std::env::current_exe().map_err(|error| error.to_string())?;
        let job = UpdaterJob {
            installer_path: installer.to_string_lossy().to_string(),
            asset_url: pending.asset_url.clone(),
            asset_name: pending.asset_name.clone(),
            asset_size: pending.asset_size,
            sha256: pending.sha256.clone(),
            sha_url: pending.sha_url.clone(),
            app_path: current_exe.to_string_lossy().to_string(),
            from_version: env!("CARGO_PKG_VERSION").to_string(),
            to_version: pending.version.clone(),
            parent_pid: std::process::id(),
            theme: theme.unwrap_or_else(|| "dark".to_string()),
            accent: accent.unwrap_or_else(|| "#a68bff".to_string()),
            accent_secondary: accent_secondary.unwrap_or_else(|| "#5b3fd6".to_string()),
            language: language.unwrap_or_else(|| "ru".to_string()),
        };

        if let Ok(mut update) = state.update_state.lock() {
            update.status = "applying".to_string();
            update.stage = Some("installing".to_string());
            update.error_message = None;
        }
        publish_update_state(&app, &state);

        if let Err(error) = spawn_updater_host(&job) {
            if let Ok(mut update) = state.update_state.lock() {
                update.status = "error".to_owned();
                update.stage = None;
                update.error_message = Some(error.clone());
            }
            publish_update_state(&app, &state);
            return Err(error);
        }
        if let Some(window) = app.get_webview_window("main") {
            crate::save_window_state(&window);
        }
        app.exit(0);
        return Ok(());
    }
    #[cfg(not(windows))]
    {
        let _ = (app, theme, accent, accent_secondary, language, installer);
        Err("Автоматическая установка этой сборки пока поддерживается только в Windows".to_string())
    }
}

#[cfg(windows)]
#[repr(C)]
#[derive(Default, Copy, Clone)]
struct IoCounters {
    read_operation_count: u64,
    write_operation_count: u64,
    other_operation_count: u64,
    read_transfer_count: u64,
    write_transfer_count: u64,
    other_transfer_count: u64,
}

#[cfg(windows)]
#[link(name = "kernel32")]
extern "system" {
    fn OpenProcess(desired_access: u32, inherit_handle: i32, process_id: u32) -> isize;
    fn WaitForSingleObject(handle: isize, milliseconds: u32) -> u32;
    fn GetProcessIoCounters(process: isize, io_counters: *mut IoCounters) -> i32;
    fn CloseHandle(object: isize) -> i32;
}

#[cfg(windows)]
async fn wait_for_parent_exit(pid: u32) {
    if pid == 0 {
        return;
    }
    let _ = tokio::task::spawn_blocking(move || unsafe {
        const SYNCHRONIZE: u32 = 0x0010_0000;
        let handle = OpenProcess(SYNCHRONIZE, 0, pid);
        if handle != 0 {
            let _ = WaitForSingleObject(handle, 25_000);
            let _ = CloseHandle(handle);
        }
    })
    .await;
}

fn format_transfer_mb(bytes: u64, is_en: bool) -> String {
    let mb = bytes as f64 / (1024.0 * 1024.0);
    if is_en {
        format!("{mb:.1} MB")
    } else {
        format!("{mb:.1} МБ")
    }
}

fn format_transfer_speed(bps: u64, is_en: bool) -> String {
    if bps >= 1024 * 1024 {
        let mbps = bps as f64 / (1024.0 * 1024.0);
        if is_en {
            format!("{mbps:.1} MB/s")
        } else {
            format!("{mbps:.1} МБ/с")
        }
    } else {
        let kbps = (bps / 1024).max(1);
        if is_en {
            format!("{kbps} KB/s")
        } else {
            format!("{kbps} КБ/с")
        }
    }
}

const MAX_INSTALLER_BYTES: u64 = 200 * 1024 * 1024;

fn installer_download_size(content_length: Option<u64>, asset_size: u64) -> Result<u64, ()> {
    if content_length.is_some_and(|length| length == 0 ||
        (asset_size != 0 && length != asset_size)) {
        return Err(());
    }
    let total = content_length.unwrap_or(asset_size);
    if total > MAX_INSTALLER_BYTES {
        return Err(());
    }
    Ok(total)
}

fn compute_download_stage_progress(downloaded: u64, total: u64) -> u32 {
    if total == 0 {
        return 4;
    }
    let ratio = (downloaded.min(total) as f64) / (total as f64);
    (4.0 + ratio * 66.0).round().clamp(4.0, 70.0) as u32
}

fn compute_install_stage_progress(read_bytes: u64, installer_size: u64, exe_replaced: bool) -> u32 {
    if exe_replaced {
        return 93;
    }
    if installer_size == 0 {
        return 78;
    }
    let ratio = (read_bytes as f64 / installer_size as f64).clamp(0.0, 1.0);
    (78.0 + ratio * 14.0).round().clamp(78.0, 92.0) as u32
}

fn save_updater_progress(rt: &UpdaterRuntime, mut payload: Value) {
    if let Ok(mut guard) = rt.snapshot.lock() {
        payload["sequence"] = json!(guard["sequence"].as_u64().unwrap_or(0) + 1);
        *guard = payload;
    }
}

async fn resolve_expected_sha256(
    client: &reqwest::Client,
    job: &UpdaterJob,
    is_en: bool,
) -> Result<String, String> {
    if job.sha256.len() == 64
        && job
            .sha256
            .chars()
            .all(|character| character.is_ascii_hexdigit())
    {
        return Ok(job.sha256.to_ascii_lowercase());
    }
    if !job.sha_url.is_empty() && valid_update_asset_url(&job.sha_url) {
        let response = client
            .get(&job.sha_url)
            .send()
            .await
            .map_err(|error| {
                if is_en {
                    format!("Failed to download checksum: {error}")
                } else {
                    format!("Не удалось скачать контрольную сумму: {error}")
                }
            })?;
        if !response.status().is_success() {
            return Err(if is_en {
                format!("GitHub returned HTTP {} for checksum", response.status().as_u16())
            } else {
                format!(
                    "GitHub вернул HTTP {} для контрольной суммы",
                    response.status().as_u16()
                )
            });
        }
        let text = response.text().await.map_err(|error| error.to_string())?;
        return text
            .split_whitespace()
            .find(|token| {
                token.len() == 64 && token.chars().all(|character| character.is_ascii_hexdigit())
            })
            .map(str::to_ascii_lowercase)
            .ok_or_else(|| {
                if is_en {
                    "Checksum file format is invalid.".to_string()
                } else {
                    "Файл контрольной суммы имеет неверный формат.".to_string()
                }
            });
    }
    Err(if is_en {
        "Release is missing a SHA-256 checksum.".to_string()
    } else {
        "В релизе отсутствует SHA-256 контрольная сумма.".to_string()
    })
}

async fn execute_updater_job(app: AppHandle, rt: Arc<UpdaterRuntime>) {
    if rt.running.swap(true, Ordering::AcqRel) {
        return;
    }
    let job = rt.job.lock().map(|g| g.clone()).unwrap_or_default();
    let is_en = job.language.eq_ignore_ascii_case("en");

    let send = |stage: &str,
                progress: u32,
                message: Option<&str>,
                detail: Option<String>,
                error: Option<String>| {
        save_updater_progress(
            &rt,
            json!({
                "fromVersion": job.from_version,
                "toVersion": job.to_version,
                "theme": job.theme,
                "accent": job.accent,
                "accentSecondary": job.accent_secondary,
                "language": job.language,
                "stage": stage,
                "progress": progress,
                "indeterminate": stage == "downloading" && progress == 4,
                "message": message,
                "detail": detail,
                "error": error,
            }),
        );
    };

    // 1. Wait for the main Vortex process to exit cleanly.
    send("closing", 2, None, None, None);
    #[cfg(windows)]
    wait_for_parent_exit(job.parent_pid).await;
    send("closing", 4, None, None, None);

    let updates_root = update_dir();
    let installer_path =
        match validate_installer_path_in_dir(&job.installer_path, &job.asset_name, &updates_root) {
            Ok(path) => path,
            Err(_) => {
                rt.running.store(false, Ordering::Release);
                send(
                    "error",
                    4,
                    None,
                    None,
                    Some(if is_en {
                        "Invalid or untrusted installer path.".to_string()
                    } else {
                        "Некорректный или небезопасный путь установщика.".to_string()
                    }),
                );
                return;
            }
        };
    let app_path = match validate_app_path_against_updates(&job.app_path, &updates_root) {
        Ok(path) => path,
        Err(_) => {
            rt.running.store(false, Ordering::Release);
            send(
                "error",
                4,
                None,
                None,
                Some(if is_en {
                    "Invalid or untrusted target application path.".to_string()
                } else {
                    "Некорректный или небезопасный путь запуска Vortex.".to_string()
                }),
            );
            return;
        }
    };

    let client = match reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .read_timeout(Duration::from_secs(25))
        .user_agent(concat!("Vortex/", env!("CARGO_PKG_VERSION")))
        .build()
    {
        Ok(c) => c,
        Err(err) => {
            rt.running.store(false, Ordering::Release);
            send("error", 4, None, None, Some(err.to_string()));
            return;
        }
    };

    // 2. Real streaming download from GitHub (if installer is not already on disk).
    let partial_path = installer_path.with_extension("exe.part");
    let mut downloaded_hash: Option<String> = None;

    if !installer_path.is_file() {
        if !valid_update_asset_url(&job.asset_url) {
            rt.running.store(false, Ordering::Release);
            send(
                "error",
                4,
                None,
                None,
                Some(if is_en {
                    "Installer download URL is missing or untrusted.".to_string()
                } else {
                    "Ссылка на загрузку установщика отсутствует или небезопасна.".to_string()
                }),
            );
            return;
        }
        if let Some(parent) = installer_path.parent() {
            let _ = tokio::fs::create_dir_all(parent).await;
        }
        send("downloading", 4, None, None, None);
        let mut response = match client.get(&job.asset_url).send().await {
            Ok(resp) => resp,
            Err(err) => {
                rt.running.store(false, Ordering::Release);
                send(
                    "error",
                    4,
                    None,
                    None,
                    Some(if is_en {
                        format!("Failed to download update: {err}")
                    } else {
                        format!("Не удалось скачать обновление: {err}")
                    }),
                );
                return;
            }
        };
        if !response.status().is_success() {
            rt.running.store(false, Ordering::Release);
            send(
                "error",
                4,
                None,
                None,
                Some(if is_en {
                    format!("GitHub returned HTTP {}", response.status().as_u16())
                } else {
                    format!("GitHub вернул HTTP {} при скачивании", response.status().as_u16())
                }),
            );
            return;
        }
        let total = match installer_download_size(response.content_length(), job.asset_size) {
            Ok(size) => size,
            Err(()) => {
                rt.running.store(false, Ordering::Release);
                send(
                    "error", 4, None, None,
                    Some(if is_en {
                        "The installer size is inconsistent or exceeds 200 MB.".to_string()
                    } else {
                        "Размер установщика не совпадает с релизом или превышает 200 МБ.".to_string()
                    }),
                );
                return;
            }
        };

        let mut file = match tokio::fs::File::create(&partial_path).await {
            Ok(f) => f,
            Err(err) => {
                rt.running.store(false, Ordering::Release);
                send("error", 4, None, None, Some(err.to_string()));
                return;
            }
        };
        let mut downloaded = 0u64;
        let mut hasher = Sha256::new();
        let started_at = Instant::now();
        let mut window_at = Instant::now();
        let mut window_bytes = 0u64;
        let mut smoothed_bps = 0.0f64;
        let mut last_emit = Instant::now() - Duration::from_millis(200);

        loop {
            match response.chunk().await {
                Ok(Some(chunk)) => {
                    let len = chunk.len() as u64;
                    downloaded = downloaded.saturating_add(len);
                    window_bytes = window_bytes.saturating_add(len);
                    if downloaded > MAX_INSTALLER_BYTES || (total > 0 && downloaded > total) {
                        drop(file);
                        let _ = tokio::fs::remove_file(&partial_path).await;
                        rt.running.store(false, Ordering::Release);
                        send(
                            "error",
                            4,
                            None,
                            None,
                            Some(if is_en {
                                "Downloaded file size did not match expected length.".to_string()
                            } else {
                                "Размер загруженного файла не совпал с ожидаемым.".to_string()
                            }),
                        );
                        return;
                    }
                    hasher.update(&chunk);
                    if let Err(err) = file.write_all(&chunk).await {
                        drop(file);
                        let _ = tokio::fs::remove_file(&partial_path).await;
                        rt.running.store(false, Ordering::Release);
                        send("error", 4, None, None, Some(err.to_string()));
                        return;
                    }

                    let win_secs = window_at.elapsed().as_secs_f64();
                    if win_secs >= 0.35 {
                        let inst_bps = window_bytes as f64 / win_secs;
                        smoothed_bps = if smoothed_bps <= 0.0 {
                            inst_bps
                        } else {
                            smoothed_bps * 0.55 + inst_bps * 0.45
                        };
                        window_bytes = 0;
                        window_at = Instant::now();
                    }

                    if last_emit.elapsed() >= Duration::from_millis(75) || downloaded == total {
                        last_emit = Instant::now();
                        let display_bps = if smoothed_bps > 0.0 {
                            smoothed_bps as u64
                        } else {
                            let elapsed = started_at.elapsed().as_secs_f64().max(0.05);
                            (downloaded as f64 / elapsed) as u64
                        };
                        let pct = compute_download_stage_progress(downloaded, total);
                        let amount = format_transfer_mb(downloaded, is_en);
                        let speed = format_transfer_speed(display_bps, is_en);
                        let detail = if total > 0 {
                            let percent = downloaded * 100 / total;
                            format!("{percent}% · {amount} / {} · {speed}", format_transfer_mb(total, is_en))
                        } else {
                            format!("{amount} · {speed}")
                        };
                        send("downloading", pct, None, Some(detail), None);
                    }
                }
                Ok(None) => break,
                Err(err) => {
                    drop(file);
                    let _ = tokio::fs::remove_file(&partial_path).await;
                    rt.running.store(false, Ordering::Release);
                    send(
                        "error",
                        compute_download_stage_progress(downloaded, total),
                        None,
                        None,
                        Some(if is_en {
                            format!("Download interrupted: {err}")
                        } else {
                            format!("Загрузка прервана: {err}")
                        }),
                    );
                    return;
                }
            }
        }

        if let Err(err) = file.flush().await {
            drop(file);
            let _ = tokio::fs::remove_file(&partial_path).await;
            rt.running.store(false, Ordering::Release);
            send("error", 70, None, None, Some(err.to_string()));
            return;
        }
        drop(file);
        if downloaded == 0 || (total > 0 && downloaded != total) {
            let _ = tokio::fs::remove_file(&partial_path).await;
            rt.running.store(false, Ordering::Release);
            send(
                "error",
                compute_download_stage_progress(downloaded, total),
                None,
                None,
                Some(if is_en {
                    "Installer download ended before reaching full file size.".to_string()
                } else {
                    "Загрузка установщика завершилась не полностью.".to_string()
                }),
            );
            return;
        }
        downloaded_hash = Some(format!("{:x}", hasher.finalize()));
        send("downloading", 70, None, Some(format_transfer_mb(downloaded, is_en)), None);
    } else {
        send("downloading", 70, None, None, None);
    }

    // 3. Real SHA-256 verification.
    send("verifying", 71, None, None, None);
    let verified_partial = downloaded_hash.is_some();
    let actual_hash = match downloaded_hash {
        Some(h) => h,
        None => {
            let file_size = tokio::fs::metadata(&installer_path)
                .await
                .map(|m| m.len())
                .unwrap_or(0);
            let mut file = match tokio::fs::File::open(&installer_path).await {
                Ok(f) => f,
                Err(err) => {
                    rt.running.store(false, Ordering::Release);
                    send("error", 71, None, None, Some(err.to_string()));
                    return;
                }
            };
            let mut hasher = Sha256::new();
            let mut buf = vec![0u8; 256 * 1024];
            let mut hashed = 0u64;
            let mut last_emit = Instant::now() - Duration::from_millis(200);
            loop {
                match file.read(&mut buf).await {
                    Ok(0) => break,
                    Ok(n) => {
                        hasher.update(&buf[..n]);
                        hashed = hashed.saturating_add(n as u64);
                        if file_size > 0
                            && (last_emit.elapsed() >= Duration::from_millis(60)
                                || hashed >= file_size)
                        {
                            last_emit = Instant::now();
                            let pct = 71
                                + ((hashed.min(file_size) as f64 / file_size as f64) * 5.0).round()
                                    as u32;
                            let detail = format!(
                                "SHA-256 · {} / {}",
                                format_transfer_mb(hashed, is_en),
                                format_transfer_mb(file_size, is_en)
                            );
                            send("verifying", pct.min(76), None, Some(detail), None);
                        }
                    }
                    Err(err) => {
                        rt.running.store(false, Ordering::Release);
                        send("error", 72, None, None, Some(err.to_string()));
                        return;
                    }
                }
            }
            format!("{:x}", hasher.finalize())
        }
    };

    match resolve_expected_sha256(&client, &job, is_en).await {
        Ok(expected_hash) => {
            if actual_hash != expected_hash {
                let _ = tokio::fs::remove_file(&partial_path).await;
                let _ = tokio::fs::remove_file(&installer_path).await;
                rt.running.store(false, Ordering::Release);
                send(
                    "error",
                    76,
                    None,
                    None,
                    Some(if is_en {
                        "Installer SHA-256 checksum mismatch. Update cancelled for safety."
                            .to_string()
                    } else {
                        "Контрольная сумма SHA-256 установщика не совпала с релизом.".to_string()
                    }),
                );
                return;
            }
        }
        Err(err) => {
            let _ = tokio::fs::remove_file(&partial_path).await;
            let _ = tokio::fs::remove_file(&installer_path).await;
            rt.running.store(false, Ordering::Release);
            send("error", 76, None, None, Some(err));
            return;
        }
    }

    if verified_partial {
        if let Err(err) = tokio::fs::rename(&partial_path, &installer_path).await {
            rt.running.store(false, Ordering::Release);
            send("error", 77, None, None, Some(err.to_string()));
            return;
        }
    }
    send(
        "verifying",
        78,
        None,
        Some(if is_en {
            "SHA-256 verified".to_string()
        } else {
            "SHA-256 подтверждён".to_string()
        }),
        None,
    );

    // 4. Real NSIS installation tracked via Win32 GetProcessIoCounters + exe replacement check.
    let installer_size = tokio::fs::metadata(&installer_path)
        .await
        .map(|m| m.len())
        .unwrap_or(0);
    let old_exe_mtime = tokio::fs::metadata(&app_path)
        .await
        .and_then(|m| m.modified())
        .ok();

    send("installing", 78, None, None, None);
    let spawn_result = tokio::process::Command::new(&installer_path)
        .args(["/S", "/UPDATE"])
        .spawn();
    let mut child = match spawn_result {
        Ok(c) => c,
        Err(err) => {
            rt.running.store(false, Ordering::Release);
            send(
                "error",
                78,
                None,
                None,
                Some(format!(
                    "{}: {err}",
                    if is_en {
                        "Failed to launch installer"
                    } else {
                        "Не удалось запустить установщик"
                    }
                )),
            );
            return;
        }
    };

    #[cfg(windows)]
    let proc_handle: isize = child
        .id()
        .map(|pid| unsafe {
            const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;
            OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid)
        })
        .unwrap_or(0);

    let mut current_pct: u32 = 78;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break Ok(status),
            Ok(None) => {
                #[cfg(windows)]
                let io = if proc_handle != 0 {
                    let mut counters = IoCounters::default();
                    let ok = unsafe { GetProcessIoCounters(proc_handle, &mut counters) };
                    if ok != 0 {
                        Some(counters)
                    } else {
                        None
                    }
                } else {
                    None
                };
                #[cfg(not(windows))]
                let io: Option<()> = None;

                let new_exe_mtime = tokio::fs::metadata(&app_path)
                    .await
                    .and_then(|m| m.modified())
                    .ok();
                let exe_replaced =
                    new_exe_mtime.is_some() && new_exe_mtime != old_exe_mtime;

                #[cfg(windows)]
                let (read_bytes, write_bytes) = io
                    .map(|c| (c.read_transfer_count, c.write_transfer_count))
                    .unwrap_or((0, 0));
                #[cfg(not(windows))]
                let (read_bytes, write_bytes) = {
                    let _ = io;
                    (0u64, 0u64)
                };

                let measured_pct =
                    compute_install_stage_progress(read_bytes, installer_size, exe_replaced);
                if measured_pct > current_pct {
                    current_pct = measured_pct;
                }
                let detail = if exe_replaced {
                    Some(if is_en {
                        "Finalizing installation…".to_string()
                    } else {
                        "Завершаем установку…".to_string()
                    })
                } else if write_bytes > 0 {
                    Some(if is_en {
                        format!("Extracted: {}", format_transfer_mb(write_bytes, true))
                    } else {
                        format!("Распаковано: {}", format_transfer_mb(write_bytes, false))
                    })
                } else {
                    None
                };
                send("installing", current_pct, None, detail, None);
                tokio::time::sleep(Duration::from_millis(120)).await;
            }
            Err(err) => break Err(err),
        }
    };

    #[cfg(windows)]
    if proc_handle != 0 {
        unsafe {
            let _ = CloseHandle(proc_handle);
        }
    }

    match status {
        Ok(exit) if exit.success() => {}
        Ok(exit) => {
            rt.running.store(false, Ordering::Release);
            send(
                "error",
                current_pct,
                None,
                None,
                Some(if is_en {
                    format!("Installer exited with code {:?}", exit.code())
                } else {
                    format!("Установщик завершился с ошибкой (код {:?})", exit.code())
                }),
            );
            return;
        }
        Err(err) => {
            rt.running.store(false, Ordering::Release);
            send("error", current_pct, None, None, Some(err.to_string()));
            return;
        }
    }

    // 5. Launch the updated Vortex executable.
    send("launching", 96, None, None, None);
    tokio::time::sleep(Duration::from_millis(250)).await;

    if let Err(err) = std::process::Command::new(&app_path).spawn() {
        rt.running.store(false, Ordering::Release);
        send(
            "error",
            96,
            None,
            None,
            Some(format!(
                "{}: {err}",
                if is_en {
                    "Updated, but failed to restart Vortex"
                } else {
                    "Обновление установлено, но не удалось перезапустить Vortex"
                }
            )),
        );
        return;
    }

    send("done", 100, None, None, None);
    tokio::time::sleep(Duration::from_millis(650)).await;
    app.exit(0);
}

#[tauri::command]
fn updater_ready(app: AppHandle, rt: tauri::State<'_, Arc<UpdaterRuntime>>) -> Result<Value, String> {
    if !rt.started.swap(true, Ordering::AcqRel) {
        // A cold WebView2 startup can otherwise miss even an entire update.
        spawn_updater_run(app, rt.inner().clone());
    }
    let snap = rt.snapshot.lock().map_err(|e| e.to_string())?.clone();
    if !snap.is_null() {
        return Ok(snap);
    }
    let job = rt.job.lock().map_err(|e| e.to_string())?.clone();
    Ok(json!({
        "fromVersion": job.from_version,
        "toVersion": job.to_version,
        "theme": job.theme,
        "accent": job.accent,
        "accentSecondary": job.accent_secondary,
        "language": job.language,
        "stage": "closing",
        "progress": 2,
        "sequence": 0,
    }))
}

#[tauri::command]
fn updater_retry(app: AppHandle, rt: tauri::State<'_, Arc<UpdaterRuntime>>) {
    spawn_updater_run(app, rt.inner().clone());
}

fn spawn_updater_run(app: AppHandle, rt: Arc<UpdaterRuntime>) {
    tauri::async_runtime::spawn(async move {
        if rt.preview {
            execute_updater_preview(app, rt).await;
        } else {
            execute_updater_job(app, rt).await;
        }
    });
}

#[tauri::command]
fn updater_close(app: AppHandle) {
    app.exit(0);
}

/// Standalone Tauri entry point when launched with `--updater-mode`.
pub fn run_updater_mode() {
    let job: UpdaterJob = std::fs::read_to_string(updater_job_path())
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default();
    run_updater_window(job, false);
}

/// Safe preview mode triggered via `--test-updater` so the developer can inspect
/// the Updater Window animation and styling without touching installed files.
pub fn run_updater_preview_mode() {
    let job = UpdaterJob {
        from_version: env!("CARGO_PKG_VERSION").to_string(),
        to_version: "1.3.5".to_string(),
        theme: "dark".to_string(),
        accent: "#a68bff".to_string(),
        accent_secondary: "#5b3fd6".to_string(),
        language: "ru".to_string(),
        ..UpdaterJob::default()
    };
    run_updater_window(job, true);
}

fn run_updater_window(job: UpdaterJob, preview: bool) {
    let rt = Arc::new(UpdaterRuntime {
        job: Mutex::new(job),
        preview,
        ..UpdaterRuntime::default()
    });

    tauri::Builder::default()
        .manage(rt)
        .setup(move |app| {
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.destroy();
            }
            let _updater =
                WebviewWindowBuilder::new(app, "updater", WebviewUrl::App("updater.html".into()))
                    .title(if preview { "Vortex Updater Preview" } else { "Vortex Updater" })
                    .inner_size(480.0, 356.0)
                    .decorations(false)
                    .transparent(true)
                    .shadow(false)
                    .resizable(false)
                    .always_on_top(true)
                    .center()
                    .visible(true)
                    .build()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            updater_ready,
            updater_retry,
            updater_close,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Vortex updater");
}

async fn execute_updater_preview(app: AppHandle, rt: Arc<UpdaterRuntime>) {
    if rt.running.swap(true, Ordering::AcqRel) {
        return;
    }
    let job = crate::state::lock_or_recover(&rt.job).clone();
    let steps = [
        ("closing", 4, None, 450),
        ("downloading", 18, Some("2.6 / 12.4 МБ · 5.4 МБ/с"), 380),
        ("downloading", 38, Some("6.4 / 12.4 МБ · 6.1 МБ/с"), 380),
        ("downloading", 58, Some("10.1 / 12.4 МБ · 6.3 МБ/с"), 380),
        ("downloading", 70, Some("12.4 / 12.4 МБ · 6.2 МБ/с"), 320),
        ("verifying", 78, Some("SHA-256 подтверждён"), 500),
        ("installing", 84, Some("Распаковано: 11.2 МБ"), 550),
        ("installing", 93, Some("Завершаем установку…"), 550),
        ("launching", 96, None, 450),
        ("done", 100, None, 1000),
    ];
    for (stage, progress, detail, wait_ms) in steps {
        save_updater_progress(
            &rt,
            json!({
                "fromVersion": job.from_version,
                "toVersion": job.to_version,
                "theme": job.theme,
                "accent": job.accent,
                "accentSecondary": job.accent_secondary,
                "language": job.language,
                "stage": stage,
                "progress": progress,
                "detail": detail,
            }),
        );
        tokio::time::sleep(Duration::from_millis(wait_ms)).await;
    }
    app.exit(0);
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cmp::Ordering;

    #[test]
    fn compare_versions_handles_semver_and_prereleases() {
        assert_eq!(compare_versions("1.3.0", "1.3.1"), Ordering::Less);
        assert_eq!(compare_versions("v1.3.1", "1.3.1"), Ordering::Equal);
        assert_eq!(compare_versions("1.3.1+build.42", "1.3.1"), Ordering::Equal);
        assert_eq!(compare_versions("1.3.1-beta.1", "1.3.1"), Ordering::Less);
        assert_eq!(compare_versions("1.3.1", "1.3.1-rc.1"), Ordering::Greater);
        assert_eq!(compare_versions("1.3.1-alpha.1", "1.3.1-beta.1"), Ordering::Less);
        assert_eq!(compare_versions("1.3.1-beta.2", "1.3.1-beta.10"), Ordering::Less);
        assert_eq!(compare_versions("1.3.0.1", "1.3.1"), Ordering::Less);
        assert_eq!(compare_versions("1.4.0", "1.3.9"), Ordering::Greater);
    }

    #[test]
    fn valid_update_asset_url_accepts_only_official_release_downloads() {
        assert!(valid_update_asset_url(
            "https://github.com/mozrg/Vortex/releases/download/v1.3.1/Vortex.Launcher.Setup.1.3.1.exe"
        ));
        assert!(!valid_update_asset_url(
            "https://evil.example/mozrg/Vortex/releases/download/v1.3.1/setup.exe"
        ));
        assert!(!valid_update_asset_url(
            "http://github.com/mozrg/Vortex/releases/download/v1.3.1/setup.exe"
        ));
    }

    #[test]
    fn safe_update_filename_sanitizes_and_requires_exe() {
        assert_eq!(
            safe_update_filename("Vortex.Launcher.Setup.1.3.1.exe").as_deref(),
            Some("Vortex.Launcher.Setup.1.3.1.exe")
        );
        assert_eq!(
            safe_update_filename("../bad\\path/setup.exe").as_deref(),
            Some("..badpathsetup.exe")
        );
        assert!(safe_update_filename("Vortex.Launcher.Setup.1.3.1.msi").is_none());
        assert!(safe_update_filename("").is_none());
    }

    #[test]
    fn real_updater_progress_helpers_are_bounded_and_monotonic() {
        assert_eq!(compute_download_stage_progress(0, 1000), 4);
        assert_eq!(compute_download_stage_progress(500, 1000), 37);
        assert_eq!(compute_download_stage_progress(1000, 1000), 70);
        assert_eq!(compute_download_stage_progress(1500, 1000), 70);

        assert_eq!(compute_install_stage_progress(0, 10_000, false), 78);
        assert_eq!(compute_install_stage_progress(5_000, 10_000, false), 85);
        assert_eq!(compute_install_stage_progress(10_000, 10_000, false), 92);
        assert_eq!(compute_install_stage_progress(2_000, 10_000, true), 93);

        assert_eq!(format_transfer_mb(5 * 1024 * 1024, false), "5.0 МБ");
        assert_eq!(format_transfer_speed(2 * 1024 * 1024, true), "2.0 MB/s");
        assert_eq!(format_transfer_speed(512 * 1024, false), "512 КБ/с");
    }

    #[test]
    fn download_size_uses_release_metadata_and_handles_unknown_lengths() {
        assert_eq!(installer_download_size(None, 10_000), Ok(10_000));
        assert_eq!(installer_download_size(Some(10_000), 10_000), Ok(10_000));
        assert_eq!(installer_download_size(None, 0), Ok(0));
        assert_eq!(installer_download_size(Some(0), 0), Err(()));
        assert_eq!(installer_download_size(Some(9_999), 10_000), Err(()));
        assert_eq!(installer_download_size(None, MAX_INSTALLER_BYTES + 1), Err(()));
    }

    #[test]
    fn updater_path_validators_reject_traversal_and_untrusted_binaries() {
        let updates = PathBuf::from(r"C:\Users\Test\AppData\Roaming\vortex-roblox-launcher\updates");

        let ok_installer = validate_installer_path_in_dir(
            r"C:\Users\Test\AppData\Roaming\vortex-roblox-launcher\updates\Vortex.Launcher.Setup.1.3.3.exe",
            "Vortex.Launcher.Setup.1.3.3.exe",
            &updates,
        );
        assert_eq!(
            ok_installer.unwrap(),
            updates.join("Vortex.Launcher.Setup.1.3.3.exe")
        );

        assert!(validate_installer_path_in_dir(
            r"C:\Windows\System32\cmd.exe",
            "Vortex.Setup.exe",
            &updates
        )
        .is_err());
        assert!(validate_installer_path_in_dir(
            r"C:\Users\Test\AppData\Roaming\vortex-roblox-launcher\updates\..\evil.exe",
            "",
            &updates
        )
        .is_err());
        assert!(validate_installer_path_in_dir(
            r"C:\Users\Test\AppData\Roaming\vortex-roblox-launcher\updates\vortex-updater.exe",
            "",
            &updates
        )
        .is_err());

        assert!(validate_app_path_against_updates(
            r"C:\Users\Test\AppData\Local\Vortex Launcher\vortex-launcher.exe",
            &updates
        )
        .is_ok());
        assert!(validate_app_path_against_updates(r"C:\Windows\System32\cmd.exe", &updates).is_err());
        assert!(validate_app_path_against_updates(
            r"C:\Users\Test\AppData\Roaming\vortex-roblox-launcher\updates\vortex-launcher.exe",
            &updates
        )
        .is_err());
        assert!(validate_app_path_against_updates(
            r"C:\Users\Test\..\Vortex\vortex-launcher.exe",
            &updates
        )
        .is_err());
    }
}
