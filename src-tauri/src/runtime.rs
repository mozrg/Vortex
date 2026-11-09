//! What the local Roblox player is doing right now.
//!
//! Vortex can launch a place, but the user often joins a game from the Roblox
//! website or accepts a friend invite. Roblox writes a fresh log for every
//! session under `%LOCALAPPDATA%\Roblox\logs`; the newest log's creation time is
//! a good session start and its join lines name the place. Reading that log
//! gives an accurate "playing now" signal and an accurate end marker, instead
//! of counting time until the next Vortex launch.

use serde_json::{json, Value};
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom};
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const LIVE_LOG_WINDOW: Duration = Duration::from_secs(120);
const TAIL_BYTES: u64 = 512 * 1024;

fn millis(value: SystemTime) -> u64 {
    value
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn logs_dir() -> Option<PathBuf> {
    let local = std::env::var("LOCALAPPDATA").ok()?;
    let dir = PathBuf::from(local).join("Roblox").join("logs");
    dir.is_dir().then_some(dir)
}

/// Newest session log: (path, modified, created).
fn newest_log(dir: &PathBuf) -> Option<(PathBuf, SystemTime, SystemTime)> {
    let mut best: Option<(PathBuf, SystemTime, SystemTime)> = None;
    let mut visit = |path: PathBuf| {
        let Ok(meta) = fs::metadata(&path) else {
            return;
        };
        if !meta.is_file() || path.extension().and_then(|ext| ext.to_str()) != Some("log") {
            return;
        }
        // CrashHandler logs live next to the real Player log and are often the
        // newest file. They do not contain join lines, so including them made
        // the runtime look like "playing" with no place id.
        let name = path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("");
        if !name.contains("_Player_") {
            return;
        }
        let modified = meta.modified().unwrap_or(UNIX_EPOCH);
        let created = meta.created().unwrap_or(modified);
        if best
            .as_ref()
            .is_none_or(|(_, current_modified, _)| modified > *current_modified)
        {
            best = Some((path, modified, created));
        }
    };
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            visit(entry.path());
        }
    }
    let archive = dir.join("archive");
    if let Ok(entries) = fs::read_dir(archive) {
        for entry in entries.flatten() {
            visit(entry.path());
        }
    }
    best
}

fn tail_text(path: &PathBuf) -> String {
    let Ok(mut file) = File::open(path) else {
        return String::new();
    };
    let length = file.metadata().map(|meta| meta.len()).unwrap_or(0);
    if length > TAIL_BYTES {
        let _ = file.seek(SeekFrom::Start(length - TAIL_BYTES));
    }
    let mut buffer = Vec::new();
    let _ = file.read_to_end(&mut buffer);
    String::from_utf8_lossy(&buffer).into_owned()
}

fn digits_after(text: &str, index: usize) -> Option<String> {
    let mut digits = String::new();
    for character in text[index..].chars() {
        if character.is_ascii_digit() {
            digits.push(character);
            if digits.len() > 20 {
                break;
            }
        } else if !digits.is_empty() {
            break;
        } else if character.is_whitespace()
            || character == '='
            || character == ':'
            || character == '"'
            || character == '\''
        {
            continue;
        } else {
            break;
        }
    }
    (digits.len() >= 5).then_some(digits)
}

/// Find the most recently mentioned place id in a log. Roblox writes several
/// join variants over the years, so match the common keywords case-insensitively.
fn extract_place_id(log: &str) -> Option<String> {
    let lower = log.to_lowercase();
    // Join lines are the only places that name the place the player is actually
    // entering. Asset/telemetry lines also mention place ids (serverplaceid,
    // source place, ad lookups), so prefer the last explicit join line.
    let mut best_join: Option<(usize, String)> = None;
    let mut line_start = 0usize;
    for line in lower.split_inclusive('\n') {
        if let Some(found) = line.find("game_join_loadtime") {
            if let Some(relative) = line[found..].find("placeid:") {
                let index = line_start + found + relative + "placeid:".len();
                if let Some(id) = digits_after(&lower, index) {
                    if best_join
                        .as_ref()
                        .is_none_or(|(position, _)| index > *position)
                    {
                        best_join = Some((index, id));
                    }
                }
            }
        }
        if let Some(found) = line.find("joining game") {
            if let Some(relative) = line[found..].find(" place ") {
                let index = line_start + found + relative + " place ".len();
                if let Some(id) = digits_after(&lower, index) {
                    if best_join
                        .as_ref()
                        .is_none_or(|(position, _)| index > *position)
                    {
                        best_join = Some((index, id));
                    }
                }
            }
        }
        line_start += line.len();
    }
    if let Some((_, id)) = best_join {
        return Some(id);
    }
    let mut best: Option<(usize, String)> = None;
    for keyword in ["placeid", "place_id", "place id", "place "] {
        let mut from = 0;
        while let Some(found) = lower[from..].find(keyword) {
            let keyword_end = from + found + keyword.len();
            if let Some(id) = digits_after(&lower, keyword_end) {
                if best
                    .as_ref()
                    .is_none_or(|(position, _)| keyword_end > *position)
                {
                    best = Some((keyword_end, id));
                }
            }
            from = keyword_end;
        }
    }
    best.map(|(_, id)| id)
}

/// Status payload consumed by the renderer's playtime tracker.
pub fn status() -> Value {
    let Some(dir) = logs_dir() else {
        return json!({ "available": false, "running": false, "placeId": null, "startedAt": null });
    };
    let Some((path, modified, created)) = newest_log(&dir) else {
        return json!({ "available": true, "running": false, "placeId": null, "startedAt": null });
    };
    let age = modified.elapsed().unwrap_or(Duration::from_secs(u64::MAX));
    let running = age < LIVE_LOG_WINDOW;
    if !running {
        return json!({ "available": true, "running": false, "placeId": null, "startedAt": null });
    }
    let place_id = extract_place_id(&tail_text(&path));
    json!({
        "available": true,
        "running": true,
        "placeId": place_id,
        "startedAt": millis(created),
        "logModifiedAt": millis(modified),
        "log": path.file_name().and_then(|name| name.to_str()).unwrap_or("")
    })
}
