use serde_json::Value;
use sha1::{Digest, Sha1};
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tokio::fs;

use crate::state::AppState;

const DISK_CACHE_TTL: Duration = Duration::from_secs(24 * 60 * 60);

/// Sanitize a Roblox CDN thumbnail URL. Roblox rotates thumbnail CDN hosts.
pub fn clean_thumbnail(value: &str) -> String {
    if let Ok(url) = url::Url::parse(value) {
        if url.scheme() == "https"
            && url
                .host_str()
                .map(|host| host.ends_with(".rbxcdn.com"))
                .unwrap_or(false)
        {
            return url.to_string();
        }
    }
    String::new()
}

/// The on-disk cache directory for a given kind ("thumbs", "search").
pub fn disk_cache_dir(kind: &str) -> PathBuf {
    AppState::user_data_dir().join("cache").join(kind)
}

fn disk_cache_key(key: &str) -> String {
    let mut hasher = Sha1::new();
    hasher.update(key.as_bytes());
    hasher.finalize().encode_hex()
}

trait EncodeHex {
    fn encode_hex(&self) -> String;
}

impl EncodeHex for [u8] {
    fn encode_hex(&self) -> String {
        let mut s = String::with_capacity(self.len() * 2);
        for b in self {
            s.push_str(&format!("{:02x}", b));
        }
        s
    }
}

/// Read a JSON value from the on-disk cache if it exists and is not expired.
pub async fn read_disk_cache(kind: &str, key: &str) -> Option<Value> {
    let path = disk_cache_dir(kind).join(format!("{}.json", disk_cache_key(key)));
    let metadata = fs::metadata(&path).await.ok()?;
    let modified = metadata.modified().ok()?;
    if SystemTime::now().duration_since(modified).ok()? > DISK_CACHE_TTL {
        return None;
    }
    let content = fs::read_to_string(&path).await.ok()?;
    serde_json::from_str(&content).ok()
}

/// Write a JSON value to the on-disk cache.
pub async fn write_disk_cache(kind: &str, key: &str, value: &Value) {
    let dir = disk_cache_dir(kind);
    let _ = fs::create_dir_all(&dir).await;
    let path = dir.join(format!("{}.json", disk_cache_key(key)));
    let content = serde_json::to_string(value).unwrap_or_default();
    let _ = fs::write(&path, content).await;
}

/// Clear the on-disk cache for a given kind, or all caches if kind is empty.
pub async fn clear_disk_cache(kind: &str) {
    let target = if kind.is_empty() {
        AppState::user_data_dir().join("cache")
    } else {
        disk_cache_dir(kind)
    };
    let _ = fs::remove_dir_all(&target).await;
}

/// Count the number of cached files for a given kind.
pub async fn count_disk_cache(kind: &str) -> usize {
    let dir = disk_cache_dir(kind);
    match fs::read_dir(&dir).await {
        Ok(mut entries) => {
            let mut count = 0;
            while let Ok(Some(_)) = entries.next_entry().await {
                count += 1;
            }
            count
        }
        Err(_) => 0,
    }
}

/// Cache a thumbnail URL in the "thumbs" directory.
pub async fn cache_thumbnail(universe_id: &str, url: &str) {
    if url.is_empty() {
        return;
    }
    let value = serde_json::json!({ "url": url });
    write_disk_cache("thumbs", universe_id, &value).await;
}

/// Read a cached thumbnail URL, if present.
pub async fn read_cached_thumbnail(universe_id: &str) -> Option<String> {
    let value = read_disk_cache("thumbs", universe_id).await?;
    value
        .get("url")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

/// Get the last-modified time of a file as a Unix timestamp (ms), if available.
pub async fn file_mtime_ms(path: &Path) -> Option<u64> {
    let metadata = fs::metadata(path).await.ok()?;
    let modified = metadata.modified().ok()?;
    Some(modified.duration_since(UNIX_EPOCH).ok()?.as_millis() as u64)
}

/// Time helpers for the response cache.
pub fn now_instant() -> Instant {
    Instant::now()
}

pub fn timestamp_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}
