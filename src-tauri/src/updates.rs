use crate::state::{AppState, PendingUpdate};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tokio::io::AsyncWriteExt;

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
    if final_state.status == "available" && pending_update.is_some() {
        let download_app = app.clone();
        let download_state = state.clone();
        tauri::async_runtime::spawn(async move {
            let _ = download_update_inner(download_app, download_state).await;
        });
    }
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
        let total = response.content_length().unwrap_or(0);
        if total == 0 || total > 200 * 1024 * 1024 {
            return Err("Размер установщика отсутствует или превышает 200 МБ".to_string());
        }
        {
            let mut update = state
                .update_state
                .lock()
                .map_err(|_| "update state unavailable".to_string())?;
            update.status = "downloading".to_string();
            update.progress = 0;
            update.stage = Some("downloading".to_string());
        }
        publish_update_state(&app, &state);

        let mut file = tokio::fs::File::create(&partial_path)
            .await
            .map_err(|error| format!("Не удалось создать файл обновления: {error}"))?;
        let mut downloaded = 0u64;
        let mut hasher = Sha256::new();
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|error| format!("Ошибка загрузки установщика: {error}"))?
        {
            downloaded = downloaded.saturating_add(chunk.len() as u64);
            if downloaded > total || downloaded > 200 * 1024 * 1024 {
                return Err("Размер загруженного файла не совпал с ожидаемым".to_string());
            }
            hasher.update(&chunk);
            file.write_all(&chunk)
                .await
                .map_err(|error| format!("Не удалось записать установщик: {error}"))?;
            let progress = ((downloaded.saturating_mul(100) / total).min(99)) as u32;
            {
                let mut update = state
                    .update_state
                    .lock()
                    .map_err(|_| "update state unavailable".to_string())?;
                update.status = "downloading".to_string();
                update.progress = progress;
                update.stage = Some("downloading".to_string());
            }
            publish_update_state(&app, &state);
        }
        file.flush()
            .await
            .map_err(|error| format!("Не удалось завершить запись установщика: {error}"))?;
        if downloaded != total {
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

#[cfg(windows)]
fn write_update_apply_script(installer: &std::path::Path) -> Result<PathBuf, String> {
    let script_path = update_dir().join("apply-update.ps1");
    let installer = installer
        .to_str()
        .ok_or_else(|| "Invalid installer path".to_string())?;
    let installer = installer.replace('\'', "''");
    let app_path = std::env::current_exe().map_err(|error| error.to_string())?;
    let app_path = app_path
        .to_str()
        .ok_or_else(|| "Invalid application path".to_string())?
        .replace('\'', "''");
    let script = format!(
        "$ErrorActionPreference = 'Stop'\n$installer = '{installer}'\n$app = '{app_path}'\n$deadline = (Get-Date).AddMinutes(3)\ndo {{\n  Start-Sleep -Milliseconds 400\n  $running = Get-Process -Name 'vortex-launcher' -ErrorAction SilentlyContinue | Where-Object {{ $_.Path -eq $app }}\n}} while ($running -and (Get-Date) -lt $deadline)\nif ($running) {{ exit 2 }}\n$p = Start-Process -FilePath $installer -ArgumentList @('/S', '/UPDATE') -PassThru -Wait\nif ($p.ExitCode -ne 0) {{ exit $p.ExitCode }}\nStart-Sleep -Seconds 2\nStart-Process -FilePath $app\n"
    );
    std::fs::write(&script_path, script).map_err(|error| error.to_string())?;
    Ok(script_path)
}

#[cfg(windows)]
fn spawn_update_apply(script: &std::path::Path) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    std::process::Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-WindowStyle",
            "Hidden",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
        ])
        .arg(script)
        .creation_flags(CREATE_NO_WINDOW | 0x00000200)
        .spawn()
        .map_err(|error| format!("Не удалось запустить установщик: {error}"))?;
    Ok(())
}

#[tauri::command]
pub async fn updates_get_state(
    state: tauri::State<'_, Arc<AppState>>,
) -> Result<serde_json::Value, String> {
    let update_state = state.update_state.lock().unwrap();
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
    installer_path: String,
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
    running: AtomicBool,
    snapshot: Mutex<Value>,
}

fn updater_job_path() -> PathBuf {
    update_dir().join("updater-job.json")
}

fn updater_host_exe_path() -> PathBuf {
    update_dir().join("vortex-updater.exe")
}

/// Remove temporary updater binary/job left behind after a completed update.
pub fn cleanup_updater_artifacts() {
    let _ = std::fs::remove_file(updater_host_exe_path());
    let _ = std::fs::remove_file(updater_job_path());
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
        .ok_or_else(|| "Сначала скачай обновление".to_string())?;
    let installer = pending
        .path
        .filter(|path| path.is_file())
        .ok_or_else(|| "Проверенный установщик не найден".to_string())?;
    #[cfg(windows)]
    {
        let current_exe = std::env::current_exe().map_err(|error| error.to_string())?;
        let job = UpdaterJob {
            installer_path: installer.to_string_lossy().to_string(),
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
            update.progress = 100;
            update.stage = Some("installing".to_string());
            update.error_message = None;
        }
        publish_update_state(&app, &state);

        // Prefer our dedicated Vortex Updater UI window; fall back to the
        // legacy PowerShell helper if copying the executable is blocked.
        if spawn_updater_host(&job).is_err() {
            let script = write_update_apply_script(&installer)?;
            spawn_update_apply(&script)?;
        }
        if let Some(window) = app.get_webview_window("main") {
            crate::save_window_state(&window);
        }
        app.exit(0);
        return Ok(());
    }
    #[cfg(not(windows))]
    {
        let _ = (app, theme, accent, accent_secondary, language);
        Err("Автоматическая установка этой сборки пока поддерживается только в Windows".to_string())
    }
}

#[cfg(windows)]
#[link(name = "kernel32")]
extern "system" {
    fn OpenProcess(desired_access: u32, inherit_handle: i32, process_id: u32) -> isize;
    fn WaitForSingleObject(handle: isize, milliseconds: u32) -> u32;
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

fn emit_updater_progress(app: &AppHandle, rt: &UpdaterRuntime, payload: Value) {
    if let Ok(mut guard) = rt.snapshot.lock() {
        *guard = payload.clone();
    }
    let _ = app.emit("updater:progress", payload);
}

async fn execute_updater_job(app: AppHandle, rt: Arc<UpdaterRuntime>) {
    if rt.running.swap(true, Ordering::AcqRel) {
        return;
    }
    let job = rt.job.lock().map(|g| g.clone()).unwrap_or_default();
    let is_en = job.language.eq_ignore_ascii_case("en");

    let send = |stage: &str, progress: u32, message: Option<&str>, error: Option<String>| {
        emit_updater_progress(
            &app,
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
                "message": message,
                "error": error,
            }),
        );
    };

    send("closing", 12, None, None);
    #[cfg(windows)]
    wait_for_parent_exit(job.parent_pid).await;
    tokio::time::sleep(std::time::Duration::from_millis(250)).await;

    send("verifying", 28, None, None);
    let installer_path = PathBuf::from(&job.installer_path);
    if !installer_path.is_file() {
        rt.running.store(false, Ordering::Release);
        send(
            "error",
            28,
            None,
            Some(if is_en {
                "Verified installer file was not found.".to_string()
            } else {
                "Файл установщика не найден. Попробуй скачать обновление заново.".to_string()
            }),
        );
        return;
    }
    tokio::time::sleep(std::time::Duration::from_millis(250)).await;

    send("installing", 36, None, None);
    let spawn_result = tokio::process::Command::new(&installer_path)
        .args(["/S", "/UPDATE"])
        .spawn();
    let mut child = match spawn_result {
        Ok(c) => c,
        Err(err) => {
            rt.running.store(false, Ordering::Release);
            send(
                "error",
                36,
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

    let mut progress: f64 = 36.0;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break Ok(status),
            Ok(None) => {
                progress += (92.0 - progress) * 0.085;
                send("installing", progress.round() as u32, None, None);
                tokio::time::sleep(std::time::Duration::from_millis(220)).await;
            }
            Err(err) => break Err(err),
        }
    };

    match status {
        Ok(exit) if exit.success() => {}
        Ok(exit) => {
            rt.running.store(false, Ordering::Release);
            send(
                "error",
                progress.round() as u32,
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
            send("error", progress.round() as u32, None, Some(err.to_string()));
            return;
        }
    }

    send("launching", 96, None, None);
    tokio::time::sleep(std::time::Duration::from_millis(550)).await;

    let app_path = PathBuf::from(&job.app_path);
    if let Err(err) = std::process::Command::new(&app_path).spawn() {
        rt.running.store(false, Ordering::Release);
        send(
            "error",
            96,
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

    send("done", 100, None, None);
    tokio::time::sleep(std::time::Duration::from_millis(750)).await;
    app.exit(0);
}

#[tauri::command]
fn updater_ready(rt: tauri::State<'_, Arc<UpdaterRuntime>>) -> Result<Value, String> {
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
        "progress": 10,
    }))
}

#[tauri::command]
fn updater_retry(app: AppHandle, rt: tauri::State<'_, Arc<UpdaterRuntime>>) -> Result<(), String> {
    let rt_clone = rt.inner().clone();
    tauri::async_runtime::spawn(async move {
        execute_updater_job(app, rt_clone).await;
    });
    Ok(())
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
    let rt = Arc::new(UpdaterRuntime {
        job: Mutex::new(job),
        running: AtomicBool::new(false),
        snapshot: Mutex::new(Value::Null),
    });

    tauri::Builder::default()
        .manage(rt)
        .setup(|app| {
            // Close the hidden main window declared in tauri.conf.json so we
            // only host the lightweight updater UI.
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.destroy();
            }
            let _updater =
                WebviewWindowBuilder::new(app, "updater", WebviewUrl::App("updater.html".into()))
                    .title("Vortex Updater")
                    .inner_size(450.0, 336.0)
                    .decorations(false)
                    .transparent(true)
                    .shadow(false)
                    .resizable(false)
                    .always_on_top(true)
                    .center()
                    .visible(true)
                    .build()?;
            let handle = app.handle().clone();
            let state = app.state::<Arc<UpdaterRuntime>>().inner().clone();
            tauri::async_runtime::spawn(async move {
                execute_updater_job(handle, state).await;
            });
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

/// Safe preview mode triggered via `--test-updater` so the developer can inspect
/// the Updater Window animation and styling without touching installed files.
pub fn run_updater_preview_mode() {
    let job = UpdaterJob {
        from_version: env!("CARGO_PKG_VERSION").to_string(),
        to_version: "1.3.1".to_string(),
        theme: "dark".to_string(),
        accent: "#a68bff".to_string(),
        accent_secondary: "#5b3fd6".to_string(),
        language: "ru".to_string(),
        ..UpdaterJob::default()
    };
    let rt = Arc::new(UpdaterRuntime {
        job: Mutex::new(job.clone()),
        running: AtomicBool::new(true),
        snapshot: Mutex::new(Value::Null),
    });

    tauri::Builder::default()
        .manage(rt)
        .setup(move |app| {
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.destroy();
            }
            let _updater =
                WebviewWindowBuilder::new(app, "updater", WebviewUrl::App("updater.html".into()))
                    .title("Vortex Updater Preview")
                    .inner_size(450.0, 336.0)
                    .decorations(false)
                    .transparent(true)
                    .shadow(false)
                    .resizable(false)
                    .always_on_top(true)
                    .center()
                    .visible(true)
                    .build()?;
            let handle = app.handle().clone();
            let state = app.state::<Arc<UpdaterRuntime>>().inner().clone();
            let preview_job = job.clone();
            tauri::async_runtime::spawn(async move {
                let steps = [
                    ("closing", 16, 700),
                    ("verifying", 34, 700),
                    ("installing", 62, 850),
                    ("installing", 88, 850),
                    ("launching", 96, 650),
                    ("done", 100, 1200),
                ];
                for (stage, progress, wait_ms) in steps {
                    emit_updater_progress(
                        &handle,
                        &state,
                        json!({
                            "fromVersion": preview_job.from_version,
                            "toVersion": preview_job.to_version,
                            "theme": preview_job.theme,
                            "accent": preview_job.accent,
                            "accentSecondary": preview_job.accent_secondary,
                            "language": preview_job.language,
                            "stage": stage,
                            "progress": progress,
                        }),
                    );
                    tokio::time::sleep(std::time::Duration::from_millis(wait_ms)).await;
                }
                handle.exit(0);
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            updater_ready,
            updater_retry,
            updater_close,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Vortex updater preview");
}
