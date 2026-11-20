//! Match a live Roblox Player process to its session log, then consume new log
//! lines incrementally. Log modification time alone is not a presence signal.
use chrono::DateTime;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{BufRead, BufReader, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};
use windows::Win32::Foundation::{CloseHandle, FILETIME};
use windows::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
};
use windows::Win32::System::Threading::{
    GetProcessTimes, OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION,
};

#[link(name = "kernel32")]
extern "system" {
    fn QueryUnbiasedInterruptTime(time: *mut u64) -> i32;
}

fn process_starts() -> Option<Vec<u64>> {
    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0).ok()?;
        let mut entry = PROCESSENTRY32W {
            dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };
        let mut result = Vec::new();
        let mut readable = Process32FirstW(snapshot, &mut entry).is_ok();
        let mut complete = readable;
        while readable {
            let len = entry
                .szExeFile
                .iter()
                .position(|&c| c == 0)
                .unwrap_or(entry.szExeFile.len());
            let name = String::from_utf16_lossy(&entry.szExeFile[..len]);
            if name.eq_ignore_ascii_case("RobloxPlayerBeta.exe")
                || name.eq_ignore_ascii_case("Windows10Universal.exe")
            {
                if let Ok(process) = OpenProcess(
                    PROCESS_QUERY_LIMITED_INFORMATION,
                    false,
                    entry.th32ProcessID,
                ) {
                    let (mut start, mut exit, mut kernel, mut user) = (
                        FILETIME::default(),
                        FILETIME::default(),
                        FILETIME::default(),
                        FILETIME::default(),
                    );
                    if GetProcessTimes(process, &mut start, &mut exit, &mut kernel, &mut user)
                        .is_ok()
                    {
                        let ticks = (u64::from(start.dwHighDateTime) << 32)
                            | u64::from(start.dwLowDateTime);
                        result.push((ticks / 10_000).saturating_sub(11_644_473_600_000));
                    } else {
                        complete = false;
                    }
                    let _ = CloseHandle(process);
                } else {
                    complete = false;
                }
            }
            readable = Process32NextW(snapshot, &mut entry).is_ok();
        }
        let _ = CloseHandle(snapshot);
        (complete || !result.is_empty()).then_some(result)
    }
}

fn is_player_log(path: &Path) -> bool {
    let name = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    name.ends_with(".log") && name.contains("_player_") && !name.contains("crashhandler")
}

fn player_logs(starts: &[u64]) -> Vec<PathBuf> {
    let Some(local) = std::env::var_os("LOCALAPPDATA") else {
        return vec![];
    };
    let dir = PathBuf::from(local).join("Roblox").join("logs");
    let files: Vec<_> = fs::read_dir(dir)
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            if !is_player_log(&path) {
                return None;
            }
            let created = entry
                .metadata()
                .ok()?
                .created()
                .ok()?
                .duration_since(UNIX_EPOCH)
                .ok()?
                .as_millis() as u64;
            Some((path, created))
        })
        .collect();
    starts
        .iter()
        .filter_map(|start| {
            files
                .iter()
                .filter(|(_, time)| *time >= start.saturating_sub(1500) && *time <= start + 90_000)
                .min_by_key(|(_, time)| start.abs_diff(*time))
                .map(|(path, _)| path.clone())
        })
        .collect()
}

#[derive(Default)]
struct PlayerLog {
    offset: u64,
    place: Option<String>,
    joined: u64,
    left: u64,
}

impl PlayerLog {
    fn event(&mut self, line: &str) {
        let Some((stamp, message)) = line.split_once(',') else {
            return;
        };
        let lower = message.to_ascii_lowercase();
        let place = lower
            .split_once("joining game")
            .and_then(|(_, rest)| rest.split_once(" place "))
            .or_else(|| {
                lower
                    .split_once("game_join_loadtime")
                    .and_then(|(_, rest)| rest.split_once("placeid:"))
            })
            .map(|(_, rest)| {
                rest.trim_start()
                    .split(|c: char| !c.is_ascii_digit())
                    .next()
                    .unwrap_or("")
            })
            .filter(|id| (1..=20).contains(&id.len()) && *id != "0");
        let leaving = lower.contains("leaveugcgame")
            || lower.contains("disconnect replication")
            || lower.contains("ugcexperiencecontroller: stop");
        if place.is_none() && !leaving {
            return;
        }
        let Ok(time) = DateTime::parse_from_rfc3339(stamp.trim()) else {
            return;
        };
        let at = time.timestamp_millis().max(0) as u64;
        if let Some(id) = place {
            if self.place.as_deref() != Some(id) {
                if self.place.is_some() {
                    self.left = at;
                }
                self.place = Some(id.to_owned());
                self.joined = at;
            }
        } else if self.place.take().is_some() {
            self.left = at;
        }
    }

    fn refresh(&mut self, path: &Path) -> std::io::Result<()> {
        let mut file = File::open(path)?;
        let end = file.metadata()?.len();
        if end < self.offset {
            *self = Self::default();
        }
        if end == self.offset {
            return Ok(());
        }
        file.seek(SeekFrom::Start(self.offset))?;
        let mut reader = BufReader::new(file);
        let mut bytes = Vec::new();
        loop {
            bytes.clear();
            let len = reader.read_until(b'\n', &mut bytes)?;
            if len == 0 || bytes.last() != Some(&b'\n') {
                break;
            }
            self.event(&String::from_utf8_lossy(&bytes));
            self.offset += len as u64;
        }
        Ok(())
    }
}

pub fn status() -> Value {
    static LOGS: OnceLock<Mutex<HashMap<PathBuf, PlayerLog>>> = OnceLock::new();
    let Some(starts) = process_starts() else {
        return json!({"available": false});
    };
    let Ok(mut cache) = LOGS.get_or_init(Default::default).lock() else {
        return json!({"available": false});
    };
    let paths = if starts.is_empty() {
        Vec::new()
    } else {
        player_logs(&starts)
    };
    let mut ended = 0;
    cache.retain(|path, log| {
        if paths.contains(path) {
            return true;
        }
        let _ = log.refresh(path);
        if log.place.is_none() {
            ended = ended.max(log.left);
        }
        false
    });
    let mut active = None;
    let mut newest = 0;
    for path in &paths {
        let log = cache.entry(path.clone()).or_default();
        if log.refresh(path).is_err() {
            return json!({"available": false});
        }
        ended = ended.max(log.left);
        if log.place.is_some() && log.joined >= newest {
            newest = log.joined;
            active = log.place.clone();
        }
    }
    let mut uptime = 0;
    let awake =
        unsafe { (QueryUnbiasedInterruptTime(&mut uptime) != 0).then_some(uptime / 10_000) };
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;
    json!({"available": true, "running": !starts.is_empty(), "placeId": active, "startedAt": newest,
        "endedAt": ended, "observedAt": now, "awakeMs": awake})
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn joins_and_leaves_are_chronological() {
        let mut log = PlayerLog::default();
        let mut event = |at, line: &str| {
            log.event(&format!(
                "2026-11-20T09:00:{at:02}.000Z,0.0,0000,Info {line}"
            ))
        };
        event(0, "serverPlaceId=99999");
        event(1, "Joining game 'server' place 11111");
        event(2, "Game_join_loadtime: placeid:11111");
        event(4, "disconnect replication");
        event(7, "Joining game 'server' place 22222");
        event(8, "asset source place 99999");
        assert_eq!(log.place.as_deref(), Some("22222"));
        assert_eq!(log.joined - log.left, 3000);
        log.event("2026-11-20T09:01:00Z,Info leaveUGCGame");
        assert!(log.place.is_none());
        assert!(!is_player_log(Path::new(
            "123_Player_abc_CrashHandler_last.log"
        )));
    }
}
