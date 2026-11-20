use crate::state::AppState;
use image::imageops::FilterType;
use sha2::{Digest, Sha256};
use std::io::Cursor;
use std::path::PathBuf;
use std::time::Duration;

pub async fn load_shortcut_icon(source: Option<&str>) -> Option<PathBuf> {
    let url: url::Url = source?.parse().ok()?;
    if url.scheme() != "https" || url.host_str() != Some("tr.rbxcdn.com")
        || url.port().is_some() || !url.username().is_empty() || url.password().is_some() {
        return None;
    }
    let key = format!("{:x}", Sha256::digest(url.as_str()));
    let directory = AppState::user_data_dir().join("shortcut-icons");
    let file = directory.join(format!("{key}.ico"));
    if file.is_file() {
        return Some(file);
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .redirect(reqwest::redirect::Policy::none())
        .build().ok()?;
    let mut response = client.get(url).send().await.ok()?.error_for_status().ok()?;
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.ok()? {
        if bytes.len() + chunk.len() > 2 * 1024 * 1024 {
            return None;
        }
        bytes.extend_from_slice(&chunk);
    }
    let icon = tokio::task::spawn_blocking(move || encode_shortcut_icon(&bytes)).await.ok()?.ok()?;
    tokio::fs::create_dir_all(&directory).await.ok()?;
    let temporary = directory.join(format!("{}.tmp", uuid::Uuid::new_v4()));
    tokio::fs::write(&temporary, icon).await.ok()?;
    if tokio::fs::rename(&temporary, &file).await.is_err() {
        let _ = tokio::fs::remove_file(temporary).await;
    }
    file.is_file().then_some(file)
}

fn encode_shortcut_icon(png: &[u8]) -> Result<Vec<u8>, String> {
    let mut reader = image::ImageReader::with_format(Cursor::new(png), image::ImageFormat::Png);
    let mut limits = image::Limits::default();
    limits.max_image_width = Some(1024);
    limits.max_image_height = Some(1024);
    reader.limits(limits);
    let source = reader.decode().map_err(|error| error.to_string())?;
    let mut icon = ico::IconDir::new(ico::ResourceType::Icon);
    for size in [32, 48, 128, 256] {
        let sample = source.resize_to_fill(size, size, FilterType::Lanczos3).into_rgba8();
        let image = ico::IconImage::from_rgba_data(size, size, sample.into_raw());
        icon.add_entry(ico::IconDirEntry::encode(&image).map_err(|e| e.to_string())?);
    }
    let mut output = Vec::new();
    icon.write(&mut output).map_err(|error| error.to_string())?;
    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn makes_a_windows_icon_from_existing_png_art() {
        let data = include_bytes!("../icons/128x128.png");
        let binary = encode_shortcut_icon(data).unwrap();
        let icon = ico::IconDir::read(Cursor::new(binary)).unwrap();
        assert_eq!(icon.entries().iter().map(|entry| entry.width()).collect::<Vec<_>>(), [32, 48, 128, 256]);
    }
}
