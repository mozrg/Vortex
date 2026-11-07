use rusty_leveldb::{LdbIterator, Options, DB};
use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;

use crate::state::AppState;

const MAX_VALUE_BYTES: usize = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES: usize = 8 * 1024 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyStorageImport {
    pub available: bool,
    pub values: HashMap<String, String>,
}

/// Read the Electron Chromium Local Storage database without exporting any
/// unrelated browser data. The importer only returns Vortex-owned keys.
pub fn import_legacy_local_storage() -> Result<LegacyStorageImport, String> {
    let database_path: PathBuf = AppState::user_data_dir()
        .join("Local Storage")
        .join("leveldb");
    if !database_path.join("CURRENT").is_file() {
        return Ok(LegacyStorageImport {
            available: false,
            values: HashMap::new(),
        });
    }

    let mut options = Options::default();
    options.create_if_missing = false;
    options.error_if_exists = false;
    let mut db = DB::open(&database_path, options)
        .map_err(|error| format!("Could not read the old Vortex settings database: {error}"))?;
    let mut iterator = db
        .new_iter()
        .map_err(|error| format!("Could not scan the old Vortex settings database: {error}"))?;

    let mut values = HashMap::new();
    let mut total_bytes = 0usize;
    while iterator.advance() {
        let Some((key, value)) = iterator.current() else {
            continue;
        };
        if key.first() != Some(&b'_') {
            continue;
        }
        let script_key = &key[1..];
        let Some(separator) = script_key.iter().position(|byte| *byte == 0) else {
            continue;
        };
        let Ok(name) = std::str::from_utf8(&script_key[separator + 1..]) else {
            continue;
        };
        if !name.starts_with("vortex.") || is_transient_key(name) || values.contains_key(name) {
            continue;
        }
        if value.len() > MAX_VALUE_BYTES
            || total_bytes.saturating_add(value.len()) > MAX_TOTAL_BYTES
        {
            continue;
        }
        let Some(decoded) = decode_chromium_string(&value) else {
            continue;
        };
        total_bytes = total_bytes.saturating_add(value.len());
        values.insert(name.to_string(), decoded);
    }

    Ok(LegacyStorageImport {
        available: true,
        values,
    })
}

fn is_transient_key(name: &str) -> bool {
    name == "vortex.playSession"
        || name == "vortex.detailCache"
        || name == "vortex.featuredCache"
        || name.starts_with("vortex.searchCache.")
        || name.starts_with("vortex.onlineHistory.")
        || name == "vortex.migration.electron.v1"
}

fn decode_chromium_string(value: &[u8]) -> Option<String> {
    let (format, bytes) = value.split_first()?;
    match format {
        0 if bytes.len() % 2 == 0 => {
            let units = bytes
                .chunks_exact(2)
                .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
                .collect::<Vec<_>>();
            Some(String::from_utf16_lossy(&units))
        }
        1 => Some(bytes.iter().map(|byte| char::from(*byte)).collect()),
        _ => None,
    }
}
