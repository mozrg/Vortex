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
use windows::core::PWSTR;
use windows::Win32::Foundation::{CloseHandle, FILETIME};
use windows::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
};
use windows::Win32::System::Threading::{
    GetProcessTimes, OpenProcess, QueryFullProcessImageNameW, TerminateProcess, PROCESS_NAME_WIN32,
    PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_TERMINATE,
};

#[link(name = "kernel32")]
extern "system" {
    fn QueryUnbiasedInterruptTime(time: *mut u64) -> i32;
}

fn is_player_executable(name: &str) -> bool {
    name.eq_ignore_ascii_case("RobloxPlayerBeta.exe")
        || name.eq_ignore_ascii_case("Windows10Universal.exe")
}

pub fn is_player_pid(pid: u32) -> bool {
    unsafe {
        let Ok(process) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) else {
            return false;
        };
        let mut path = [0u16; 1024];
        let mut length = path.len() as u32;
        let result = QueryFullProcessImageNameW(
            process,
            PROCESS_NAME_WIN32,
            PWSTR(path.as_mut_ptr()),
            &mut length,
        );
        let _ = CloseHandle(process);
        if result.is_err() {
            return false;
        }
        let path = String::from_utf16_lossy(&path[..length as usize]);
        Path::new(&path)
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(is_player_executable)
    }
}

pub fn terminate_player_processes() -> usize {
    let mut terminated = 0usize;
    unsafe {
        let Ok(snapshot) = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) else {
            return 0;
        };
        let mut entry = PROCESSENTRY32W {
            dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };
        if Process32FirstW(snapshot, &mut entry).is_ok() {
            loop {
                let len = entry
                    .szExeFile
                    .iter()
                    .position(|&c| c == 0)
                    .unwrap_or(entry.szExeFile.len());
                let name = String::from_utf16_lossy(&entry.szExeFile[..len]);
                if is_player_executable(&name) {
                    if let Ok(process) =
                        OpenProcess(PROCESS_TERMINATE, false, entry.th32ProcessID)
                    {
                        if TerminateProcess(process, 0).is_ok() {
                            terminated += 1;
                        }
                        let _ = CloseHandle(process);
                    }
                }
                if Process32NextW(snapshot, &mut entry).is_err() {
                    break;
                }
            }
        }
        let _ = CloseHandle(snapshot);
    }
    terminated
}

fn process_starts() -> Option<Vec<(u32, u64)>> {
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
            if is_player_executable(&name) {
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
                        result.push((
                            entry.th32ProcessID,
                            (ticks / 10_000).saturating_sub(11_644_473_600_000),
                        ));
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

fn player_logs(starts: &[(u32, u64)]) -> Vec<(u32, PathBuf)> {
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
        .filter_map(|(pid, start)| {
            files
                .iter()
                .filter(|(_, time)| *time >= start.saturating_sub(1500) && *time <= start + 90_000)
                .min_by_key(|(_, time)| start.abs_diff(*time))
                .map(|(path, _)| (*pid, path.clone()))
        })
        .collect()
}

#[derive(Default)]
struct PlayerLog {
    offset: u64,
    place: Option<String>,
    server: Option<String>,
    server_ip: Option<String>,
    server_port: Option<u16>,
    joined: u64,
    left: u64,
}

/// First dotted-quad IPv4 address in a log message, if any.
fn ipv4_in(text: &str) -> Option<String> {
    let bytes = text.as_bytes();
    let mut start = 0;
    while start < bytes.len() {
        if !bytes[start].is_ascii_digit() {
            start += 1;
            continue;
        }
        let mut end = start;
        while end < bytes.len() && (bytes[end].is_ascii_digit() || bytes[end] == b'.') {
            end += 1;
        }
        let candidate = &text[start..end];
        let parts: Vec<_> = candidate.split('.').collect();
        if parts.len() == 4
            && parts.iter().all(|part| {
                !part.is_empty()
                    && part.len() <= 3
                    && (part.len() == 1 || !part.starts_with('0'))
                    && part.parse::<u8>().is_ok()
            })
            && candidate != "0.0.0.0"
        {
            return Some(candidate.to_string());
        }
        start = end.max(start + 1);
    }
    None
}

fn endpoint_in(text: &str) -> Option<(String, u16)> {
    let ip = ipv4_in(text)?;
    let lower = text.to_ascii_lowercase();
    let after = lower
        .split_once("port = ")
        .map(|(_, rest)| rest)
        .or_else(|| lower.split_once("port:").map(|(_, rest)| rest))?;
    let port = after
        .split(|ch: char| !ch.is_ascii_digit())
        .next()?
        .parse::<u16>()
        .ok()
        .filter(|port| *port != 0)?;
    Some((ip, port))
}

impl PlayerLog {
    fn event(&mut self, line: &str) {
        let Some((stamp, message)) = line.split_once(',') else {
            return;
        };
        let lower = message.to_ascii_lowercase();
        let join = lower
            .split_once("joining game")
            .and_then(|(_, rest)| rest.split_once(" place "));
        let server = join
            .and_then(|(name, _)| name.trim().strip_prefix('\'')?.strip_suffix('\''))
            .filter(|id| {
                id.len() == 36
                    && id.bytes().enumerate().all(|(i, ch)| {
                        if matches!(i, 8 | 13 | 18 | 23) {
                            ch == b'-'
                        } else {
                            ch.is_ascii_hexdigit()
                        }
                    })
                    && *id != "00000000-0000-0000-0000-000000000000"
            });
        let place = join
            .map(|(_, rest)| rest)
            .or_else(|| {
                lower
                    .split_once("game_join_loadtime")
                    .and_then(|(_, rest)| rest.split_once("placeid:"))
                    .map(|(_, rest)| rest)
            })
            .map(|rest| {
                rest.trim_start()
                    .split(|c: char| !c.is_ascii_digit())
                    .next()
                    .unwrap_or("")
            })
            .filter(|id| (1..=20).contains(&id.len()) && *id != "0");
        let leaving = lower.contains("leaveugcgame")
            || lower.contains("disconnect replication")
            || lower.contains("ugcexperiencecontroller: stop");
        // Roblox routes traffic through a public UDMUX edge; the "RCC Server
        // Address" is often a private 10.x address unreachable from the player
        // machine, so the UDMUX endpoint is the only pingable target.
        if self.place.is_some() && !leaving {
            if let Some((ip, port)) = lower
                .split_once("udmux address = ")
                .and_then(|(_, rest)| endpoint_in(rest))
            {
                self.server_ip = Some(ip);
                self.server_port = Some(port);
            } else if let Some((ip, port)) = lower
                .split_once("server address = ")
                .and_then(|(_, rest)| endpoint_in(rest))
                .filter(|_| !lower.contains("udmux"))
            {
                self.server_ip = Some(ip);
                self.server_port = Some(port);
            }
        }
        if place.is_none() && !leaving {
            return;
        }
        let Ok(time) = DateTime::parse_from_rfc3339(stamp.trim()) else {
            return;
        };
        let at = time.timestamp_millis().max(0) as u64;
        if let Some(id) = place {
            let different_server = server
                .zip(self.server.as_deref())
                .is_some_and(|(next, old)| next != old);
            if self.place.as_deref() != Some(id) || different_server {
                if self.place.is_some() {
                    self.left = at;
                }
                self.place = Some(id.to_owned());
                self.server = None;
                self.server_ip = None;
                self.server_port = None;
                self.joined = at;
            }
            if let Some(server) = server {
                self.server = Some(server.to_owned());
            }
            // The join line's address may be a private RCC host; keep it only
            // as a fallback until a UDMUX line replaces it.
            if self.server_ip.is_none() {
                if let Some(ip) = lower
                    .split_once(" at ")
                    .map(|(_, rest)| rest)
                    .and_then(ipv4_in)
                {
                    self.server_ip = Some(ip);
                }
            }
        } else if self.place.take().is_some() {
            self.server = None;
            self.server_ip = None;
            self.server_port = None;
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
        if paths.iter().any(|(_, candidate)| candidate == path) {
            return true;
        }
        let _ = log.refresh(path);
        if log.place.is_none() {
            ended = ended.max(log.left);
        }
        false
    });
    let mut active = None;
    let mut active_server = None;
    let mut active_ip = None;
    let mut active_port = None;
    let mut active_pid = None;
    let mut newest = 0;
    for (pid, path) in &paths {
        let log = cache.entry(path.clone()).or_default();
        if log.refresh(path).is_err() {
            return json!({"available": false});
        }
        ended = ended.max(log.left);
        if log.place.is_some() && log.joined >= newest {
            newest = log.joined;
            active = log.place.clone();
            active_server = log.server.clone();
            active_ip = log.server_ip.clone();
            active_port = log.server_port;
            active_pid = Some(pid);
        }
    }
    let mut uptime = 0;
    let awake =
        unsafe { (QueryUnbiasedInterruptTime(&mut uptime) != 0).then_some(uptime / 10_000) };
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;
    json!({"available": true, "running": !starts.is_empty(), "placeId": active, "serverId": active_server, "serverIp": active_ip, "serverPort": active_port, "pid": active_pid, "startedAt": newest,
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

    #[test]
    fn changing_servers_in_the_same_place_starts_one_new_session() {
        let mut log = PlayerLog::default();
        let first = "98371923-b960-4342-90d8-c8c4c68edebd";
        let second = "6c90ccb9-aefd-46bb-be55-18f4b0689cf2";
        log.event(&format!(
            "2026-11-20T09:00:01Z,Info Joining game '{first}' place 11111"
        ));
        let original = log.joined;
        log.event("2026-11-20T09:00:02Z,Info Game_join_loadtime: placeid:11111");
        assert_eq!(log.joined, original);
        assert_eq!(log.server.as_deref(), Some(first));
        log.event(&format!(
            "2026-11-20T09:00:03Z,Info Joining game '{second}' place 11111"
        ));
        assert_eq!(log.joined, original + 2000);
        assert_eq!(log.left, log.joined);
        assert_eq!(log.server.as_deref(), Some(second));
        log.event("2026-11-20T09:00:04Z,Info leaveUGCGame");
        assert!(log.server.is_none());
    }

    #[test]
    #[ignore = "reads the newest real Roblox log; run with --ignored"]
    fn parses_the_server_ip_of_a_real_log() {
        let Some(local) = std::env::var_os("LOCALAPPDATA") else {
            return;
        };
        let dir = PathBuf::from(local).join("Roblox").join("logs");
        let newest = fs::read_dir(dir)
            .into_iter()
            .flatten()
            .flatten()
            .filter(|entry| is_player_log(&entry.path()))
            .filter_map(|entry| Some((entry.metadata().ok()?.modified().ok()?, entry.path())))
            .max_by_key(|(time, _)| *time);
        let Some((_, path)) = newest else { return };
        let bytes = fs::read(&path).expect("log reads");
        let text = String::from_utf8_lossy(&bytes);
        let mut log = PlayerLog::default();
        let mut last_ip = None;
        for line in text.lines() {
            log.event(line);
            if log.server_ip.is_some() {
                last_ip = log.server_ip.clone();
            }
        }
        println!(
            "log = {}; active place = {:?}; last parsed endpoint = {:?}",
            path.file_name().unwrap_or_default().to_string_lossy(),
            log.place,
            last_ip
        );
        assert!(last_ip.is_some(), "no server endpoint parsed from the log");
    }

    #[test]
    fn server_ip_tracks_joins_and_network_lines_and_clears_on_leave() {
        assert_eq!(
            ipv4_in("3.72.241.66, Port = 53565").as_deref(),
            Some("3.72.241.66")
        );
        assert_eq!(
            endpoint_in(
                "128.116.13.34, Port = 53613 | RCC Server Address = 10.30.4.131, Port = 53613"
            ),
            Some(("128.116.13.34".to_string(), 53613))
        );
        assert_eq!(
            endpoint_in("RCC Server Address = 10.30.4.131, Port = 53613"),
            Some(("10.30.4.131".to_string(), 53613))
        );
        assert_eq!(ipv4_in("binding socket on inaddr_any:0"), None);
        assert_eq!(ipv4_in("999.1.2.3 and 01.2.3.4 and 0.0.0.0"), None);

        let mut log = PlayerLog::default();
        log.event(
            "2026-11-20T09:00:01Z,Info Joining game '98371923-b960-4342-90d8-c8c4c68edebd' place 11111 at 10.30.5.207",
        );
        assert_eq!(log.server_ip.as_deref(), Some("10.30.5.207"));
        // The public UDMUX edge replaces the private RCC address.
        log.event(
            "2026-11-20T09:00:02Z,Info [FLog::Network] UDMUX Address = 128.116.13.34, Port = 62467 | RCC Server Address = 10.30.5.207, Port = 62467",
        );
        assert_eq!(log.server_ip.as_deref(), Some("128.116.13.34"));
        assert_eq!(log.server_port, Some(62467));
        // Leave clears the endpoint, and stale network messages cannot restore it.
        log.event("2026-11-20T09:00:03Z,Info leaveUGCGame");
        assert!(log.server_ip.is_none());
        log.event(
            "2026-11-20T09:00:04Z,Info [FLog::Network] Server Address = 52.1.2.3, Port = 53565",
        );
        assert!(log.server_ip.is_none());
    }
}
