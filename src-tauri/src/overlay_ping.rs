//! Datacenter lookup and latency estimates for the HUD and server browser.

use serde::Serialize;
use serde_json::Value;
use std::{
    collections::{HashMap, VecDeque},
    io::{Read, Write},
    net::{Ipv4Addr, SocketAddr, SocketAddrV4, TcpStream},
    sync::{Mutex, OnceLock},
    time::{Duration, Instant},
};
use tokio::{
    sync::{oneshot, watch},
    task::JoinHandle,
};

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RegionInfo {
    pub group: String,
    pub code: String,
    pub label: String,
}

impl RegionInfo {
    pub fn new(group: &str, prefix: &str, code: &str) -> Self {
        let code_upper = code.to_ascii_uppercase();
        let label = if prefix.is_empty() || prefix.eq_ignore_ascii_case(&code_upper) {
            code_upper.clone()
        } else {
            format!("{prefix} · {code_upper}")
        };
        Self {
            group: group.to_string(),
            code: code_upper,
            label,
        }
    }
}

fn geo_cache() -> &'static Mutex<HashMap<(u8, u8, u8), Option<RegionInfo>>> {
    static CACHE: OnceLock<Mutex<HashMap<(u8, u8, u8), Option<RegionInfo>>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

type SubnetPingCache = HashMap<(u8, u8, u8), (Instant, Option<u32>)>;

fn ping_subnet_cache() -> &'static Mutex<SubnetPingCache> {
    static CACHE: OnceLock<Mutex<SubnetPingCache>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Ping {
    #[default]
    Idle,
    Measuring,
    Unavailable,
    Measured(u32),
    Listed(u32),
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PingSnapshot {
    pub state: Ping,
    pub jitter: Option<u32>,
    pub history: Vec<u32>,
    pub region: Option<String>,
}

const TIMEOUT: Duration = Duration::from_millis(750);
const HUD_SAMPLE_INTERVAL: Duration = Duration::from_secs(2);
const LIST_INTERVAL: Duration = Duration::from_secs(20);
const RECENT: usize = 5;
const HISTORY_LEN: usize = 12;
const DIRECT_RTT_RETRY_BELOW_MS: u32 = 12;
pub const BAD_JITTER_THRESHOLD_MS: u32 = 25;
const PING_CACHE_TTL: Duration = Duration::from_secs(45);
const PING_MISS_TTL: Duration = Duration::from_secs(12);

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

/// Fast static lookup for known Roblox datacenter `/24` subnets.
pub fn known_region_info(ip: Ipv4Addr) -> Option<RegionInfo> {
    let [a, b, c, _] = ip.octets();
    let mapped = match (a, b, c) {
        (128, 116, 5 | 44 | 119 | 122) => Some(("eu", "EU", "FRA")),
        (128, 116, 21 | 116) => Some(("eu", "EU", "AMS")),
        (128, 116, 13) => Some(("eu", "EU", "PAR")),
        (128, 116, 31 | 35) => Some(("eu", "EU", "LON")),
        (128, 116, 102 | 123) => Some(("eu", "EU", "WAR")),
        (128, 116, 30 | 32) => Some(("us-east", "US", "NYC")),
        (128, 116, 53 | 117) => Some(("us-east", "US", "IAD")),
        (128, 116, 48 | 84) => Some(("us-east", "US", "ORD")),
        (128, 116, 56 | 95) => Some(("us-east", "US", "DFW")),
        (128, 116, 45 | 127) => Some(("us-east", "US", "MIA")),
        (128, 116, 2) => Some(("us-east", "US", "ATL")),
        (128, 116, 1 | 63) => Some(("us-west", "US", "LAX")),
        (128, 116, 54 | 104) => Some(("us-west", "US", "SJC")),
        (128, 116, 115) | (34, 222, _) => Some(("us-west", "US", "SEA")),
        (128, 116, 46 | 50 | 97) => Some(("asia", "ASIA", "SIN")),
        (128, 116, 55 | 120) => Some(("asia", "ASIA", "TYO")),
        (128, 116, 99) => Some(("asia", "ASIA", "HKG")),
        (128, 116, 47) => Some(("asia", "ASIA", "BOM")),
        (128, 116, 51) => Some(("au", "AU", "SYD")),
        (128, 116, 86) => Some(("sa", "SA", "GRU")),
        (96, 0, 18) => Some(("sa", "SA", "LIM")),
        _ => None,
    };
    mapped.map(|(group, prefix, code)| RegionInfo::new(group, prefix, code))
}

fn city_to_iata_code(city: &str, country: &str) -> String {
    let lower = city.trim().to_ascii_lowercase();
    let known = match lower.as_str() {
        "frankfurt" | "frankfurt am main" => Some("FRA"),
        "amsterdam" | "haarlem" => Some("AMS"),
        "paris" => Some("PAR"),
        "london" | "slough" => Some("LON"),
        "warsaw" | "warszawa" => Some("WAR"),
        "dublin" => Some("DUB"),
        "stockholm" => Some("ARN"),
        "madrid" => Some("MAD"),
        "milan" | "milano" => Some("MIL"),
        "zurich" | "zürich" => Some("ZRH"),
        "new york" | "secaucus" | "newark" | "jersey city" | "clifton" | "piscataway" => {
            Some("NYC")
        }
        "ashburn" | "washington" | "reston" | "sterling" | "manassas" => Some("IAD"),
        "chicago" | "elk grove village" => Some("ORD"),
        "dallas" | "richardson" | "plano" => Some("DFW"),
        "miami" | "doral" => Some("MIA"),
        "atlanta" => Some("ATL"),
        "los angeles" | "el segundo" => Some("LAX"),
        "san jose" | "santa clara" | "san francisco" | "fremont" | "san mateo" => Some("SJC"),
        "seattle" | "tukwila" | "quincy" => Some("SEA"),
        "boardman" | "hillsboro" | "portland" => Some("PDX"),
        "singapore" => Some("SIN"),
        "tokyo" | "osaka" => Some("TYO"),
        "hong kong" => Some("HKG"),
        "mumbai" | "navi mumbai" => Some("BOM"),
        "seoul" => Some("ICN"),
        "taipei" => Some("TPE"),
        "sydney" => Some("SYD"),
        "melbourne" => Some("MEL"),
        "são paulo" | "sao paulo" | "barueri" | "cotia" | "santana de parnaíba" => Some("GRU"),
        "rio de janeiro" => Some("GIG"),
        "lima" => Some("LIM"),
        "santiago" => Some("SCL"),
        "buenos aires" => Some("EZE"),
        "bogota" | "bogotá" => Some("BOG"),
        _ => None,
    };
    if let Some(code) = known {
        return code.to_string();
    }
    let letters: String = city
        .chars()
        .filter(|ch| ch.is_ascii_alphabetic())
        .take(3)
        .collect::<String>()
        .to_ascii_uppercase();
    if letters.len() == 3 {
        letters
    } else if !country.trim().is_empty() {
        country.trim().to_ascii_uppercase()
    } else {
        "RBLX".to_string()
    }
}

/// Map GeoIP fields (`continent`, `country`, `city`, `region_name`, `lon`) into
/// the unified Vortex `RegionInfo` used by both the Servers tab and the Overlay.
pub fn region_info_from_geo(
    continent: &str,
    country: &str,
    city: &str,
    region_name: &str,
    lon: Option<f64>,
) -> RegionInfo {
    let cont = continent.trim().to_ascii_uppercase();
    let cc = country.trim().to_ascii_uppercase();
    let reg = region_name.trim().to_ascii_lowercase();
    let code = city_to_iata_code(city, &cc);

    let (group, prefix) = if cont == "SA"
        || matches!(
            cc.as_str(),
            "BR" | "AR" | "CL" | "CO" | "PE" | "UY" | "EC" | "VE" | "PY" | "BO"
        ) {
        ("sa", "SA")
    } else if cont == "OC" || matches!(cc.as_str(), "AU" | "NZ") {
        ("au", "AU")
    } else if cont == "EU"
        || matches!(
            cc.as_str(),
            "DE" | "NL"
                | "FR"
                | "GB"
                | "PL"
                | "SE"
                | "FI"
                | "IE"
                | "ES"
                | "IT"
                | "CZ"
                | "AT"
                | "CH"
                | "BE"
                | "NO"
                | "DK"
                | "PT"
                | "RO"
                | "HU"
                | "RU"
                | "UA"
                | "BG"
                | "SK"
                | "LT"
                | "LV"
                | "EE"
        )
    {
        ("eu", "EU")
    } else if cont == "NA" || matches!(cc.as_str(), "US" | "CA" | "MX") {
        let west_state = matches!(
            reg.as_str(),
            "california"
                | "washington"
                | "oregon"
                | "nevada"
                | "arizona"
                | "utah"
                | "idaho"
                | "hawaii"
                | "alaska"
                | "british columbia"
                | "alberta"
        );
        let is_west = west_state || lon.is_some_and(|l| l < -100.0);
        if is_west {
            ("us-west", "US")
        } else {
            ("us-east", "US")
        }
    } else if cont == "AS"
        || matches!(
            cc.as_str(),
            "SG" | "JP"
                | "HK"
                | "IN"
                | "KR"
                | "TW"
                | "MY"
                | "TH"
                | "ID"
                | "PH"
                | "VN"
                | "AE"
                | "IL"
                | "CN"
        )
    {
        ("asia", "ASIA")
    } else {
        ("other", cc.as_str())
    };
    RegionInfo::new(group, prefix, &code)
}

/// Resolve the real geographic datacenter region for any public Roblox server IPv4.
/// Uses the static `/24` table first, then a `/24`-cached HTTPS GeoIP lookup.
pub async fn resolve_region_info(ip: Ipv4Addr) -> Option<RegionInfo> {
    if let Some(known) = known_region_info(ip) {
        return Some(known);
    }
    let [a, b, c, _] = ip.octets();
    let key = (a, b, c);
    if let Ok(cache) = geo_cache().lock() {
        if let Some(cached) = cache.get(&key) {
            return cached.clone();
        }
    }

    let client = crate::roblox::shared_http_client();

    let mut resolved: Option<RegionInfo> = None;

    // Primary: ipwho.is (HTTPS, clean JSON, includes continent_code & longitude)
    if let Ok(resp) = client.get(format!("https://ipwho.is/{ip}")).send().await {
        if resp.status().is_success() {
            if let Ok(json) = resp.json::<Value>().await {
                if json.get("success").and_then(Value::as_bool) != Some(false) {
                    let country = json
                        .get("country_code")
                        .and_then(Value::as_str)
                        .unwrap_or("");
                    if !country.is_empty() {
                        let continent = json
                            .get("continent_code")
                            .and_then(Value::as_str)
                            .unwrap_or("");
                        let city = json.get("city").and_then(Value::as_str).unwrap_or("");
                        let region = json.get("region").and_then(Value::as_str).unwrap_or("");
                        let lon = json.get("longitude").and_then(Value::as_f64);
                        resolved =
                            Some(region_info_from_geo(continent, country, city, region, lon));
                    }
                }
            }
        }
    }

    // Fallback: ipinfo.io (HTTPS)
    if resolved.is_none() {
        if let Ok(resp) = client
            .get(format!("https://ipinfo.io/{ip}/json"))
            .send()
            .await
        {
            if resp.status().is_success() {
                if let Ok(json) = resp.json::<Value>().await {
                    let country = json.get("country").and_then(Value::as_str).unwrap_or("");
                    if !country.is_empty() {
                        let city = json.get("city").and_then(Value::as_str).unwrap_or("");
                        let region = json.get("region").and_then(Value::as_str).unwrap_or("");
                        let lon = json
                            .get("loc")
                            .and_then(Value::as_str)
                            .and_then(|loc| loc.split(',').nth(1))
                            .and_then(|v| v.trim().parse::<f64>().ok());
                        resolved = Some(region_info_from_geo("", country, city, region, lon));
                    }
                }
            }
        }
    }

    if let Ok(mut cache) = geo_cache().lock() {
        if cache.len() > 512 {
            cache.clear();
        }
        cache.insert(key, resolved.clone());
    }
    resolved
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
fn compute_jitter(history: &[u32]) -> Option<u32> {
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
        let ready = select(
            0,
            std::ptr::null_mut(),
            &mut write_set,
            &mut except_set,
            &tv,
        );
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
    let mut prefix = [0u8; 5];
    let start = Instant::now();
    stream.write_all(request.as_bytes()).ok()?;
    stream.read_exact(&mut prefix).ok()?;
    (&prefix == b"HTTP/").then(|| start.elapsed().as_millis().clamp(1, 9_999) as u32)
}

fn measure_hud_ping(udmux: Ipv4Addr, cached_local: &mut Option<Ipv4Addr>) -> Option<u32> {
    let edge = datacenter_edge(udmux);
    let target = SocketAddrV4::new(edge, 443);
    if let Some(local) = *cached_local {
        if let Some(wire) =
            tcp_handshake_ms(local, target, TIMEOUT).filter(|&ms| ms >= DIRECT_RTT_RETRY_BELOW_MS)
        {
            return Some(wire);
        }
        *cached_local = None;
    }
    for local in local_ipv4_addresses() {
        if let Some(wire) =
            tcp_handshake_ms(local, target, TIMEOUT).filter(|&ms| ms >= DIRECT_RTT_RETRY_BELOW_MS)
        {
            *cached_local = Some(local);
            return Some(wire);
        }
    }
    proxy_http_ping_ms(edge, TIMEOUT)
}

fn measure_datacenter_ping(udmux: Ipv4Addr) -> Option<u32> {
    let edge = datacenter_edge(udmux);
    for port in [443, 80] {
        let target = SocketAddr::V4(SocketAddrV4::new(edge, port));
        let started = Instant::now();
        if TcpStream::connect_timeout(&target, TIMEOUT).is_ok() {
            return Some(started.elapsed().as_millis().clamp(1, 9_999) as u32);
        }
    }
    None
}

/// Median of three TCP handshake RTTs over the OS-selected route, cached per /24.
pub fn measure_datacenter_ping_cached(udmux: Ipv4Addr) -> Option<u32> {
    let [a, b, c, _] = udmux.octets();
    let key = (a, b, c);
    if let Ok(cache) = ping_subnet_cache().lock() {
        if let Some((at, ms)) = cache.get(&key) {
            let ttl = if ms.is_some() {
                PING_CACHE_TTL
            } else {
                PING_MISS_TTL
            };
            if at.elapsed() < ttl {
                return *ms;
            }
        }
    }
    let mut samples = VecDeque::with_capacity(3);
    if let Some(first) = measure_datacenter_ping(udmux) {
        samples.push_back(first);
        samples.extend((0..2).filter_map(|_| measure_datacenter_ping(udmux)));
    }
    let measured = median(&samples);
    if let Ok(mut cache) = ping_subnet_cache().lock() {
        if cache.len() > 256 {
            cache.retain(|_, (at, _)| at.elapsed() < PING_CACHE_TTL);
            if cache.len() > 256 {
                let mut entries: Vec<((u8, u8, u8), Instant)> =
                    cache.iter().map(|(&k, &(at, _))| (k, at)).collect();
                entries.sort_by_key(|(_, at)| *at);
                let to_drop = entries.len().saturating_sub(200);
                for (k, _) in entries.into_iter().take(to_drop) {
                    cache.remove(&k);
                }
            }
        }
        cache.insert(key, (Instant::now(), measured));
    }
    measured
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Target {
    pub place_id: String,
    pub server_id: String,
    pub ip: Option<String>,
    pub pid: u32,
    pub started_at: u64,
}

pub struct Probe {
    pub target: Target,
    pub samples: watch::Receiver<PingSnapshot>,
    stop: oneshot::Sender<()>,
    task: JoinHandle<()>,
}

impl Probe {
    pub fn start(target: Target) -> Self {
        let address = public_ip(target.ip.as_deref());
        let region = address.and_then(known_region_info).map(|info| info.code);
        let (send, samples) = watch::channel(PingSnapshot {
            state: Ping::Measuring,
            region: region.clone(),
            ..Default::default()
        });
        let (stop, mut cancel) = oneshot::channel();
        let place_id = target.place_id.clone();
        let server_id = target.server_id.clone();
        let task = tokio::spawn(async move {
            let mut region = region;
            let mut geo = address
                .filter(|_| region.is_none())
                .map(|ip| tokio::spawn(resolve_region_info(ip)));
            let mut recent = VecDeque::with_capacity(RECENT);
            let mut history = Vec::with_capacity(HISTORY_LEN);
            let mut local = None;
            let mut misses = 0;
            let mut listed = None;
            let mut listed_at: Option<Instant> = None;
            loop {
                if geo.as_ref().is_some_and(JoinHandle::is_finished) {
                    if let Some(task) = geo.take() {
                        region = task.await.ok().flatten().map(|info| info.code);
                    }
                }
                if let Some(ip) = address {
                    let sample = tokio::task::spawn_blocking(move || {
                        let mut local = local;
                        (measure_hud_ping(ip, &mut local), local)
                    });
                    let result = tokio::select! {
                        biased;
                        _ = &mut cancel => break,
                        result = sample => result.ok(),
                    };
                    if let Some((Some(ms), interface)) = result {
                        local = interface;
                        misses = 0;
                        if recent.len() == RECENT {
                            recent.pop_front();
                        }
                        recent.push_back(ms);
                        if history.len() == HISTORY_LEN {
                            history.remove(0);
                        }
                        history.push(ms);
                    } else {
                        misses += 1;
                        if misses >= 2 {
                            local = None;
                            recent.clear();
                            history.clear();
                        }
                    }
                }

                let state = if let Some(ms) = median(&recent) {
                    Ping::Measured(ms)
                } else {
                    if listed_at.is_none_or(|at| at.elapsed() >= LIST_INTERVAL) {
                        listed_at = Some(Instant::now());
                        let lookup = crate::game_servers::public_server_ping(&place_id, &server_id);
                        listed = tokio::select! {
                            biased;
                            _ = &mut cancel => break,
                            result = lookup => result,
                        };
                    }
                    listed.map_or(Ping::Unavailable, Ping::Listed)
                };
                let snapshot = PingSnapshot {
                    state,
                    jitter: compute_jitter(&history),
                    history: history.clone(),
                    region: region.clone(),
                };
                send.send_if_modified(|previous| {
                    if *previous == snapshot {
                        return false;
                    }
                    *previous = snapshot;
                    true
                });
                tokio::select! {
                    biased;
                    _ = &mut cancel => break,
                    _ = tokio::time::sleep(HUD_SAMPLE_INTERVAL) => {}
                }
            }
            if let Some(task) = geo {
                task.abort();
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

/// Representative Roblox UDMUX datacenter edge IPs for the one-click region ping test.
const DATACENTER_PROBES: &[(&str, &str, &str, &str, Ipv4Addr)] = &[
    (
        "FRA",
        "Франкфурт",
        "eu",
        "EU · FRA",
        Ipv4Addr::new(128, 116, 5, 3),
    ),
    (
        "AMS",
        "Амстердам",
        "eu",
        "EU · AMS",
        Ipv4Addr::new(128, 116, 21, 3),
    ),
    (
        "PAR",
        "Париж",
        "eu",
        "EU · PAR",
        Ipv4Addr::new(128, 116, 13, 3),
    ),
    (
        "LON",
        "Лондон",
        "eu",
        "EU · LON",
        Ipv4Addr::new(128, 116, 31, 3),
    ),
    (
        "WAR",
        "Варшава",
        "eu",
        "EU · WAR",
        Ipv4Addr::new(128, 116, 102, 3),
    ),
    (
        "NYC",
        "Нью-Йорк",
        "us-east",
        "US · NYC",
        Ipv4Addr::new(128, 116, 30, 3),
    ),
    (
        "IAD",
        "Вирджиния",
        "us-east",
        "US · IAD",
        Ipv4Addr::new(128, 116, 53, 3),
    ),
    (
        "ORD",
        "Чикаго",
        "us-east",
        "US · ORD",
        Ipv4Addr::new(128, 116, 48, 3),
    ),
    (
        "LAX",
        "Лос-Анджелес",
        "us-west",
        "US · LAX",
        Ipv4Addr::new(128, 116, 1, 3),
    ),
    (
        "SEA",
        "Сиэтл",
        "us-west",
        "US · SEA",
        Ipv4Addr::new(128, 116, 115, 3),
    ),
    (
        "SIN",
        "Сингапур",
        "asia",
        "ASIA · SIN",
        Ipv4Addr::new(128, 116, 46, 3),
    ),
    (
        "TYO",
        "Токио",
        "asia",
        "ASIA · TYO",
        Ipv4Addr::new(128, 116, 55, 3),
    ),
    (
        "GRU",
        "Сан-Паулу",
        "sa",
        "SA · GRU",
        Ipv4Addr::new(128, 116, 86, 3),
    ),
    (
        "SYD",
        "Сидней",
        "au",
        "AU · SYD",
        Ipv4Addr::new(128, 116, 51, 3),
    ),
];

/// Probe all major Roblox datacenter regions in parallel and return results
/// sorted by lowest ping first.
pub async fn probe_all_regions() -> Vec<Value> {
    let mut handles = Vec::with_capacity(DATACENTER_PROBES.len());
    for &(code, city, group, label, ip) in DATACENTER_PROBES {
        handles.push(tokio::task::spawn_blocking(move || {
            let ping = measure_datacenter_ping_cached(ip);
            (code, city, group, label, ip, ping)
        }));
    }
    let mut results = Vec::with_capacity(handles.len());
    for handle in handles {
        if let Ok(item) = handle.await {
            results.push(item);
        }
    }
    results.sort_by_key(|item| item.5.unwrap_or(u32::MAX));
    results
        .into_iter()
        .map(|(code, city, group, label, ip, ping)| {
            serde_json::json!({
                "code": code,
                "city": city,
                "group": group,
                "label": label,
                "ip": ip.to_string(),
                "ping": ping,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore = "queries the live Roblox server list and, when provided, the datacenter"]
    async fn hud_probe_publishes_ping_without_roblox_panels() {
        let ip = std::env::var("VORTEX_HUD_TEST_IP").ok();
        let automatic_measurement = ip.is_some();
        let probe = Probe::start(Target {
            place_id: "1818".to_owned(),
            server_id: String::new(),
            ip,
            pid: 1,
            started_at: 1,
        });
        let mut samples = probe.samples.clone();
        let received = tokio::time::timeout(Duration::from_secs(25), async {
            samples
                .wait_for(|snapshot| matches!(snapshot.state, Ping::Measured(_) | Ping::Listed(_)))
                .await
                .map(|snapshot| snapshot.state.clone())
        })
        .await;
        probe.stop().await;
        let ping = received
            .expect("the HUD should receive a sample")
            .expect("the probe should stay open");
        println!("{ping:?}");
        match ping {
            Ping::Measured(ms) => assert!(automatic_measurement && ms > 0),
            Ping::Listed(ms) => assert!(ms > 0),
            _ => unreachable!("wait_for only accepts a numeric ping"),
        }
    }

    #[test]
    fn maps_udmux_to_datacenter_edge_and_region() {
        let ams = Ipv4Addr::new(128, 116, 21, 33);
        assert_eq!(public_ip(Some("128.116.21.33")), Some(ams));
        assert_eq!(datacenter_edge(ams), Ipv4Addr::new(128, 116, 21, 3));
        assert_eq!(known_region_info(ams).unwrap().code, "AMS");
        let samples: VecDeque<u32> = [73, 71, 250, 72, 73].into_iter().collect();
        assert_eq!(median(&samples), Some(73));
    }

    #[test]
    #[ignore = "probes a live Roblox datacenter edge; run with --ignored"]
    fn live_datacenter_tcp_ping_collects_samples() {
        let ip: Ipv4Addr = std::env::var("VORTEX_PING_IP")
            .unwrap_or_else(|_| "128.116.21.33".to_string())
            .parse()
            .unwrap();
        let mut samples = VecDeque::new();
        for round in 0..5 {
            let ms = measure_datacenter_ping(ip).expect("datacenter responds");
            println!("round {round} -> {ms} ms");
            samples.push_back(ms);
        }
        let result = median(&samples).unwrap();
        println!("median TCP RTT to {ip} -> {result} ms");
        assert!(
            (1..=TIMEOUT.as_millis() as u32).contains(&result),
            "unexpected RTT {result} ms"
        );
    }
}
