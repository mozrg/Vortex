use crate::shortcut_icon;
use std::path::Path;

pub fn valid_numeric_id(value: &str) -> bool {
    !value.is_empty() && value.len() <= 20 && value.chars().all(|c| c.is_ascii_digit())
}

pub fn valid_quick_code(value: &str, max_len: usize) -> bool {
    !value.is_empty()
        && value.len() <= max_len
        && value
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

pub fn encode_query(value: &str) -> String {
    url::form_urlencoded::byte_serialize(value.as_bytes()).collect()
}

/// Open a validated URL using its registered system handler.
pub fn open_url(url: &str) -> Result<(), String> {
    let parsed = url::Url::parse(url).map_err(|_| "invalid URL".to_string())?;
    let scheme = parsed.scheme().to_ascii_lowercase();
    if !matches!(scheme.as_str(), "http" | "https" | "roblox") {
        return Err("unsupported URL scheme".to_string());
    }
    tauri_plugin_opener::open_url(url, None::<&str>)
        .map_err(|e| format!("failed to open URL: {}", e))
}

#[tauri::command]
pub async fn shell_open_external(url: String) -> bool {
    open_url(&url).is_ok()
}

fn open_game_links(
    place_id: &str,
    game_id: Option<&str>,
    access_code: Option<&str>,
) -> Result<(String, String), String> {
    if !valid_numeric_id(place_id) {
        return Err("invalid place id".to_string());
    }
    let mut params = format!("placeId={}", place_id);
    if let Some(server) = game_id.map(str::trim).filter(|id| !id.is_empty()) {
        if server.len() > 64 || !server.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
            return Err("invalid server id".to_string());
        }
        params.push_str("&gameInstanceId=");
        params.push_str(&encode_query(server));
    }
    if let Some(code) = access_code.map(str::trim).filter(|code| !code.is_empty()) {
        if !valid_quick_code(code, 128) {
            return Err("invalid private server access code".to_string());
        }
        params.push_str("&accessCode=");
        params.push_str(&encode_query(code));
    }
    Ok((
        format!("roblox://experiences/start?{}", params),
        format!("https://www.roblox.com/games/start?{}", params),
    ))
}

#[tauri::command]
pub async fn open_game(
    place_id: String,
    game_id: Option<String>,
    access_code: Option<String>,
) -> Result<String, String> {
    let (url, browser) = open_game_links(&place_id, game_id.as_deref(), access_code.as_deref())?;
    match open_url(&url) {
        Ok(()) => Ok("roblox".to_string()),
        Err(_) => {
            open_url(&browser).map_err(|e| format!("failed to launch Roblox: {}", e))?;
            Ok("browser".to_string())
        }
    }
}

fn quick_game_links(
    method: &str,
    place_id: Option<String>,
    link_code: Option<String>,
    share_code: Option<String>,
    share_type: Option<String>,
    server_id: Option<String>,
    access_code: Option<String>,
) -> Result<(String, String), String> {
    let place = place_id.unwrap_or_default();
    let links = match method {
        // Roblox deep links use `experiences/start` with `placeId` and `linkCode` query parameters.
        "private" => {
            let code = link_code.unwrap_or_default();
            if !valid_numeric_id(&place) || !valid_quick_code(&code, 100) {
                return Err("invalid private server link".to_string());
            }
            let params = format!("placeId={}&linkCode={}", place, encode_query(&code));
            (
                format!("roblox://experiences/start?{}", params),
                format!("https://www.roblox.com/games/start?{}", params),
            )
        }
        // Share links are opened through Roblox's native share-links route.
        "share" => {
            let code = share_code.unwrap_or_default();
            let kind = share_type.unwrap_or_else(|| "Server".to_string());
            if !valid_quick_code(&code, 128) {
                return Err("invalid Roblox share code".to_string());
            }
            if !matches!(
                kind.as_str(),
                "Server" | "ExperienceInvite" | "ExperienceDetails"
            ) {
                return Err("invalid Roblox share link type".to_string());
            }
            (
                format!(
                    "roblox://navigation/share_links?code={}&type={}",
                    encode_query(&code),
                    encode_query(&kind)
                ),
                format!(
                    "https://www.roblox.com/share?code={}&type={}",
                    encode_query(&code),
                    encode_query(&kind)
                ),
            )
        }
        // Public place launch requires only its Place ID.
        "public" => {
            if !valid_numeric_id(&place) {
                return Err("invalid place id".to_string());
            }
            (
                format!("roblox://experiences/start?placeId={}", place),
                format!("https://www.roblox.com/games/{}", place),
            )
        }
        "instance" | "access" => {
            let (parameter, value, limit) = if method == "instance" {
                ("gameInstanceId", server_id.unwrap_or_default(), 64)
            } else {
                ("accessCode", access_code.unwrap_or_default(), 128)
            };
            let value = value.trim();
            if !valid_numeric_id(&place) || !valid_quick_code(value, limit) {
                return Err("invalid server launch target".to_string());
            }
            let params = format!("placeId={}&{}={}", place, parameter, encode_query(value));
            (
                format!("roblox://experiences/start?{}", params),
                format!("https://www.roblox.com/games/start?{}", params),
            )
        }
        _ => return Err("unsupported quick launch method".to_string()),
    };
    Ok(links)
}

#[tauri::command]
pub async fn launch_quick_game(
    method: String,
    place_id: Option<String>,
    link_code: Option<String>,
    share_code: Option<String>,
    share_type: Option<String>,
    server_id: Option<String>,
    access_code: Option<String>,
) -> Result<String, String> {
    let (deep_link, browser_url) = quick_game_links(
        &method,
        place_id,
        link_code,
        share_code,
        share_type,
        server_id,
        access_code,
    )?;
    match open_url(&deep_link) {
        Ok(()) => Ok("roblox".to_string()),
        Err(_) => {
            open_url(&browser_url).map_err(|e| format!("failed to launch Roblox: {}", e))?;
            Ok("browser".to_string())
        }
    }
}

#[tauri::command]
pub async fn create_desktop_shortcut(
    title: String,
    method: String,
    place_id: Option<String>,
    link_code: Option<String>,
    share_code: Option<String>,
    share_type: Option<String>,
    server_id: Option<String>,
    access_code: Option<String>,
    thumbnail: Option<String>,
) -> Result<bool, String> {
    let (deep_link, _) = quick_game_links(
        &method,
        place_id,
        link_code,
        share_code,
        share_type,
        server_id,
        access_code,
    )?;
    let url = desktop_shortcut_url(&deep_link);
    let desktop = dirs::desktop_dir().ok_or("Desktop folder not found")?;
    let name: String = title
        .chars()
        .filter(|c| c.is_alphanumeric() || matches!(c, ' ' | '-' | '_'))
        .take(64)
        .collect();
    let name = if name.trim().is_empty() {
        "Roblox"
    } else {
        name.trim()
    };
    let art = shortcut_icon::load_shortcut_icon(thumbnail.as_deref()).await;
    let fallback = std::env::current_exe().ok();
    let icon = art.as_deref().or(fallback.as_deref());
    for index in 1..=100 {
        let suffix = if index == 1 {
            String::new()
        } else {
            format!(" ({index})")
        };
        let filename = desktop.join(format!("Vortex - {name}{suffix}.url"));
        if filename.with_extension("lnk").exists() {
            continue;
        }
        match write_windows_shortcut(&filename, &url, icon) {
            Ok(()) => return Ok(art.is_some()),
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(_) => return Err("Windows could not save the shortcut".to_string()),
        }
    }
    Err("No available shortcut name".to_string())
}

fn desktop_shortcut_url(deep_link: &str) -> String {
    // Use the explicit experience launch route for desktop activations.
    match deep_link.strip_prefix("roblox://placeId=") {
        Some(target) => format!("roblox://experiences/start?placeId={target}"),
        None => deep_link.to_owned(),
    }
}

fn write_windows_shortcut(filename: &Path, url: &str, icon: Option<&Path>) -> std::io::Result<()> {
    use std::io::Write;

    let mut shortcut = format!("[InternetShortcut]\r\nURL={url}\r\n");
    if let Some(icon) = icon.and_then(Path::to_str) {
        shortcut.push_str(&format!("IconFile={icon}\r\nIconIndex=0\r\n"));
    }
    // A UTF-16 BOM keeps paths with non-ASCII characters readable by Explorer.
    let data: Vec<_> = std::iter::once(0xfeff)
        .chain(shortcut.encode_utf16())
        .flat_map(u16::to_le_bytes)
        .collect();
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(filename)?;
    if let Err(error) = file.write_all(&data) {
        drop(file);
        let _ = std::fs::remove_file(filename);
        return Err(error);
    }
    Ok(())
}

#[cfg(test)]
mod shortcut_tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn shortcut_preserves_the_exact_server_target_and_icon() {
        let (deep_link, _) = quick_game_links(
            "private",
            Some("812001".into()),
            Some("example_link".into()),
            None,
            None,
            None,
            None,
        )
        .unwrap();
        let url = desktop_shortcut_url(&deep_link);
        assert_eq!(
            url,
            "roblox://experiences/start?placeId=812001&linkCode=example_link"
        );
        let path = std::env::temp_dir().join(format!("vortex-shortcut-{}.url", Uuid::new_v4()));
        let icon_path = std::env::temp_dir().join("Vortex — обложка.ico");
        write_windows_shortcut(&path, &url, Some(&icon_path)).unwrap();
        let bytes = std::fs::read(&path).unwrap();
        let duplicate = write_windows_shortcut(&path, &url, None).unwrap_err();
        let _ = std::fs::remove_file(path);
        assert_eq!(duplicate.kind(), std::io::ErrorKind::AlreadyExists);
        let words = bytes
            .chunks_exact(2)
            .map(|pair| u16::from_le_bytes([pair[0], pair[1]]))
            .collect::<Vec<_>>();
        assert_eq!(
            String::from_utf16(&words).unwrap(),
            format!(
                "\u{feff}[InternetShortcut]\r\nURL={url}\r\nIconFile={}\r\nIconIndex=0\r\n",
                icon_path.display()
            )
        );
    }

    #[test]
    fn shortcut_keeps_roblox_share_navigation() {
        let share = "roblox://navigation/share_links?code=example_share&type=Server";
        assert_eq!(desktop_shortcut_url(share), share);
        assert_eq!(
            desktop_shortcut_url("roblox://placeId=1818"),
            "roblox://experiences/start?placeId=1818"
        );
        assert_eq!(
            desktop_shortcut_url("roblox://placeId=1818&gameInstanceId=example"),
            "roblox://experiences/start?placeId=1818&gameInstanceId=example"
        );
    }

    #[test]
    fn private_server_access_code_uses_canonical_experiences_start_deeplink() {
        let (deep_link, browser) = quick_game_links(
            "access",
            Some("8304191830".into()),
            None,
            None,
            None,
            None,
            Some("3f12ab45-1234-5678-9abc-def012345678".into()),
        )
        .unwrap();
        assert_eq!(
            deep_link,
            "roblox://experiences/start?placeId=8304191830&accessCode=3f12ab45-1234-5678-9abc-def012345678"
        );
        assert_eq!(
            browser,
            "https://www.roblox.com/games/start?placeId=8304191830&accessCode=3f12ab45-1234-5678-9abc-def012345678"
        );
        assert_eq!(desktop_shortcut_url(&deep_link), deep_link);

        let (open_deep, open_browser) =
            open_game_links("8304191830", None, Some("vip_code-12345678")).unwrap();
        assert_eq!(
            open_deep,
            "roblox://experiences/start?placeId=8304191830&accessCode=vip_code-12345678"
        );
        assert_eq!(
            open_browser,
            "https://www.roblox.com/games/start?placeId=8304191830&accessCode=vip_code-12345678"
        );

        // Malformed accessCode must fail instead of silently joining a public server.
        assert!(open_game_links("8304191830", None, Some("bad code with spaces!")).is_err());
    }
}
