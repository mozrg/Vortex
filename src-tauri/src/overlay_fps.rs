//! Frame rate of the Roblox process, read from the Windows WDDM kernel
//! (`gdi32!D3DKMTQueryStatistics`).
//!
//! For every `IDXGISwapChain::Present` call, `dxgkrnl.sys` increments the
//! presenting process's per-node `D3DKMT_SoftwareCommandBuffer` counter (for
//! flip-model swap chains) or per-VidPnSource `Frame` counter (for blt or
//! direct-flip swap chains). Sampling those counters for the game's `HANDLE`
//! gives the exact `Present` rate in-process without administrator rights,
//! UAC prompts, helper executables, console windows, desktop frame copies or
//! hooks inside Roblox.
use serde::Serialize;
use std::time::{Duration, Instant};
use tokio::{
    sync::{oneshot, watch},
    task::JoinHandle,
};
use windows::Win32::{
    Foundation::{CloseHandle, HANDLE, LUID},
    Graphics::Dxgi::{CreateDXGIFactory1, IDXGIFactory1},
    System::Threading::{OpenProcess, PROCESS_QUERY_INFORMATION},
};

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Fps {
    #[default]
    Idle,
    Collecting,
    Unavailable,
    Measured(u32),
}

pub struct Capture {
    pub pid: u32,
    pub samples: watch::Receiver<Fps>,
    stop: oneshot::Sender<()>,
    task: JoinHandle<()>,
}

impl Capture {
    pub fn start(pid: u32) -> Self {
        let (send, samples) = watch::channel(Fps::Collecting);
        let (stop, cancel) = oneshot::channel();
        let task = tokio::task::spawn_blocking(move || {
            let result = sample(pid, || crate::runtime::is_player_pid(pid), &send, cancel);
            let _ = send.send(result);
        });
        Self {
            pid,
            samples,
            stop,
            task,
        }
    }

    pub async fn stop(self) {
        let _ = self.stop.send(());
        let _ = self.task.await;
    }
}

const QUERY_ADAPTER: u32 = 0;
const QUERY_PROCESS_NODE: u32 = 6;
const QUERY_PROCESS_VIDPNSOURCE: u32 = 8;

/// Index of `QueuePacket[D3DKMT_SoftwareCommandBuffer].PacketCompleted` inside
/// `D3DKMT_QUERYSTATISTICS_PROCESS_NODE_INFORMATION` (as `u32` words):
/// `RunningTime` (2) + `ContextSwitch` (1) + `PreemptionStatistics` (16) +
/// 7 * 2 (`QueuePacket[0..7]`) + 1 (`PacketCompleted`) = 34.
const SOFTWARE_PACKET_COMPLETED: usize = 34;
/// Index of `QueuePacket[D3DKMT_MmIoFlipCommandBuffer].PacketCompleted` (3 * 2 + 19 + 1 = 26).
const FLIP_PACKET_COMPLETED: usize = 26;

/// `D3DKMT_QUERYSTATISTICS` is 0x328 (808) bytes on x64 Windows.
#[repr(C)]
#[derive(Clone, Copy)]
struct QueryStatistics {
    kind: u32,
    luid: LUID,
    pad: u32,
    process: isize,
    result: [u32; 194],
    target_id: u32,
    tail_pad: u32,
}

#[link(name = "gdi32")]
extern "system" {
    fn D3DKMTQueryStatistics(query: *mut QueryStatistics) -> i32;
}

struct ProcessHandle(HANDLE);

impl ProcessHandle {
    fn open(pid: u32) -> Option<Self> {
        unsafe { OpenProcess(PROCESS_QUERY_INFORMATION, false, pid).ok().map(Self) }
    }
}

impl Drop for ProcessHandle {
    fn drop(&mut self) {
        unsafe {
            let _ = CloseHandle(self.0);
        }
    }
}

#[derive(Clone, Copy)]
struct AdapterCounters {
    luid: LUID,
    nodes: u32,
    vidpns: u32,
}

struct CounterSnapshot {
    nodes: Vec<u32>,
    flips: Vec<u32>,
    vidpns: Vec<u32>,
}

fn adapters() -> Vec<AdapterCounters> {
    let mut list = Vec::new();
    unsafe {
        let Ok(factory) = CreateDXGIFactory1::<IDXGIFactory1>() else {
            return list;
        };
        let mut index = 0;
        while let Ok(adapter) = factory.EnumAdapters1(index) {
            index += 1;
            let Ok(desc) = adapter.GetDesc1() else {
                continue;
            };
            let mut query = QueryStatistics {
                kind: QUERY_ADAPTER,
                luid: desc.AdapterLuid,
                pad: 0,
                process: 0,
                result: [0; 194],
                target_id: 0,
                tail_pad: 0,
            };
            if D3DKMTQueryStatistics(&mut query) == 0 {
                let nodes = query.result[1].min(64);
                let vidpns = query.result[2].min(16);
                if nodes > 0 || vidpns > 0 {
                    list.push(AdapterCounters {
                        luid: desc.AdapterLuid,
                        nodes,
                        vidpns,
                    });
                }
            }
        }
    }
    list
}

fn read_counters(process: HANDLE, adapters: &[AdapterCounters]) -> CounterSnapshot {
    let mut nodes = Vec::new();
    let mut flips = Vec::new();
    let mut vidpns = Vec::new();
    unsafe {
        for adapter in adapters {
            let base = QueryStatistics {
                kind: 0,
                luid: adapter.luid,
                pad: 0,
                process: process.0 as isize,
                result: [0; 194],
                target_id: 0,
                tail_pad: 0,
            };
            for node in 0..adapter.nodes {
                let mut query = QueryStatistics {
                    kind: QUERY_PROCESS_NODE,
                    target_id: node,
                    ..base
                };
                if D3DKMTQueryStatistics(&mut query) == 0 {
                    nodes.push(query.result[SOFTWARE_PACKET_COMPLETED]);
                    flips.push(query.result[FLIP_PACKET_COMPLETED]);
                } else {
                    nodes.push(0);
                    flips.push(0);
                }
            }
            for vidpn in 0..adapter.vidpns {
                let mut query = QueryStatistics {
                    kind: QUERY_PROCESS_VIDPNSOURCE,
                    target_id: vidpn,
                    ..base
                };
                if D3DKMTQueryStatistics(&mut query) == 0 {
                    vidpns.push(query.result[0]);
                } else {
                    vidpns.push(0);
                }
            }
        }
    }
    CounterSnapshot {
        nodes,
        flips,
        vidpns,
    }
}

fn max_delta(previous: &[u32], current: &[u32]) -> u32 {
    previous
        .iter()
        .zip(current.iter())
        .map(|(old, new)| new.wrapping_sub(*old))
        .max()
        .unwrap_or(0)
}

/// Frames presented between two snapshots on the most active engine/output.
fn frame_delta(previous: &CounterSnapshot, current: &CounterSnapshot) -> u32 {
    let software = max_delta(&previous.nodes, &current.nodes);
    let vidpn = max_delta(&previous.vidpns, &current.vidpns);
    let flip = max_delta(&previous.flips, &current.flips);
    software.max(vidpn).max(flip)
}

fn rate(frames: u32, elapsed: Duration) -> Fps {
    let millis = elapsed.as_millis().max(1) as f64;
    match (f64::from(frames) * 1000.0 / millis).round() as u32 {
        0 => Fps::Collecting,
        fps => Fps::Measured(fps),
    }
}

fn sample(
    pid: u32,
    mut alive: impl FnMut() -> bool,
    samples: &watch::Sender<Fps>,
    mut cancel: oneshot::Receiver<()>,
) -> Fps {
    let Some(process) = ProcessHandle::open(pid) else {
        return Fps::Unavailable;
    };
    let list = adapters();
    if list.is_empty() {
        return Fps::Unavailable;
    }
    let mut previous = read_counters(process.0, &list);
    let mut last_at = Instant::now();
    loop {
        for _ in 0..10 {
            if !matches!(cancel.try_recv(), Err(oneshot::error::TryRecvError::Empty)) {
                return Fps::Idle;
            }
            std::thread::sleep(Duration::from_millis(100));
        }
        if !alive() {
            return Fps::Idle;
        }
        let now = Instant::now();
        let current = read_counters(process.0, &list);
        let frames = frame_delta(&previous, &current);
        let next = rate(frames, now.duration_since(last_at));
        previous = current;
        last_at = now;
        samples.send_if_modified(|old| std::mem::replace(old, next) != next);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reports_rate_per_elapsed_time_and_picks_dominant_engine() {
        assert_eq!(rate(60, Duration::from_millis(1000)), Fps::Measured(60));
        assert_eq!(rate(72, Duration::from_millis(1200)), Fps::Measured(60));
        assert_eq!(rate(0, Duration::from_millis(1000)), Fps::Collecting);
        let before = CounterSnapshot {
            nodes: vec![100, 5],
            flips: vec![0, 0],
            vidpns: vec![0],
        };
        let after = CounterSnapshot {
            nodes: vec![175, 8],
            flips: vec![0, 0],
            vidpns: vec![0],
        };
        assert_eq!(frame_delta(&before, &after), 75);
    }

    #[test]
    fn serializes_states_for_the_overlay() {
        assert_eq!(
            serde_json::to_value(Fps::Measured(144)).unwrap(),
            serde_json::json!({"measured": 144})
        );
        assert_eq!(
            serde_json::to_value(Fps::Collecting).unwrap(),
            serde_json::json!("collecting")
        );
    }

    /// Presents a D3D11 flip-model swap chain at a fixed rate (with multiple
    /// command buffer flushes per frame) and checks that the WDDM counter
    /// measures the exact `Present` rate.
    #[test]
    #[ignore = "creates a D3D11 swap chain and samples WDDM counters; run with --ignored"]
    fn measures_a_window_painting_at_a_known_rate() {
        use windows::core::w;
        use windows::Win32::Foundation::{HMODULE, HWND, LPARAM, LRESULT, WPARAM};
        use windows::Win32::Graphics::Direct3D::D3D_DRIVER_TYPE_HARDWARE;
        use windows::Win32::Graphics::Direct3D11::{
            D3D11CreateDeviceAndSwapChain, ID3D11RenderTargetView, ID3D11Texture2D,
            D3D11_CREATE_DEVICE_BGRA_SUPPORT, D3D11_SDK_VERSION,
        };
        use windows::Win32::Graphics::Dxgi::{
            Common::{DXGI_FORMAT_B8G8R8A8_UNORM, DXGI_MODE_DESC, DXGI_SAMPLE_DESC},
            IDXGISwapChain, DXGI_PRESENT, DXGI_SWAP_CHAIN_DESC, DXGI_SWAP_EFFECT_FLIP_DISCARD,
            DXGI_USAGE_RENDER_TARGET_OUTPUT,
        };
        use windows::Win32::UI::WindowsAndMessaging::*;

        extern "system" fn proc(hwnd: HWND, msg: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
            unsafe { DefWindowProcW(hwnd, msg, wparam, lparam) }
        }

        const PAINT_HZ: u64 = 75;
        let (send, receive) = watch::channel(Fps::Collecting);
        let (_stop, cancel) = oneshot::channel::<()>();
        let (ready_tx, ready_rx) = std::sync::mpsc::channel::<()>();
        let painter = std::thread::spawn(move || unsafe {
            let class = WNDCLASSW {
                lpfnWndProc: Some(proc),
                lpszClassName: w!("VortexFpsProbe"),
                ..Default::default()
            };
            RegisterClassW(&class);
            let hwnd = CreateWindowExW(
                WS_EX_TOPMOST | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE,
                w!("VortexFpsProbe"),
                w!("Vortex FPS probe"),
                WS_POPUP | WS_VISIBLE,
                120,
                120,
                360,
                240,
                None,
                None,
                None,
                None,
            )
            .unwrap();
            let desc = DXGI_SWAP_CHAIN_DESC {
                BufferDesc: DXGI_MODE_DESC {
                    Width: 360,
                    Height: 240,
                    Format: DXGI_FORMAT_B8G8R8A8_UNORM,
                    ..Default::default()
                },
                SampleDesc: DXGI_SAMPLE_DESC {
                    Count: 1,
                    Quality: 0,
                },
                BufferUsage: DXGI_USAGE_RENDER_TARGET_OUTPUT,
                BufferCount: 2,
                OutputWindow: hwnd,
                Windowed: true.into(),
                SwapEffect: DXGI_SWAP_EFFECT_FLIP_DISCARD,
                Flags: 0,
            };
            let mut swap_chain: Option<IDXGISwapChain> = None;
            let mut device = None;
            let mut context = None;
            D3D11CreateDeviceAndSwapChain(
                None,
                D3D_DRIVER_TYPE_HARDWARE,
                HMODULE::default(),
                D3D11_CREATE_DEVICE_BGRA_SUPPORT,
                None,
                D3D11_SDK_VERSION,
                Some(&desc),
                Some(&mut swap_chain),
                Some(&mut device),
                None,
                Some(&mut context),
            )
            .unwrap();
            let swap_chain = swap_chain.unwrap();
            let device = device.unwrap();
            let context = context.unwrap();
            let back: ID3D11Texture2D = swap_chain.GetBuffer(0).unwrap();
            let mut rtv: Option<ID3D11RenderTargetView> = None;
            device
                .CreateRenderTargetView(&back, None, Some(&mut rtv))
                .unwrap();
            let rtv = rtv.unwrap();
            ready_tx.send(()).unwrap();
            let started = Instant::now();
            let mut message = MSG::default();
            let mut next = Instant::now();
            let mut frame = 0u32;
            while started.elapsed() < Duration::from_millis(2600) {
                while PeekMessageW(&mut message, None, 0, 0, PM_REMOVE).as_bool() {
                    let _ = TranslateMessage(&message);
                    DispatchMessageW(&message);
                }
                if Instant::now() >= next {
                    next += Duration::from_micros(1_000_000 / PAINT_HZ);
                    frame += 1;
                    for pass in 0..4 {
                        let color = [((frame + pass) % 2) as f32 * 0.5, 0.2, 0.8, 1.0];
                        context.ClearRenderTargetView(&rtv, &color);
                        context.Flush();
                    }
                    let _ = swap_chain.Present(0, DXGI_PRESENT(0));
                }
                std::thread::sleep(Duration::from_millis(1));
            }
            let _ = DestroyWindow(hwnd);
        });
        ready_rx.recv().unwrap();
        let started = Instant::now();
        let mut alive = || started.elapsed() < Duration::from_millis(2200);
        let sampler = std::thread::spawn({
            let mut receive = receive.clone();
            move || {
                let mut values = Vec::new();
                let runtime = tokio::runtime::Builder::new_current_thread()
                    .enable_time()
                    .build()
                    .unwrap();
                runtime.block_on(async {
                    while receive.changed().await.is_ok() {
                        values.push(*receive.borrow());
                    }
                });
                values
            }
        });
        let result = sample(std::process::id(), &mut alive, &send, cancel);
        drop(send);
        let readings = sampler.join().unwrap();
        painter.join().unwrap();
        println!("presented at {PAINT_HZ} Hz -> readings {readings:?}; final {result:?}");
        let measured: Vec<u32> = readings
            .iter()
            .filter_map(|value| match value {
                Fps::Measured(fps) => Some(*fps),
                _ => None,
            })
            .collect();
        assert!(!measured.is_empty(), "no frame rate was measured");
        assert!(
            measured
                .iter()
                .any(|&fps| (PAINT_HZ as u32 - 5..=PAINT_HZ as u32 + 5).contains(&fps)),
            "measured {measured:?}, expected about {PAINT_HZ}"
        );
    }
}
