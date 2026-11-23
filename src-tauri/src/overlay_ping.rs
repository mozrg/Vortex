//! Live latency, jitter, and server-region probe to the active Roblox game
//! server's datacenter edge.
//!
//! Every Roblox UDMUX `/24` subnet (`a.b.c.x`) hosts the datacenter's edge
//! load balancer at `a.b.c.3` (ports 443 and 80). Measuring the TCP handshake
//! RTT directly on the physical network interface (bypassing any local TUN
//! proxy that intercepts `0.0.0.0` in <12 ms) and adding Roblox's 60 Hz
//! replication frame step (~21 ms) matches the in-game `DataPing` shown by
//! Roblox's Performance Stats while also tracking connection jitter (`±ms`),
//! recent ping history for the mini-sparkline, and the server's region code.
use serde::Serialize;
use std::{
    collections::VecDeque,
    io::{Read, Write},
    net::{Ipv4Addr, SocketAddr, SocketAddrV4, TcpStream},
    time::{Duration, Instant},
};
use tokio::{
    sync::{oneshot, watch},
    task::JoinHandle,
};

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Ping {
    #[default]
    Idle,
    Measuring,
    Unavailable,
    Measured(u32),
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PingSnapshot {
    pub state: Ping,
    pub jitter: Option<u32>,
    pub history: Vec<u32>,
    pub region: Option<String>,
    pub bad_server: bool,
}

const TIMEOUT: Duration = Duration::from_millis(750);
const INTERVAL: Duration = Duration::from_secs(2);
const LIST_INTERVAL: Duration = Duration::from_secs(20);
const RECENT: usize = 5;
const HISTORY_LEN: usize = 12;
const MIN_PHYSICAL_RTT_MS: u32 = 12;
const ROBLOX_DATAPING_FRAME_MS: u32 = 21;
/// Threshold at or above which the server is flagged as a high-ping / bad region.
pub const BAD_PING_THRESHOLD_MS: u32 = 130;
pub const BAD_JITTER_THRESHOLD_MS: u32 = 25;

/// Only public unicast IPv4 addresses are reachable from the player machine;
/// the private RCC address in the join line is not.
pub fn public_ip(ip: Option<&str>) -> Option<Ipv4Addr> {
    let address: Ipv4Addr = ip?.parse().ok()?;
    let reachable = !(address.is_private()
        || address.is_loopback()
        || address.is_link_local()
        || address.is_unspecified()
        || address.is_broadcast()
        || address.is_multicast()
        || address.is_documentation()
        || (address.octets()[0] == 100 && (64..128).contains(&address.octets()[1])));
    reachable.then_some(address)
}

/// Detect the Roblox datacenter region code (`FRA`, `AMS`, `PAR`, `LON`, etc.)
/// from the public UDMUX IPv4 address and optional measured ping.
pub fn detect_region(udmux: Option<Ipv4Addr>, ping_ms: Option<u32>) -> Option<String> {
    if let Some(ip) = udmux {
        let [a, b, c, _] = ip.octets();
        let known = match (a, b, c) {
            (128, 116, 5 | 44 | 119 | 122) => Some("FRA"),
            (128, 116, 21 | 116) => Some("AMS"),
            (128, 116, 13) => Some("PAR"),
            (128, 116, 31 | 35) => Some("LON"),
            (128, 116, 102 | 123) => Some("WAR"),
            (128, 116, 30 | 32) => Some("NYC"),
            (128, 116, 53 | 117) => Some("IAD"),
            (128, 116, 48 | 84) => Some("ORD"),
            (128, 116, 56 | 95) => Some("DFW"),
            (128, 116, 45 | 127) => Some("MIA"),
            (128, 116, 2) => Some("ATL"),
            (128, 116, 1 | 63) => Some("LAX"),
            (128, 116, 54 | 104) => Some("SJC"),
            (128, 116, 115) | (34, 222, _) => Some("SEA"),
            (128, 116, 46 | 50 | 97) => Some("SIN"),
            (128, 116, 55 | 120) => Some("TYO"),
            (128, 116, 99) => Some("HKG"),
            (128, 116, 47) => Some("BOM"),
            (128, 116, 51) => Some("SYD"),
            (128, 116, 86) => Some("GRU"),
            (96, 0, 18) => Some("LIM"),
            _ => None,
        };
        if let Some(code) = known {
            return Some(code.to_string());
        }
    }
    match ping_ms {
        Some(ms) if ms <= 105 => Some("EU".to_string()),
        Some(ms) if ms <= 185 => Some("US".to_string()),
        Some(_) => Some("ASIA".to_string()),
        None => udmux.map(|_| "RBLX".to_string()),
    }
}

/// The edge load balancer in the same `/24` datacenter subnet as the UDMUX IP.
fn datacenter_edge(udmux: Ipv4Addr) -> Ipv4Addr {
    let [a, b, c, _] = udmux.octets();
    Ipv4Addr::new(a, b, c, 3)
}

/// Median of the recent samples so a single delayed packet doesn't spike the HUD.
fn median(samples: &VecDeque<u32>) -> Option<u32> {
    let mut sorted: Vec<u32> = samples.iter().copied().collect();
    sorted.sort_unstable();
    sorted.get(sorted.len() / 2).copied()
}

/// Mean absolute step difference (`±ms` jitter) across the recent history.
pub fn compute_jitter(history: &[u32]) -> Option<u32> {
    if history.len() < 2 {
        return None;
    }
    let total: u32 = history
        .windows(2)
        .map(|pair| pair[0].abs_diff(pair[1]))
        .sum();
    let count = (history.len() - 1) as u32;
    Some((total + count / 2) / count)
}

#[repr(C)]
#[derive(Clone, Copy)]
struct SockAddrIn {
    family: u16,
    port: u16,
    addr: [u8; 4],
    zero: [u8; 8],
}

#[repr(C)]
struct FdSet {
    count: u32,
    sockets: [usize; 1],
}

#[repr(C)]
struct TimeVal {
    sec: i32,
    usec: i32,
}

#[repr(C)]
struct HostEnt {
    name: *mut i8,
    aliases: *mut *mut i8,
    addr_type: i16,
    length: i16,
    addr_list: *mut *mut u8,
}

#[link(name = "ws2_32")]
extern "system" {
    fn socket(af: i32, kind: i32, protocol: i32) -> usize;
    fn bind(s: usize, name: *const SockAddrIn, namelen: i32) -> i32;
    fn connect(s: usize, name: *const SockAddrIn, namelen: i32) -> i32;
    fn ioctlsocket(s: usize, cmd: i32, argp: *mut u32) -> i32;
    fn select(
        nfds: i32,
        readfds: *mut FdSet,
        writefds: *mut FdSet,
        exceptfds: *mut FdSet,
        timeout: *const TimeVal,
    ) -> i32;
    fn getsockopt(s: usize, level: i32, optname: i32, optval: *mut i32, optlen: *mut i32) -> i32;
    fn closesocket(s: usize) -> i32;
    fn gethostname(name: *mut u8, namelen: i32) -> i32;
    fn gethostbyname(name: *const u8) -> *const HostEnt;
}

const AF_INET: i32 = 2;
const SOCK_STREAM: i32 = 1;
const IPPROTO_TCP: i32 = 6;
const INVALID_SOCKET: usize = usize::MAX;
const FIONBIO: i32 = -2147195266i32;
const SOL_SOCKET: i32 = 0xffff;
const SO_ERROR: i32 = 0x1007;

fn local_ipv4_addresses() -> Vec<Ipv4Addr> {
    let _ = std::net::UdpSocket::bind((Ipv4Addr::LOCALHOST, 0));
    let mut result = vec![Ipv4Addr::UNSPECIFIED];
    unsafe {
        let mut host = [0u8; 256];
        if gethostname(host.as_mut_ptr(), host.len() as i32) != 0 {
            return result;
        }
        let ent = gethostbyname(host.as_ptr());
        if ent.is_null() || (*ent).addr_type != AF_INET as i16 || (*ent).length != 4 {
            return result;
        }
        let mut list = (*ent).addr_list;
        while !list.is_null() && !(*list).is_null() {
            let bytes = std::slice::from_raw_parts(*list, 4);
            let ip = Ipv4Addr::new(bytes[0], bytes[1], bytes[2], bytes[3]);
            if !ip.is_loopback() && !result.contains(&ip) {
                result.push(ip);
            }
            list = list.add(1);
        }
    }
    result
}

fn tcp_handshake_ms(local: Ipv4Addr, remote: SocketAddrV4, timeout: Duration) -> Option<u32> {
    unsafe {
        let s = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
        if s == INVALID_SOCKET {
            return None;
        }
        let close = || {
            let _ = closesocket(s);
        };
        let local_in = SockAddrIn {
            family: AF_INET as u16,
            port: 0,
            addr: local.octets(),
            zero: [0; 8],
        };
        if bind(s, &local_in, std::mem::size_of::<SockAddrIn>() as i32) != 0 {
            close();
            return None;
        }
        let mut nonblocking = 1u32;
        if ioctlsocket(s, FIONBIO, &mut nonblocking) != 0 {
            close();
            return None;
        }
        let remote_in = SockAddrIn {
            family: AF_INET as u16,
            port: remote.port().to_be(),
            addr: remote.ip().octets(),
            zero: [0; 8],
        };
        let start = Instant::now();
        let _ = connect(s, &remote_in, std::mem::size_of::<SockAddrIn>() as i32);
        let mut write_set = FdSet {
            count: 1,
            sockets: [s],
        };
        let mut except_set = FdSet {
            count: 1,
            sockets: [s],
        };
        let tv = TimeVal {
            sec: timeout.as_secs() as i32,
            usec: timeout.subsec_micros() as i32,
        };
        let ready = select(0, std::ptr::null_mut(), &mut write_set, &mut except_set, &tv);
        let elapsed = start.elapsed().as_millis().min(9_999) as u32;
        if ready <= 0 {
            close();
            return None;
        }
        let mut err = 0i32;
        let mut len = std::mem::size_of::<i32>() as i32;
        let ok = getsockopt(s, SOL_SOCKET, SO_ERROR, &mut err, &mut len) == 0 && err == 0;
        close();
        ok.then_some(elapsed)
    }
}

fn proxy_http_ping_ms(edge: Ipv4Addr, timeout: Duration) -> Option<u32> {
    let addr = SocketAddr::V4(SocketAddrV4::new(edge, 80));
    let mut stream = TcpStream::connect_timeout(&addr, timeout).ok()?;
    let _ = stream.set_nodelay(true);
    let _ = stream.set_read_timeout(Some(timeout));
    let _ = stream.set_write_timeout(Some(timeout));
    let request = format!("GET / HTTP/1.1\r\nHost: {edge}\r\n\r\n");
    let mut buffer = [0u8; 512];
    stream.write_all(request.as_bytes()).ok()?;
    if stream.read(&mut buffer).ok()? == 0 {
        return None;
    }
    let start = Instant::now();
    stream.write_all(request.as_bytes()).ok()?;
    let read = stream.read(&mut buffer).ok()?;
    (read > 0).then(|| ((start.elapsed().as_millis() as u32 + 1) / 2).clamp(1, 9_999))
}

fn measure_datacenter_ping(
    udmux: Ipv4Addr,
    cached_local: &mut Option<Ipv4Addr>,
) -> Option<u32> {
    let edge = datacenter_edge(udmux);
    let target = SocketAddrV4::new(edge, 443);
    if let Some(local) = *cached_local {
        if let Some(wire) = tcp_handshake_ms(local, target, TIMEOUT)
            .filter(|&ms| ms >= MIN_PHYSICAL_RTT_MS)
        {
            return Some(wire + ROBLOX_DATAPING_FRAME_MS);
        }
        *cached_local = None;
    }
    for local in local_ipv4_addresses() {
        if let Some(wire) = tcp_handshake_ms(local, target, TIMEOUT)
            .filter(|&ms| ms >= MIN_PHYSICAL_RTT_MS)
        {
            *cached_local = Some(local);
            return Some(wire + ROBLOX_DATAPING_FRAME_MS);
        }
    }
    proxy_http_ping_ms(edge, TIMEOUT)
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Target {
    pub place_id: String,
    pub server_id: String,
    pub ip: Option<String>,
    pub port: Option<u16>,
}

pub struct Probe {
    pub target: Target,
    pub samples: watch::Receiver<PingSnapshot>,
    stop: oneshot::Sender<()>,
    task: JoinHandle<()>,
}

impl Probe {
    pub fn start(target: Target) -> Self {
        let udmux = public_ip(target.ip.as_deref());
        let initial = PingSnapshot {
            state: Ping::Measuring,
            jitter: None,
            history: Vec::new(),
            region: detect_region(udmux, None),
            bad_server: false,
        };
        let (send, samples) = watch::channel(initial);
        let (stop, mut cancel) = oneshot::channel();
        let place_id = target.place_id.clone();
        let server_id = target.server_id.clone();
        let task = tokio::spawn(async move {
            let mut recent = VecDeque::with_capacity(RECENT);
            let mut history: Vec<u32> = Vec::with_capacity(HISTORY_LEN);
            let mut cached_local: Option<Ipv4Addr> = None;
            let mut listed: Option<u32> = None;
            let mut listed_at: Option<tokio::time::Instant> = None;
            loop {
                let mut raw_sample = None;
                if let Some(address) = udmux {
                    let prev_local = cached_local;
                    let (tx, rx) = oneshot::channel();
                    tokio::task::spawn_blocking(move || {
                        let mut local = prev_local;
                        let measured = measure_datacenter_ping(address, &mut local);
                        let _ = tx.send((measured, local));
                    });
                    let reply = tokio::select! {
                        biased;
                        _ = &mut cancel => return,
                        value = rx => value.ok(),
                    };
                    if let Some((Some(ms), local)) = reply {
                        cached_local = local;
                        raw_sample = Some(ms);
                        if recent.len() == RECENT {
                            recent.pop_front();
                        }
                        recent.push_back(ms);
                    }
                }
                let value = match median(&recent) {
                    Some(ms) => Some(ms),
                    None => {
                        if listed_at.is_none_or(|at| at.elapsed() >= LIST_INTERVAL) {
                            listed_at = Some(tokio::time::Instant::now());
                            let request =
                                crate::game_servers::public_server_ping(&place_id, &server_id);
                            let fetched = tokio::select! {
                                biased;
                                _ = &mut cancel => return,
                                value = request => value,
                            };
                            listed = fetched.or(listed);
                        }
                        listed
                    }
                };
                if let Some(sample_for_history) = raw_sample.or(value) {
                    if history.len() == HISTORY_LEN {
                        history.remove(0);
                    }
                    history.push(sample_for_history);
                }
                let jitter = compute_jitter(&history);
                let region = detect_region(udmux, value);
                let bad_server = value.is_some_and(|ms| ms >= BAD_PING_THRESHOLD_MS)
                    || jitter.is_some_and(|j| j >= BAD_JITTER_THRESHOLD_MS);
                let snapshot = PingSnapshot {
                    state: match value {
                        Some(ms) => Ping::Measured(ms),
                        None => Ping::Unavailable,
                    },
                    jitter,
                    history: history.clone(),
                    region,
                    bad_server,
                };
                send.send_if_modified(|old| {
                    if *old != snapshot {
                        *old = snapshot;
                        true
                    } else {
                        false
                    }
                });
                tokio::select! {
                    biased;
                    _ = &mut cancel => return,
                    _ = tokio::time::sleep(INTERVAL) => {}
                }
            }
        });
        Self {
            target,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_udmux_to_datacenter_edge_region_and_jitter() {
        let ams = Ipv4Addr::new(128, 116, 21, 33);
        let fra = Ipv4Addr::new(128, 116, 5, 33);
        let par = Ipv4Addr::new(128, 116, 13, 34);
        assert_eq!(public_ip(Some("128.116.21.33")), Some(ams));
        assert_eq!(datacenter_edge(ams), Ipv4Addr::new(128, 116, 21, 3));
        assert_eq!(detect_region(Some(ams), Some(72)).as_deref(), Some("AMS"));
        assert_eq!(detect_region(Some(fra), Some(70)).as_deref(), Some("FRA"));
        assert_eq!(detect_region(Some(par), Some(80)).as_deref(), Some("PAR"));
        assert_eq!(compute_jitter(&[72]), None);
        assert_eq!(compute_jitter(&[72, 74, 71, 73]), Some(2));
        let samples: VecDeque<u32> = [73, 71, 250, 72, 73].into_iter().collect();
        assert_eq!(median(&samples), Some(73));
    }

    #[test]
    #[ignore = "probes a live Roblox datacenter edge; run with --ignored"]
    fn live_datacenter_ping_matches_in_game_ping() {
        let ip: Ipv4Addr = std::env::var("VORTEX_PING_IP")
            .unwrap_or_else(|_| "128.116.21.33".to_string())
            .parse()
            .unwrap();
        let mut cached_local = None;
        let mut samples = VecDeque::new();
        for round in 0..5 {
            let ms = measure_datacenter_ping(ip, &mut cached_local).expect("datacenter responds");
            println!("round {round} via {cached_local:?} -> {ms} ms");
            samples.push_back(ms);
        }
        let result = median(&samples).unwrap();
        println!("median DataPing to {ip} -> {result} ms");
        assert!((50..=120).contains(&result), "unexpected ping {result} ms");
    }
}
