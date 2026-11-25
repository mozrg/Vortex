//! Read only the visible Roblox diagnostic panels. Pixels and recognized text
//! stay in memory, and the overlay receives only the two numerical readings.

use serde::Serialize;
use std::{
    collections::VecDeque,
    ffi::c_void,
    time::{Duration, Instant},
};
use tokio::task::JoinHandle;
use windows::{
    core::HSTRING,
    Globalization::Language,
    Graphics::Imaging::{BitmapAlphaMode, BitmapPixelFormat, SoftwareBitmap},
    Media::Ocr::OcrEngine,
    Storage::Streams::DataWriter,
    Win32::{
        Foundation::{HWND, POINT, RECT},
        Graphics::Gdi::{
            BitBlt, ClientToScreen, CreateCompatibleDC, CreateDIBSection, DeleteDC, DeleteObject,
            GdiFlush, GetDC, GetMonitorInfoW, MonitorFromWindow, ReleaseDC, SelectObject,
            BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, MONITORINFO,
            MONITOR_DEFAULTTONEAREST, SRCCOPY,
        },
        System::WinRT::{RoInitialize, RoUninitialize, RO_INIT_MULTITHREADED},
        UI::{
            HiDpi::GetDpiForWindow,
            WindowsAndMessaging::{
                GetClientRect, GetForegroundWindow, GetWindowThreadProcessId, IsIconic,
            },
        },
    },
};

const SAMPLE_INTERVAL: Duration = Duration::from_millis(1500);
const RETRY_INTERVAL: Duration = Duration::from_secs(10);
const HISTORY_LEN: usize = 12;

#[derive(Clone, Copy, Debug, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RobloxPings {
    pub network_ms: Option<f32>,
    pub data_ms: Option<f32>,
}

#[derive(Default)]
pub struct StatsReader {
    session: Option<(u32, u64)>,
    generation: u64,
    next_at: Option<Instant>,
    task: Option<(u64, JoinHandle<Option<RobloxPings>>)>,
    last: RobloxPings,
    network_history: VecDeque<u32>,
}

impl StatsReader {
    pub async fn update(
        &mut self,
        session: Option<(u32, u64)>,
        exclude: Option<RECT>,
    ) -> RobloxPings {
        if self.session != session {
            self.session = session;
            self.generation += 1;
            self.next_at = None;
            self.last = RobloxPings::default();
            self.network_history.clear();
        }
        if self
            .task
            .as_ref()
            .is_some_and(|(_, task)| task.is_finished())
        {
            if let Some((generation, task)) = self.task.take() {
                let result = task.await.ok().flatten();
                if generation == self.generation {
                    if result.is_none() {
                        self.next_at = Some(Instant::now() + RETRY_INTERVAL);
                    } else if result == Some(RobloxPings::default()) {
                        self.next_at = Some(Instant::now() + Duration::from_secs(3));
                    }
                    self.last = result.unwrap_or_default();
                    if let Some(ms) = self.last.network_ms {
                        if self.network_history.len() == HISTORY_LEN {
                            self.network_history.pop_front();
                        }
                        self.network_history.push_back(ms.round() as u32);
                    } else {
                        self.network_history.clear();
                    }
                }
            }
        }
        if let Some((pid, _)) = session {
            if self.task.is_none() && self.next_at.is_none_or(|at| Instant::now() >= at) {
                self.next_at = Some(Instant::now() + SAMPLE_INTERVAL);
                self.task = Some((
                    self.generation,
                    tokio::task::spawn_blocking(move || read_panels(pid, exclude)),
                ));
            }
        }
        self.last
    }

    pub fn network_stability(&self) -> (Option<u32>, Vec<u32>) {
        let history: Vec<_> = self.network_history.iter().copied().collect();
        let steps = history.len().saturating_sub(1) as u32;
        let jitter = (steps > 0).then(|| {
            let total: u32 = history
                .windows(2)
                .map(|pair| pair[0].abs_diff(pair[1]))
                .sum();
            (total + steps / 2) / steps
        });
        (jitter, history)
    }
}

fn read_panels(pid: u32, exclude: Option<RECT>) -> Option<RobloxPings> {
    let Some((client, window)) = foreground_client_area(pid) else {
        return Some(RobloxPings::default());
    };
    let dpi = unsafe { GetDpiForWindow(window) };
    let (toolbar, debug) = panel_areas(client, dpi);
    let capture = |rect: RECT| {
        let mut pixels = capture_panel_area(rect)?;
        if let Some(exclude) = exclude {
            mask_overlay(&mut pixels, rect, exclude);
        }
        image::RgbaImage::from_raw(
            (rect.right - rect.left) as u32,
            (rect.bottom - rect.top) as u32,
            pixels,
        )
    };
    let toolbar = capture(toolbar);
    let debug = capture(debug);
    if unsafe { GetForegroundWindow() } != window {
        return Some(RobloxPings::default());
    }
    if toolbar.is_none() && debug.is_none() {
        return None;
    }
    unsafe { RoInitialize(RO_INIT_MULTITHREADED).ok()? };
    let result = recognize(toolbar.as_ref(), debug.as_ref());
    unsafe { RoUninitialize() };
    result.ok()
}

fn mask_overlay(pixels: &mut [u8], capture: RECT, overlay: RECT) {
    let left = overlay.left.max(capture.left);
    let right = overlay.right.min(capture.right);
    if left >= right {
        return;
    }
    let stride = (capture.right - capture.left) as usize * 4;
    let start = (left - capture.left) as usize * 4;
    let end = (right - capture.left) as usize * 4;
    for y in overlay.top.max(capture.top)..overlay.bottom.min(capture.bottom) {
        let row = (y - capture.top) as usize * stride;
        pixels[row + start..row + end].fill(0);
    }
}

fn foreground_client_area(pid: u32) -> Option<(RECT, HWND)> {
    unsafe {
        let window = GetForegroundWindow();
        let mut current_pid = 0;
        GetWindowThreadProcessId(window, Some(&mut current_pid));
        if current_pid != pid || IsIconic(window).as_bool() || !crate::runtime::is_player_pid(pid) {
            return None;
        }
        let mut rect = RECT::default();
        GetClientRect(window, &mut rect).ok()?;
        let mut origin = POINT::default();
        if !ClientToScreen(window, &mut origin).as_bool() {
            return None;
        }
        let mut monitor = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };
        let handle = MonitorFromWindow(window, MONITOR_DEFAULTTONEAREST);
        if !GetMonitorInfoW(handle, &mut monitor).as_bool() {
            return None;
        }
        let region = RECT {
            left: origin.x.max(monitor.rcMonitor.left),
            top: origin.y.max(monitor.rcMonitor.top),
            right: (origin.x + rect.right).min(monitor.rcMonitor.right),
            bottom: (origin.y + rect.bottom).min(monitor.rcMonitor.bottom),
        };
        (region.left < region.right && region.top < region.bottom).then_some((region, window))
    }
}

fn panel_areas(client: RECT, dpi: u32) -> (RECT, RECT) {
    let scale = |logical| logical * dpi.clamp(96, 192) as i32 / 96;
    (
        RECT {
            bottom: client.bottom.min(client.top + scale(190)),
            ..client
        },
        RECT {
            right: client.right.min(client.left + scale(440)),
            ..client
        },
    )
}

fn capture_panel_area(rect: RECT) -> Option<Vec<u8>> {
    let width = rect.right - rect.left;
    let height = rect.bottom - rect.top;
    let bitmap_info = BITMAPINFO {
        bmiHeader: BITMAPINFOHEADER {
            biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: width,
            biHeight: -height,
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB.0,
            ..Default::default()
        },
        ..Default::default()
    };
    unsafe {
        let desktop = HWND::default();
        let source = GetDC(desktop);
        if source.is_invalid() {
            return None;
        }
        let memory = CreateCompatibleDC(source);
        let result = (|| {
            if memory.is_invalid() {
                return None;
            }
            let mut data: *mut c_void = std::ptr::null_mut();
            let bitmap =
                CreateDIBSection(source, &bitmap_info, DIB_RGB_COLORS, &mut data, None, 0).ok()?;
            let previous = SelectObject(memory, bitmap);
            let pixels = if !previous.is_invalid()
                && !data.is_null()
                && BitBlt(
                    memory, 0, 0, width, height, source, rect.left, rect.top, SRCCOPY,
                )
                .is_ok()
                && GdiFlush().as_bool()
            {
                Some(
                    std::slice::from_raw_parts(
                        data.cast::<u8>(),
                        width as usize * height as usize * 4,
                    )
                    .to_vec(),
                )
            } else {
                None
            };
            if !previous.is_invalid() {
                SelectObject(memory, previous);
            }
            let _ = DeleteObject(bitmap);
            pixels
        })();
        if !memory.is_invalid() {
            let _ = DeleteDC(memory);
        }
        ReleaseDC(desktop, source);
        result
    }
}

fn recognize(
    toolbar: Option<&image::RgbaImage>,
    debug: Option<&image::RgbaImage>,
) -> windows::core::Result<RobloxPings> {
    let english = Language::CreateLanguage(&HSTRING::from("en-US"))?;
    let engine = OcrEngine::TryCreateFromLanguage(&english)
        .or_else(|_| OcrEngine::TryCreateFromUserProfileLanguages())?;
    let bound = OcrEngine::MaxImageDimension()?;
    Ok(RobloxPings {
        network_ms: toolbar
            .map(|frame| read_network_ping(frame, &engine, bound))
            .transpose()?
            .flatten(),
        data_ms: debug
            .map(|frame| read_data_ping(frame, &engine, bound))
            .transpose()?
            .flatten(),
    })
}

fn read_network_ping(
    frame: &image::RgbaImage,
    engine: &OcrEngine,
    bound: u32,
) -> windows::core::Result<Option<f32>> {
    let (width, height) = frame.dimensions();
    let mut lines = scan_tiles(frame, engine, bound, height, 720, 2)?;
    let mut network = parse_network_ping(&lines);
    if network.is_none() {
        // Small Performance Stats text can disappear when recognized with the whole bar.
        lines.extend(scan_tiles(frame, engine, bound, height, 256, 3)?);
        network = parse_network_ping(&lines);
    }
    if network.is_some() {
        return Ok(network);
    }
    for ping in lines.iter().flatten().filter(|word| {
        let key = word_label(&word.text);
        key == "networkping"
            || (matches!(key.as_str(), "ping" | "пинг") && performance_bar(&lines, word))
            || (is_compact_toolbar_label(&key) && word.x > width as f32 * 0.72)
    }) {
        let left = (ping.x - ping.height * 2.8).max(0.0) as u32;
        let top = (ping.y - ping.height * 1.1).max(0.0) as u32;
        let cell_width = ((ping.width + ping.height * 6.5).ceil() as u32).min(width - left);
        let cell_height = ((ping.height * 4.8).ceil() as u32).min(height - top);
        let cell_lines = read_ocr_region(
            frame,
            engine,
            bound,
            (left, top, cell_width, cell_height),
            (6, 4),
        )?;
        if let Some(ms) = below(&cell_lines, ping) {
            return Ok(Some(ms));
        }
    }
    Ok(None)
}

fn read_data_ping(
    frame: &image::RgbaImage,
    engine: &OcrEngine,
    bound: u32,
) -> windows::core::Result<Option<f32>> {
    let (width, height) = frame.dimensions();
    const TILE_HEIGHT: u32 = 260;
    const STRIDE: u32 = 200;
    let mut tops: Vec<_> = (0..height).step_by(STRIDE as usize).collect();
    tops.sort_by_key(|top| (top + TILE_HEIGHT / 2).abs_diff(height / 2));
    for top in tops {
        let tile_height = (height - top).min(TILE_HEIGHT);
        let lines = read_ocr_region(frame, engine, bound, (0, top, width, tile_height), (3, 3))?;
        if let Some(ms) = parse_data_ping(&lines) {
            return Ok(Some(ms));
        }
    }
    Ok(None)
}

fn scan_tiles(
    frame: &image::RgbaImage,
    engine: &OcrEngine,
    bound: u32,
    height: u32,
    tile_limit: u32,
    scale: u32,
) -> windows::core::Result<Vec<Vec<Word>>> {
    let width = frame.width();
    let overlap = tile_limit / 5;
    let mut lines = Vec::new();
    for left in (0..width).step_by((tile_limit - overlap) as usize) {
        let tile_width = (width - left).min(tile_limit);
        lines.extend(read_ocr_region(
            frame,
            engine,
            bound,
            (left, 0, tile_width, height),
            (scale, scale),
        )?);
        if left + tile_width == width {
            break;
        }
    }
    Ok(lines)
}

fn read_ocr_region(
    frame: &image::RgbaImage,
    engine: &OcrEngine,
    bound: u32,
    (left, top, width, height): (u32, u32, u32, u32),
    (scale_x, scale_y): (u32, u32),
) -> windows::core::Result<Vec<Vec<Word>>> {
    let view = image::GenericImageView::view(frame, left, top, width, height);
    let ocr_width = (width * scale_x).min(bound);
    let ocr_height = (height * scale_y).min(bound);
    let image = if scale_x == scale_y {
        image::imageops::resize(
            &*view,
            ocr_width,
            ocr_height,
            image::imageops::FilterType::Triangle,
        )
    } else {
        image::RgbaImage::from_fn(ocr_width, ocr_height, |x, y| {
            let sx = left as f32 + (x as f32 + 0.5) * width as f32 / ocr_width as f32 - 0.5;
            let sy = top as f32 + (y as f32 + 0.5) * height as f32 / ocr_height as f32 - 0.5;
            let sample = image::imageops::interpolate_bilinear(
                frame,
                sx.clamp(0.0, (frame.width() - 1) as f32),
                sy.clamp(0.0, (frame.height() - 1) as f32),
            )
            .unwrap_or(image::Rgba([0, 0, 0, 255]));
            let level = sample[0].min(sample[1]).min(sample[2]);
            image::Rgba([level, level, level, 255])
        })
    };
    let writer = DataWriter::new()?;
    writer.WriteBytes(image.as_raw())?;
    let buffer = writer.DetachBuffer()?;
    let bitmap = SoftwareBitmap::CreateCopyWithAlphaFromBuffer(
        &buffer,
        BitmapPixelFormat::Bgra8,
        ocr_width as i32,
        ocr_height as i32,
        BitmapAlphaMode::Ignore,
    )?;
    let result = engine.RecognizeAsync(&bitmap)?.get()?;
    let sx = width as f32 / ocr_width as f32;
    let sy = height as f32 / ocr_height as f32;
    let mut lines = Vec::new();
    for line in result.Lines()? {
        let mut words = Vec::new();
        for word in line.Words()? {
            let rect = word.BoundingRect()?;
            words.push(Word {
                text: word.Text()?.to_string_lossy(),
                x: left as f32 + rect.X * sx,
                y: top as f32 + rect.Y * sy,
                width: rect.Width * sx,
                height: rect.Height * sy,
            });
        }
        words.sort_by(|a, b| a.x.total_cmp(&b.x));
        lines.push(words);
    }
    Ok(lines)
}

#[derive(Debug)]
struct Word {
    text: String,
    x: f32,
    y: f32,
    width: f32,
    height: f32,
}

impl Word {
    fn right(&self) -> f32 {
        self.x + self.width
    }
    fn center(&self) -> f32 {
        self.x + self.width / 2.0
    }
}

fn label(text: &str) -> String {
    text.chars()
        .filter(|ch| ch.is_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect()
}

fn word_label(text: &str) -> String {
    label(text.split([':', '=']).next().unwrap_or(text))
}

fn adjacent_unit<'a>(value: &Word, next: Option<&'a Word>) -> Option<&'a str> {
    next.filter(|word| word.x - value.right() <= value.height * 1.5)
        .map(|word| word.text.as_str())
}

fn number_ms(text: &str, unit: Option<&str>, required: bool) -> Option<f32> {
    let text = text.trim_matches(|ch: char| ch.is_whitespace() || matches!(ch, ':' | '(' | ')'));
    let text = text.trim_end_matches(&[',', ';'][..]);
    let lower = text.to_lowercase();
    let inline = lower
        .strip_suffix("ms")
        .or_else(|| lower.strip_suffix("мс"));
    if required
        && inline.is_none()
        && !unit.is_some_and(|word| matches!(label(word).as_str(), "ms" | "мс"))
    {
        return None;
    }
    let raw = inline.unwrap_or(&lower).replace(',', ".");
    let value = if raw
        .bytes()
        .all(|byte| byte.is_ascii_digit() || byte == b'.')
    {
        raw.parse::<f32>().ok()?
    } else if required {
        // Only correct lookalikes in an explicitly delimited fraction with
        // a recognized whole number and unit. A letters-only token is ignored.
        let (integer, fraction) = raw.split_once(['.', '-'])?;
        if fraction.len() != 2
            || !integer.bytes().all(|byte| byte.is_ascii_digit())
            || (raw.contains('-') && fraction.bytes().all(|byte| byte.is_ascii_digit()))
        {
            return None;
        }
        let fraction: String = fraction
            .chars()
            .map(|ch| match ch {
                'o' => '0',
                's' => '5',
                digit => digit,
            })
            .collect();
        if !fraction.bytes().all(|byte| byte.is_ascii_digit()) {
            return None;
        }
        integer.parse::<f32>().ok()? + fraction.parse::<f32>().ok()? / 100.0
    } else {
        return None;
    };
    (0.0..=9999.0).contains(&value).then_some(value)
}

fn beside(line: &[Word], end: usize, require_unit: bool) -> Option<f32> {
    let anchor = line.get(end)?;
    let mut tail = &line[end + 1..];
    if let Some((_, value)) = anchor.text.split_once([':', '=']) {
        if let Some(ms) = number_ms(value, adjacent_unit(anchor, tail.first()), require_unit) {
            return Some(ms);
        }
    }
    if tail
        .first()
        .is_some_and(|word| word.text == ":" || word.text == "=")
    {
        tail = &tail[1..];
    }
    let value = tail.first()?;
    if value.x - anchor.right() > anchor.height * 7.0 {
        return None;
    }
    number_ms(&value.text, adjacent_unit(value, tail.get(1)), require_unit)
}

fn below(lines: &[Vec<Word>], anchor: &Word) -> Option<f32> {
    lines
        .iter()
        .flat_map(|line| {
            line.iter().enumerate().filter_map(|(index, value)| {
                let down = value.y - anchor.y;
                let horizontal = (value.x - anchor.x)
                    .abs()
                    .min((value.center() - anchor.center()).abs());
                if down < anchor.height * 0.6
                    || down > anchor.height * 3.2
                    || horizontal > anchor.height * 2.6
                {
                    return None;
                }
                let ms = number_ms(&value.text, adjacent_unit(value, line.get(index + 1)), true)?;
                Some((down + horizontal, ms))
            })
        })
        .min_by(|a, b| a.0.total_cmp(&b.0))
        .map(|(_, ms)| ms)
}

fn performance_bar(lines: &[Vec<Word>], ping: &Word) -> bool {
    let mut cpu = false;
    let mut gpu = false;
    let mut traffic = false;
    for word in lines
        .iter()
        .flatten()
        .filter(|word| (word.y - ping.y).abs() <= ping.height * 1.8 && word.x < ping.x)
    {
        match label(&word.text).as_str() {
            "cpu" | "цп" => cpu = true,
            "gpu" | "гп" => gpu = true,
            "sent" | "recv" | "received" | "отправлено" | "получено" => {
                traffic = true
            }
            _ => {}
        }
    }
    cpu && gpu && traffic
}

fn is_compact_toolbar_label(key: &str) -> bool {
    // Windows OCR can merge the tiny "rk" in Roblox's NetworkPing label.
    key.starts_with("netwo") && key.ends_with("ping") && (10..=11).contains(&key.chars().count())
}

fn preceded_by_average(lines: &[Vec<Word>], label_word: &Word) -> bool {
    lines.iter().flatten().any(|word| {
        (word.y - label_word.y).abs() <= label_word.height * 0.65
            && word.right() <= label_word.x + 2.0
            && label_word.x - word.right() <= label_word.height * 1.8
            && matches!(
                label(&word.text).as_str(),
                "avg" | "average" | "ср" | "средний"
            )
    })
}

fn replicator_ping(lines: &[Vec<Word>]) -> Option<f32> {
    for line in lines {
        let Some(general) = line.iter().find(|word| label(&word.text) == "general") else {
            continue;
        };
        if !line.iter().any(|word| label(&word.text) == "size")
            || !line
                .iter()
                .any(|word| matches!(word_label(&word.text).as_str(), "ping" | "dataping"))
            || !lines.iter().flatten().any(|word| {
                label(&word.text) == "replicator"
                    && (0.0..=4.0 * general.height).contains(&(general.y - word.y))
                    && (general.x - word.x).abs() < general.height * 8.0
            })
        {
            continue;
        }
        // Roblox indents the value row and puts the ping after the MTU, far
        // to the left of the "Data Ping" header.
        for row in lines {
            for (index, mtu) in row.iter().enumerate() {
                if !(general.height * 0.55..=general.height * 2.4).contains(&(mtu.y - general.y))
                    || !(0.0..=general.height * 10.0).contains(&(mtu.x - general.x))
                {
                    continue;
                }
                let (mtu_text, inline) = mtu.text.split_once(',').unwrap_or((&mtu.text, ""));
                if !mtu_text.parse::<u16>().is_ok_and(|mtu| mtu >= 256) {
                    continue;
                }
                let next = row.get(index + 1);
                let ms = if inline.is_empty() {
                    next.filter(|word| word.x - mtu.right() <= general.height * 2.0)
                        .and_then(|word| {
                            replication_value(word, row.get(index + 2), row.get(index + 3))
                        })
                } else {
                    number_ms(inline, adjacent_unit(mtu, next), true)
                };
                if ms.is_some() {
                    return ms;
                }
            }
        }
    }
    None
}

fn replication_value(value: &Word, next: Option<&Word>, unit: Option<&Word>) -> Option<f32> {
    if let Some(ms) = number_ms(&value.text, adjacent_unit(value, next), true) {
        return Some(ms);
    }
    // A faint dot in the monospace value can turn "77.42ms" into "77 42ms".
    // The Replicator row has exactly one latency field, so the adjacent
    // two digits with a unit are its fraction.
    let next = next?;
    let gap = next.x - value.right();
    let character_width = value.width / value.text.len().max(1) as f32;
    if !(character_width * 0.4..=character_width * 1.65).contains(&gap)
        || !value.text.bytes().all(|byte| byte.is_ascii_digit())
    {
        return None;
    }
    let raw = next.text.to_lowercase();
    let fraction = raw
        .strip_suffix("ms")
        .or_else(|| raw.strip_suffix("мс"))
        .unwrap_or(&raw);
    if fraction.len() != 2 || !fraction.bytes().all(|byte| byte.is_ascii_digit()) {
        return None;
    }
    let number = format!("{}.{}", value.text, raw);
    number_ms(&number, adjacent_unit(next, unit), true)
}

fn parse_network_ping(lines: &[Vec<Word>]) -> Option<f32> {
    find_labeled_ping(lines, false)
}

fn parse_data_ping(lines: &[Vec<Word>]) -> Option<f32> {
    replicator_ping(lines).or_else(|| find_labeled_ping(lines, true))
}

fn find_labeled_ping(lines: &[Vec<Word>], data: bool) -> Option<f32> {
    for line in lines {
        for (i, word) in line.iter().enumerate() {
            let key = word_label(&word.text);
            let next = line
                .get(i + 1)
                .filter(|next| next.x - word.right() <= word.height * 2.0);
            let pair = next.map(|next| key.clone() + &word_label(&next.text));
            let end = match (data, key.as_str(), pair.as_deref()) {
                (true, "dataping", _) | (false, "networkping", _) => i,
                (true, _, Some("dataping" | "пингданных" | "задержкаданных"))
                | (false, _, Some("networkping" | "сетевойпинг" | "сетеваязадержка")) => {
                    i + 1
                }
                (false, "ping" | "пинг", _) if performance_bar(lines, word) => i,
                _ => continue,
            };
            if data && preceded_by_average(lines, word) {
                continue;
            }
            if let Some(ms) = beside(line, end, true).or_else(|| below(lines, word)) {
                return Some(ms);
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    fn words(text: &str, x: f32, y: f32) -> Vec<Word> {
        let mut x = x;
        text.split_whitespace()
            .map(|text| {
                let width = text.chars().count() as f32 * 7.0;
                let word = Word {
                    text: text.to_owned(),
                    x,
                    y,
                    width,
                    height: 15.0,
                };
                x += width + 6.0;
                word
            })
            .collect()
    }

    #[test]
    fn reads_explicit_roblox_ping_labels_independently() {
        let panels = [
            words("Data Ping:76.25ms", 40.0, 90.0),
            words("Network Ping: 42.50 ms", 960.0, 60.0),
        ];
        assert_eq!(parse_network_ping(&panels), Some(42.5));
        assert_eq!(parse_data_ping(&panels), Some(76.25));
    }

    #[test]
    fn fractional_ocr_correction_requires_a_number_and_units() {
        assert_eq!(number_ms("42-SO", Some("ms"), true), Some(42.5));
        assert_eq!(number_ms("ZSO", Some("ms"), true), None);
        assert_eq!(number_ms("42-50", Some("ms"), true), None);
        assert_eq!(number_ms("42-SO", None, true), None);
    }

    #[test]
    fn only_uses_unqualified_ping_in_the_performance_stats_toolbar() {
        let panels = [
            words("Mem CPU GPU Sent Recv Ping", 50.0, 20.0),
            words("36.50 ms", 225.0, 37.0),
            words("Data Ping 64 ms", 40.0, 85.0),
        ];
        assert_eq!(parse_network_ping(&panels), Some(36.5));
        assert_eq!(parse_data_ping(&panels), Some(64.0));
        assert_eq!(parse_network_ping(&[words("Ping 36 ms", 10.0, 10.0)]), None);
    }

    #[test]
    fn reads_roblox_toolbar_and_replication_layouts() {
        let panels = [
            words("NetworkPing", 1608.0, 90.0),
            words("51 ms", 1608.0, 105.0),
            words("Avg. Data Ping: 103 ms", 660.0, 200.0),
            words("----- Replicator -----", 55.0, 480.0),
            words("General (MTU Size, Data Ping):", 55.0, 498.0),
            words("1232, 77.42ms", 87.0, 515.0),
        ];
        assert_eq!(parse_network_ping(&panels), Some(51.0));
        assert_eq!(parse_data_ping(&panels), Some(77.42));
        assert_eq!(parse_data_ping(&panels[..3]), None);
        let mut split = panels;
        split[5] = words("11232 77 42ms", 87.0, 515.0);
        assert_eq!(parse_data_ping(&split), Some(77.42));
    }

    #[test]
    #[ignore = "requires Windows OCR and VORTEX_OCR_TEST_IMAGE pointing to a local stats screenshot"]
    fn recognizes_both_pings_in_windows_ocr() {
        let path = std::env::var_os("VORTEX_OCR_TEST_IMAGE").expect("set the fixture path");
        let mut pixels = image::open(path).expect("read fixture").to_rgba8();
        let (width, height) = pixels.dimensions();
        for pixel in pixels.chunks_exact_mut(4) {
            pixel.swap(0, 2);
        }
        let (toolbar, debug) = panel_areas(
            RECT {
                left: 0,
                top: 0,
                right: width as i32,
                bottom: height as i32,
            },
            96,
        );
        let toolbar =
            image::imageops::crop_imm(&pixels, 0, 0, width, toolbar.bottom as u32).to_image();
        let debug = image::imageops::crop_imm(&pixels, 0, 0, debug.right as u32, height).to_image();
        unsafe { RoInitialize(RO_INIT_MULTITHREADED).expect("initialize WinRT") };
        let result = recognize(Some(&toolbar), Some(&debug));
        unsafe { RoUninitialize() };
        let expected = |name, default| match std::env::var(name) {
            Ok(value) if value == "none" => None,
            Ok(value) => Some(value.parse().unwrap()),
            Err(_) => Some(default),
        };
        assert_eq!(
            result.expect("recognize fixture"),
            RobloxPings {
                network_ms: expected("VORTEX_OCR_TEST_NETWORK", 42.5),
                data_ms: expected("VORTEX_OCR_TEST_DATA", 76.25),
            }
        );
    }
}
