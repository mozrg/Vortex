use std::ffi::OsString;
use std::os::windows::ffi::OsStringExt;
use std::path::PathBuf;
use windows::core::{PCWSTR, PWSTR};
use windows::Win32::Foundation::HWND;
use windows::Win32::UI::Controls::Dialogs::{
    CommDlgExtendedError, GetSaveFileNameW, OFN_EXPLORER, OFN_NOCHANGEDIR, OFN_OVERWRITEPROMPT,
    OFN_PATHMUSTEXIST, OPENFILENAMEW,
};

fn share_file_size_limit(filename: &str) -> usize {
    if filename.starts_with("vortex-backup-") && filename.ends_with(".json") {
        128 * 1024 * 1024
    } else if filename.ends_with(".csv") {
        16 * 1024 * 1024
    } else {
        1024 * 1024
    }
}

#[tauri::command]
pub async fn save_share_file(
    window: tauri::WebviewWindow,
    filename: String,
    contents: String,
) -> Result<bool, String> {
    let csv = filename.ends_with(".csv");
    if contents.len() > share_file_size_limit(&filename)
        || filename.len() > 255
        || ![".vortex-folder.json", ".vortex-collection.json", ".json", ".csv"]
            .iter()
            .any(|suffix| filename.ends_with(suffix))
        || filename.chars().any(|ch| ch.is_control() || "/\\:\"<>|?*".contains(ch))
    {
        return Err("Invalid Vortex share file".into());
    }
    let owner = window.hwnd().map_err(|e| e.to_string())?.0 as isize;
    let (send, receive) = tokio::sync::oneshot::channel();
    window.run_on_main_thread(move || {
        let _ = send.send(choose_save_path(owner, &filename, csv));
    }).map_err(|e| e.to_string())?;
    let Some(path) = receive.await.map_err(|_| "Save dialog closed unexpectedly")?? else {
        return Ok(false);
    };
    tokio::fs::write(path, contents).await.map_err(|e| e.to_string())?;
    Ok(true)
}

fn choose_save_path(owner: isize, filename: &str, csv: bool) -> Result<Option<PathBuf>, String> {
    let mut path = vec![0u16; 32768];
    for (index, unit) in filename.encode_utf16().enumerate() {
        path[index] = unit;
    }
    let filter: Vec<u16> = if csv { "CSV (*.csv)\0*.csv\0\0" } else { "Vortex (*.json)\0*.json\0\0" }.encode_utf16().collect();
    let extension: Vec<u16> = if csv { "csv\0" } else { "json\0" }.encode_utf16().collect();
    let mut dialog = OPENFILENAMEW {
        lStructSize: std::mem::size_of::<OPENFILENAMEW>() as u32,
        hwndOwner: HWND(owner as *mut _),
        lpstrFilter: PCWSTR(filter.as_ptr()),
        nFilterIndex: 1,
        lpstrFile: PWSTR(path.as_mut_ptr()),
        nMaxFile: path.len() as u32,
        lpstrDefExt: PCWSTR(extension.as_ptr()),
        Flags: OFN_EXPLORER | OFN_NOCHANGEDIR | OFN_OVERWRITEPROMPT | OFN_PATHMUSTEXIST,
        ..Default::default()
    };
    if unsafe { GetSaveFileNameW(&mut dialog) }.as_bool() {
        let end = path.iter().position(|&unit| unit == 0).unwrap_or(path.len());
        return Ok(Some(PathBuf::from(OsString::from_wide(&path[..end]))));
    }
    let error = unsafe { CommDlgExtendedError() };
    if error.0 == 0 { Ok(None) } else { Err(format!("Save dialog error {}", error.0)) }
}

#[cfg(test)]
mod tests {
    use super::share_file_size_limit;

    #[test]
    fn backup_limit_fits_base64_wallpaper_and_keeps_share_limit() {
        let wallpaper_bytes = 5 * 1024 * 1024 / 2;
        let encoded = (wallpaper_bytes + 2) / 3 * 4;
        assert!(share_file_size_limit("vortex-backup-2026-11-25.json") > encoded);
        assert_eq!(share_file_size_limit("library.vortex-folder.json"), 1024 * 1024);
    }
}
