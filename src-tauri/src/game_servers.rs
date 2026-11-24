use crate::{overlay_ping, roblox, state::AppState};
use serde::Serialize;
use serde_json::{json, Value};
use std::{
    collections::{HashMap, HashSet},
    net::Ipv4Addr,
    sync::{Arc, Mutex, OnceLock},
    time::{Duration, Instant},
};
use tokio::sync::Semaphore;
use uuid::Uuid;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedServer {
    pub ip: String,
    pub region_group: String,
    pub region_code: String,
    pub region_label: String,
    pub real_ping: Option<u32>,
}

const RESOLVED_SERVER_TTL: Duration = Duration::from_secs(900);

fn resolved_server_cache() -> &'static Mutex<HashMap<String, (Instant, ResolvedServer)>> {
    static CACHE: OnceLock<Mutex<HashMap<String, (Instant, ResolvedServer)>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn extract_join_script_ip(payload: &Value) -> Option<Ipv4Addr> {
    let join_script = payload.get("joinScript")?;
    if let Some(endpoints) = join_script.get("UdmuxEndpoints").and_then(Value::as_array) {
        for endpoint in endpoints {
            if let Some(addr) = endpoint.get("Address").and_then(Value::as_str) {
                if let Some(ip) = overlay_ping::public_ip(Some(addr)) {
                    return Some(ip);
                }
            }
        }
    }
    if let Some(addr) = join_script.get("MachineAddress").and_then(Value::as_str) {
        if let Some(ip) = overlay_ping::public_ip(Some(addr)) {
            return Some(ip);
        }
    }
    None
}

#[tauri::command]
pub async fn games_resolve_servers(
    state: tauri::State<'_, Arc<AppState>>,
    place_id: String,
    server_ids: Vec<String>,
    profile_id: Option<String>,
) -> Result<Value, String> {
    if !super::valid_numeric_id(&place_id) {
        return Err("Invalid Place ID".into());
    }
    let place_num: u64 = place_id.parse().map_err(|_| "Invalid Place ID")?;

    let mut unique_ids = Vec::new();
    let mut seen = HashSet::new();
    for raw in server_ids {
        if let Ok(parsed) = Uuid::parse_str(raw.trim()) {
            let norm = parsed.hyphenated().to_string();
            if seen.insert(norm.clone()) {
                unique_ids.push(norm);
                if unique_ids.len() >= 10 {
                    break;
                }
            }
        }
    }

    let mut resolved_map: HashMap<String, ResolvedServer> = HashMap::new();
    let mut to_fetch = Vec::new();
    if let Ok(cache) = resolved_server_cache().lock() {
        for id in &unique_ids {
            if let Some((at, entry)) = cache.get(id) {
                if at.elapsed() < RESOLVED_SERVER_TTL {
                    resolved_map.insert(id.clone(), entry.clone());
                    continue;
                }
            }
            to_fetch.push(id.clone());
        }
    } else {
        to_fetch = unique_ids.clone();
    }

    if to_fetch.is_empty() {
        return Ok(json!({ "ok": true, "reason": null, "resolved": resolved_map }));
    }

    let raw_cookie = crate::profile_cookie(&state, profile_id.as_deref());
    let clean_cookie = roblox::normalize_cookie_value(&raw_cookie).to_string();
    if clean_cookie.is_empty() {
        return Ok(json!({
            "ok": false,
            "reason": "auth-required",
            "resolved": resolved_map
        }));
    }

    static WININET_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    let client = WININET_CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .user_agent("Roblox/WinInet")
            .timeout(Duration::from_secs(6))
            .pool_max_idle_per_host(4)
            .pool_idle_timeout(Duration::from_secs(60))
            .build()
            .expect("failed to build WinInet HTTP client")
    });

    let sem = Arc::new(Semaphore::new(2));
    let mut join_handles = Vec::with_capacity(to_fetch.len());
    for (idx, server_id) in to_fetch.into_iter().enumerate() {
        let client = client.clone();
        let sem = sem.clone();
        let cookie_header = format!(".ROBLOSECURITY={clean_cookie}");
        join_handles.push(tokio::spawn(async move {
            let _permit = sem.acquire().await.ok()?;
            if idx > 0 {
                tokio::time::sleep(Duration::from_millis(180)).await;
            }
            let attempt_id = Uuid::new_v4().hyphenated().to_string();
            let body = json!({
                "placeId": place_num,
                "isTeleport": false,
                "gameId": server_id,
                "gameJoinAttemptId": attempt_id
            });
            let response = client
                .post("https://gamejoin.roblox.com/v1/join-game-instance")
                .header("Cookie", &cookie_header)
                .header("Accept", "application/json")
                .json(&body)
                .send()
                .await
                .ok()?;
            let status = response.status().as_u16();
            if status == 401 || status == 403 {
                return Some((server_id, Err("auth")));
            }
            if status == 429 {
                return Some((server_id, Err("rate")));
            }
            if !response.status().is_success() {
                return Some((server_id, Err("other")));
            }
            let payload: Value = response.json().await.ok()?;
            if let Some(ip) = extract_join_script_ip(&payload) {
                return Some((server_id, Ok(ip)));
            }
            let msg = payload
                .get("message")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_ascii_lowercase();
            if msg.contains("unauthorized") || msg.contains("not authorized") {
                return Some((server_id, Err("auth")));
            }
            Some((server_id, Err("unavailable")))
        }));
    }

    let mut server_ips: Vec<(String, Ipv4Addr)> = Vec::new();
    let mut auth_errors = 0usize;
    let mut rate_errors = 0usize;
    for handle in join_handles {
        if let Ok(Some((server_id, outcome))) = handle.await {
            match outcome {
                Ok(ip) => server_ips.push((server_id, ip)),
                Err("auth") => auth_errors += 1,
                Err("rate") => rate_errors += 1,
                Err(_) => {}
            }
        }
    }

    // Deduplicate datacenters by /24 prefix so we only GeoIP & ping each unique datacenter once.
    let mut unique_subnets: HashMap<(u8, u8, u8), Ipv4Addr> = HashMap::new();
    for (_, ip) in &server_ips {
        let [a, b, c, _] = ip.octets();
        unique_subnets.entry((a, b, c)).or_insert(*ip);
    }

    let geo_sem = Arc::new(Semaphore::new(4));
    let mut dc_handles = Vec::with_capacity(unique_subnets.len());
    for (subnet, ip) in unique_subnets {
        let geo_sem = geo_sem.clone();
        dc_handles.push(tokio::spawn(async move {
            let region_fut = async {
                let _permit = geo_sem.acquire().await.ok();
                overlay_ping::resolve_region_info(ip).await
            };
            let ping_fut = tokio::task::spawn_blocking(move || {
                overlay_ping::measure_datacenter_ping_cached(ip)
            });
            let (region, ping_res) = tokio::join!(region_fut, ping_fut);
            (subnet, region, ping_res.ok().flatten())
        }));
    }

    let mut dc_info: HashMap<(u8, u8, u8), (Option<overlay_ping::RegionInfo>, Option<u32>)> =
        HashMap::new();
    for handle in dc_handles {
        if let Ok((subnet, region, ping)) = handle.await {
            dc_info.insert(subnet, (region, ping));
        }
    }

    let now = Instant::now();
    let mut newly_resolved = Vec::new();
    for (server_id, ip) in server_ips {
        let [a, b, c, _] = ip.octets();
        let (region_opt, real_ping) = dc_info
            .get(&(a, b, c))
            .cloned()
            .unwrap_or((None, None));
        let region = region_opt.unwrap_or_else(|| overlay_ping::RegionInfo::new("other", "", "RBLX"));
        let entry = ResolvedServer {
            ip: ip.to_string(),
            region_group: region.group,
            region_code: region.code,
            region_label: region.label,
            real_ping,
        };
        newly_resolved.push((server_id.clone(), entry.clone()));
        resolved_map.insert(server_id, entry);
    }

    if !newly_resolved.is_empty() {
        if let Ok(mut cache) = resolved_server_cache().lock() {
            if cache.len() > 1024 {
                cache.retain(|_, (at, _)| at.elapsed() < RESOLVED_SERVER_TTL);
            }
            for (server_id, entry) in newly_resolved {
                cache.insert(server_id, (now, entry));
            }
        }
    }

    if resolved_map.is_empty() {
        if auth_errors > 0 {
            return Ok(json!({ "ok": false, "reason": "cookie-expired", "resolved": resolved_map }));
        }
        if rate_errors > 0 {
            return Ok(json!({ "ok": false, "reason": "rate-limited", "resolved": resolved_map }));
        }
    }

    Ok(json!({ "ok": true, "reason": null, "resolved": resolved_map }))
}


fn normalize_private_server(row: &Value, my_user_id: Option<u64>) -> Option<Value> {
    let vip_server_id = row.get("vipServerId").and_then(Value::as_u64).unwrap_or(0);
    let access_code = row
        .get("accessCode")
        .and_then(Value::as_str)
        .map(str::trim)
        .unwrap_or_default();
    if vip_server_id == 0 && access_code.is_empty() {
        return None;
    }
    let active = !access_code.is_empty()
        && row.get("active").and_then(Value::as_bool).unwrap_or(true);
    let instance_id = row
        .get("id")
        .and_then(Value::as_str)
        .and_then(|raw| Uuid::parse_str(raw.trim()).ok())
        .map(|u| u.hyphenated().to_string());
    let playing = row.get("playing").and_then(Value::as_u64).unwrap_or(0);
    let capacity = row.get("maxPlayers").and_then(Value::as_u64).unwrap_or(0);
    let ping = row
        .get("ping")
        .and_then(Value::as_u64)
        .filter(|&ping| ping > 0);
    let owner = row.get("owner");
    let owner_id = owner.and_then(|o| o.get("id")).and_then(Value::as_u64).unwrap_or(0);
    let owner_name = owner
        .and_then(|o| o.get("name"))
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string();
    let owner_display = owner
        .and_then(|o| o.get("displayName"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(&owner_name)
        .to_string();
    let verified = owner
        .and_then(|o| o.get("hasVerifiedBadge"))
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let name = row
        .get("name")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(&owner_display)
        .to_string();
    let players: Vec<String> = row
        .get("players")
        .and_then(Value::as_array)
        .map(|list| {
            list.iter()
                .filter_map(|p| {
                    p.get("displayName")
                        .and_then(Value::as_str)
                        .or_else(|| p.get("name").and_then(Value::as_str))
                        .map(str::trim)
                        .filter(|s| !s.is_empty())
                        .map(str::to_string)
                })
                .collect()
        })
        .unwrap_or_default();
    let is_mine = my_user_id.is_some_and(|me| me > 0 && me == owner_id);

    Some(json!({
        "vipServerId": vip_server_id,
        "accessCode": access_code,
        "active": active,
        "id": instance_id,
        "name": name,
        "playing": playing,
        "capacity": capacity,
        "ping": ping,
        "isMine": is_mine,
        "players": players,
        "owner": {
            "id": owner_id,
            "name": owner_name,
            "displayName": owner_display,
            "hasVerifiedBadge": verified,
            "avatar": Value::Null
        }
    }))
}

fn extract_html_attr<'a>(html: &'a str, attr: &str) -> Option<&'a str> {
    let needle = format!("{attr}=\"");
    let start = html.find(&needle)? + needle.len();
    let rest = &html[start..];
    let end = rest.find('"')?;
    Some(rest[..end].trim())
}

fn parse_private_server_page_meta(html: &str) -> Value {
    let universe_id = extract_html_attr(html, "data-universe-id")
        .and_then(|v| v.parse::<u64>().ok());
    let price = extract_html_attr(html, "data-private-server-price")
        .filter(|v| !v.is_empty())
        .and_then(|v| v.parse::<u64>().ok());
    let can_create = extract_html_attr(html, "data-can-create-server")
        .map(|v| v.eq_ignore_ascii_case("true"));
    let product_id = extract_html_attr(html, "data-private-server-product-id")
        .and_then(|v| v.parse::<u64>().ok())
        .filter(|&id| id > 0);
    let allowed = can_create == Some(true) || product_id.is_some() || price.is_some();
    json!({
        "universeId": universe_id,
        "price": price,
        "canCreate": can_create.unwrap_or(allowed),
        "allowed": allowed
    })
}

#[tauri::command]
pub async fn games_private_servers(
    state: tauri::State<'_, Arc<AppState>>,
    place_id: String,
    cursor: Option<String>,
    profile_id: Option<String>,
) -> Result<Value, String> {
    if !super::valid_numeric_id(&place_id) {
        return Err("Invalid Place ID".into());
    }
    let is_first_page = cursor.as_deref().is_none_or(|c| c.is_empty());
    let raw_cookie = crate::profile_cookie(&state, profile_id.as_deref());
    let clean_cookie = roblox::normalize_cookie_value(&raw_cookie).to_string();
    if clean_cookie.is_empty() {
        return Ok(json!({
            "ok": false,
            "reason": "auth-required",
            "servers": [],
            "meta": Value::Null,
            "nextCursor": Value::Null
        }));
    }

    let mut url = format!(
        "https://games.roblox.com/v1/games/{place_id}/private-servers?limit=50&sortOrder=Asc"
    );
    if let Some(cursor) = cursor.filter(|value| !value.is_empty()) {
        if cursor.len() > 1024 {
            return Err("Invalid server cursor".into());
        }
        url.push_str("&cursor=");
        url.push_str(&super::encode_query(&cursor));
    }

    let client = roblox::shared_http_client();
    let cookie_header = format!(".ROBLOSECURITY={clean_cookie}");

    let servers_req = async {
        let send_once = || {
            client
                .get(&url)
                .header("Cookie", &cookie_header)
                .header("Accept", "application/json")
                .header("Origin", "https://www.roblox.com")
                .header("Referer", "https://www.roblox.com/")
                .send()
        };
        let first = send_once().await;
        if let Ok(ref resp) = first {
            if resp.status().as_u16() == 429 {
                tokio::time::sleep(Duration::from_millis(1200)).await;
                return send_once().await;
            }
        }
        first
    };

    let auth_req = client
        .get("https://users.roblox.com/v1/users/authenticated")
        .header("Cookie", &cookie_header)
        .header("Accept", "application/json")
        .send();

    let page_req = async {
        if !is_first_page {
            return None;
        }
        let resp = client
            .get(format!("https://www.roblox.com/games/{place_id}"))
            .header("Cookie", &cookie_header)
            .header("Accept", "text/html")
            .send()
            .await
            .ok()?;
        if !resp.status().is_success() {
            return None;
        }
        let html = resp.text().await.ok()?;
        Some(parse_private_server_page_meta(&html))
    };

    let (servers_res, auth_res, page_meta) = tokio::join!(servers_req, auth_req, page_req);

    let my_user_id: Option<u64> = match auth_res {
        Ok(resp) if resp.status().is_success() => resp
            .json::<Value>()
            .await
            .ok()
            .and_then(|v| v.get("id").and_then(Value::as_u64)),
        _ => None,
    };

    let response = match servers_res {
        Ok(resp) => resp,
        Err(error) => {
            return Ok(json!({
                "ok": false,
                "reason": "network",
                "message": error.to_string(),
                "servers": [],
                "meta": page_meta,
                "nextCursor": Value::Null
            }));
        }
    };

    let status = response.status().as_u16();
    if status == 401 || status == 403 {
        let reason = if my_user_id.is_none() {
            "cookie-expired"
        } else {
            "auth-required"
        };
        return Ok(json!({
            "ok": false,
            "reason": reason,
            "servers": [],
            "meta": page_meta,
            "nextCursor": Value::Null
        }));
    }
    if status == 429 {
        return Ok(json!({
            "ok": false,
            "reason": "rate-limited",
            "servers": [],
            "meta": page_meta,
            "nextCursor": Value::Null
        }));
    }
    if !response.status().is_success() {
        return Ok(json!({
            "ok": false,
            "reason": "network",
            "message": format!("HTTP {status}"),
            "servers": [],
            "meta": page_meta,
            "nextCursor": Value::Null
        }));
    }

    let payload: Value = response.json().await.map_err(|e| e.to_string())?;
    let rows = payload
        .get("data")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    let mut servers: Vec<Value> = rows
        .iter()
        .filter_map(|row| normalize_private_server(row, my_user_id))
        .collect();

    // Fetch owner headshots in one batch so private server cards look crisp.
    let owner_ids: Vec<u64> = servers
        .iter()
        .filter_map(|s| s.get("owner")?.get("id")?.as_u64())
        .filter(|&id| id > 0)
        .collect::<HashSet<_>>()
        .into_iter()
        .take(50)
        .collect();

    if !owner_ids.is_empty() {
        let csv = owner_ids
            .iter()
            .map(u64::to_string)
            .collect::<Vec<_>>()
            .join(",");
        let thumb_url = format!(
            "https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds={csv}&size=150x150&format=Png&isCircular=false"
        );
        if let Ok(resp) = client.get(&thumb_url).send().await {
            if resp.status().is_success() {
                if let Ok(thumbs) = resp.json::<Value>().await {
                    let mut avatar_map: HashMap<u64, String> = HashMap::new();
                    if let Some(items) = thumbs.get("data").and_then(Value::as_array) {
                        for item in items {
                            if let (Some(uid), Some(img)) = (
                                item.get("targetId").and_then(Value::as_u64),
                                item.get("imageUrl").and_then(Value::as_str),
                            ) {
                                if !img.is_empty() {
                                    avatar_map.insert(uid, img.to_string());
                                }
                            }
                        }
                    }
                    for server in &mut servers {
                        if let Some(owner) = server.get_mut("owner").and_then(Value::as_object_mut) {
                            if let Some(uid) = owner.get("id").and_then(Value::as_u64) {
                                if let Some(img) = avatar_map.get(&uid) {
                                    owner.insert("avatar".into(), Value::String(img.clone()));
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Sort: user's own private servers first, then active servers by player count desc, then by name.
    servers.sort_by(|a, b| {
        let a_mine = a.get("isMine").and_then(Value::as_bool).unwrap_or(false);
        let b_mine = b.get("isMine").and_then(Value::as_bool).unwrap_or(false);
        b_mine
            .cmp(&a_mine)
            .then_with(|| {
                let a_pl = a.get("playing").and_then(Value::as_u64).unwrap_or(0);
                let b_pl = b.get("playing").and_then(Value::as_u64).unwrap_or(0);
                b_pl.cmp(&a_pl)
            })
            .then_with(|| {
                let a_name = a.get("name").and_then(Value::as_str).unwrap_or("");
                let b_name = b.get("name").and_then(Value::as_str).unwrap_or("");
                a_name.to_lowercase().cmp(&b_name.to_lowercase())
            })
    });

    Ok(json!({
        "ok": true,
        "reason": Value::Null,
        "servers": servers,
        "meta": page_meta,
        "nextCursor": payload.get("nextPageCursor").and_then(Value::as_str)
    }))
}

async fn post_json_with_csrf(
    client: &reqwest::Client,
    url: &str,
    cookie_header: &str,
    body: &Value,
) -> Result<reqwest::Response, String> {
    let first = client
        .post(url)
        .header("Cookie", cookie_header)
        .header("Accept", "application/json")
        .header("Origin", "https://www.roblox.com")
        .header("Referer", "https://www.roblox.com/")
        .json(body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if first.status().as_u16() == 403 {
        if let Some(token) = first
            .headers()
            .get("x-csrf-token")
            .and_then(|v| v.to_str().ok())
            .filter(|v| !v.is_empty())
        {
            let token = token.to_string();
            return client
                .post(url)
                .header("Cookie", cookie_header)
                .header("X-CSRF-TOKEN", token)
                .header("Accept", "application/json")
                .header("Origin", "https://www.roblox.com")
                .header("Referer", "https://www.roblox.com/")
                .json(body)
                .send()
                .await
                .map_err(|e| e.to_string());
        }
    }
    Ok(first)
}

#[tauri::command]
pub async fn games_private_server_create(
    state: tauri::State<'_, Arc<AppState>>,
    universe_id: String,
    name: String,
    expected_price: u64,
    profile_id: Option<String>,
) -> Result<Value, String> {
    if !super::valid_numeric_id(&universe_id) {
        return Err("Invalid Universe ID".into());
    }
    let trimmed = name.trim();
    if trimmed.is_empty() || trimmed.len() > 50 {
        return Err("Invalid server name".into());
    }
    let raw_cookie = crate::profile_cookie(&state, profile_id.as_deref());
    let clean_cookie = roblox::normalize_cookie_value(&raw_cookie).to_string();
    if clean_cookie.is_empty() {
        return Ok(json!({ "ok": false, "reason": "auth-required" }));
    }
    let client = roblox::shared_http_client();
    let cookie_header = format!(".ROBLOSECURITY={clean_cookie}");
    let url = format!("https://games.roblox.com/v1/games/vip-servers/{universe_id}");
    let body = json!({
        "name": trimmed,
        "expectedPrice": expected_price
    });
    let resp = post_json_with_csrf(client, &url, &cookie_header, &body).await?;
    let status = resp.status().as_u16();
    let payload: Value = resp.json().await.unwrap_or(Value::Null);
    if !(200..300).contains(&status) {
        return Ok(json!({
            "ok": false,
            "reason": if status == 401 || status == 403 { "auth-error" } else { "error" },
            "message": roblox_api_error_message(&payload, status)
        }));
    }
    Ok(json!({ "ok": true, "server": payload }))
}

async fn patch_json_with_csrf(
    client: &reqwest::Client,
    url: &str,
    cookie_header: &str,
    body: &Value,
) -> Result<reqwest::Response, String> {
    let first = client
        .patch(url)
        .header("Cookie", cookie_header)
        .header("Accept", "application/json")
        .header("Origin", "https://www.roblox.com")
        .header("Referer", "https://www.roblox.com/")
        .json(body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if first.status().as_u16() == 403 {
        if let Some(token) = first
            .headers()
            .get("x-csrf-token")
            .and_then(|v| v.to_str().ok())
            .filter(|v| !v.is_empty())
        {
            let token = token.to_string();
            return client
                .patch(url)
                .header("Cookie", cookie_header)
                .header("X-CSRF-TOKEN", token)
                .header("Accept", "application/json")
                .header("Origin", "https://www.roblox.com")
                .header("Referer", "https://www.roblox.com/")
                .json(body)
                .send()
                .await
                .map_err(|e| e.to_string());
        }
    }
    Ok(first)
}

fn roblox_api_error_message(payload: &Value, status: u16) -> String {
    payload
        .get("errors")
        .and_then(Value::as_array)
        .and_then(|arr| arr.first())
        .and_then(|err| {
            err.get("userFacingMessage")
                .and_then(Value::as_str)
                .filter(|s| !s.is_empty())
                .or_else(|| err.get("message").and_then(Value::as_str))
        })
        .map(str::to_string)
        .unwrap_or_else(|| format!("HTTP {status}"))
}

#[tauri::command]
pub async fn games_private_server_get(
    state: tauri::State<'_, Arc<AppState>>,
    vip_server_id: String,
    profile_id: Option<String>,
) -> Result<Value, String> {
    if !super::valid_numeric_id(&vip_server_id) {
        return Err("Invalid VIP Server ID".into());
    }
    let raw_cookie = crate::profile_cookie(&state, profile_id.as_deref());
    let clean_cookie = roblox::normalize_cookie_value(&raw_cookie).to_string();
    if clean_cookie.is_empty() {
        return Ok(json!({ "ok": false, "reason": "auth-required" }));
    }
    let client = roblox::shared_http_client();
    let cookie_header = format!(".ROBLOSECURITY={clean_cookie}");
    let url = format!("https://games.roblox.com/v1/vip-servers/{vip_server_id}");
    let resp = client
        .get(&url)
        .header("Cookie", &cookie_header)
        .header("Accept", "application/json")
        .header("Origin", "https://www.roblox.com")
        .header("Referer", "https://www.roblox.com/")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let status = resp.status().as_u16();
    let payload: Value = resp.json().await.unwrap_or(Value::Null);
    if status == 401 || status == 403 {
        return Ok(json!({
            "ok": false,
            "reason": "cookie-expired",
            "message": roblox_api_error_message(&payload, status)
        }));
    }
    if !(200..300).contains(&status) {
        return Ok(json!({
            "ok": false,
            "reason": "error",
            "message": roblox_api_error_message(&payload, status)
        }));
    }
    Ok(json!({ "ok": true, "server": payload }))
}

#[tauri::command]
pub async fn games_private_server_update(
    state: tauri::State<'_, Arc<AppState>>,
    vip_server_id: String,
    name: Option<String>,
    active: Option<bool>,
    new_join_code: Option<bool>,
    profile_id: Option<String>,
) -> Result<Value, String> {
    if !super::valid_numeric_id(&vip_server_id) {
        return Err("Invalid VIP Server ID".into());
    }
    let raw_cookie = crate::profile_cookie(&state, profile_id.as_deref());
    let clean_cookie = roblox::normalize_cookie_value(&raw_cookie).to_string();
    if clean_cookie.is_empty() {
        return Ok(json!({ "ok": false, "reason": "auth-required" }));
    }
    let mut body = serde_json::Map::new();
    if let Some(n) = name {
        body.insert("name".into(), Value::String(n.trim().to_string()));
    }
    if let Some(a) = active {
        body.insert("active".into(), Value::Bool(a));
    }
    if let Some(code) = new_join_code {
        body.insert("newJoinCode".into(), Value::Bool(code));
    }
    if body.is_empty() {
        return Err("No changes provided".into());
    }
    let client = roblox::shared_http_client();
    let cookie_header = format!(".ROBLOSECURITY={clean_cookie}");
    let url = format!("https://games.roblox.com/v1/vip-servers/{vip_server_id}");
    let resp = patch_json_with_csrf(&client, &url, &cookie_header, &Value::Object(body)).await?;
    let status = resp.status().as_u16();
    let payload: Value = resp.json().await.unwrap_or(Value::Null);
    if !(200..300).contains(&status) {
        return Ok(json!({
            "ok": false,
            "reason": if status == 401 || status == 403 { "auth-error" } else { "error" },
            "message": roblox_api_error_message(&payload, status)
        }));
    }
    Ok(json!({ "ok": true, "server": payload }))
}

#[tauri::command]
pub async fn games_private_server_permissions(
    state: tauri::State<'_, Arc<AppState>>,
    vip_server_id: String,
    friends_allowed: Option<bool>,
    add_username: Option<String>,
    remove_user_id: Option<u64>,
    profile_id: Option<String>,
) -> Result<Value, String> {
    if !super::valid_numeric_id(&vip_server_id) {
        return Err("Invalid VIP Server ID".into());
    }
    let raw_cookie = crate::profile_cookie(&state, profile_id.as_deref());
    let clean_cookie = roblox::normalize_cookie_value(&raw_cookie).to_string();
    if clean_cookie.is_empty() {
        return Ok(json!({ "ok": false, "reason": "auth-required" }));
    }

    let mut users_to_add: Vec<u64> = Vec::new();
    if let Some(username) = add_username.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()) {
        match crate::friends::resolve_roblox_user_id(&username).await {
            Ok(Some(account)) => {
                if let Some(uid) = account
                    .get("id")
                    .and_then(|v| v.as_u64().or_else(|| v.as_str().and_then(|s| s.parse::<u64>().ok())))
                {
                    users_to_add.push(uid);
                } else {
                    return Ok(json!({ "ok": false, "reason": "user-not-found" }));
                }
            }
            Ok(None) => return Ok(json!({ "ok": false, "reason": "user-not-found" })),
            Err(error) => return Ok(json!({ "ok": false, "reason": "network", "message": error })),
        }
    }

    let mut body = serde_json::Map::new();
    if let Some(allowed) = friends_allowed {
        body.insert("friendsAllowed".into(), Value::Bool(allowed));
    }
    if !users_to_add.is_empty() {
        body.insert("usersToAdd".into(), json!(users_to_add));
    }
    if let Some(uid) = remove_user_id {
        body.insert("usersToRemove".into(), json!([uid]));
    }
    if body.is_empty() {
        return Err("No permission changes provided".into());
    }

    let client = roblox::shared_http_client();
    let cookie_header = format!(".ROBLOSECURITY={clean_cookie}");
    let url = format!("https://games.roblox.com/v1/vip-servers/{vip_server_id}/permissions");
    let resp = patch_json_with_csrf(&client, &url, &cookie_header, &Value::Object(body)).await?;
    let status = resp.status().as_u16();
    let payload: Value = resp.json().await.unwrap_or(Value::Null);
    if !(200..300).contains(&status) {
        return Ok(json!({
            "ok": false,
            "reason": if status == 401 || status == 403 { "auth-error" } else { "error" },
            "message": roblox_api_error_message(&payload, status)
        }));
    }
    Ok(json!({ "ok": true, "permissions": payload }))
}

#[tauri::command]
pub async fn games_ping_regions() -> Result<Value, String> {
    let regions = overlay_ping::probe_all_regions().await;
    Ok(json!({ "ok": true, "regions": regions }))
}

#[tauri::command]
pub async fn games_public_servers(
    place_id: String,
    cursor: Option<String>,
    smallest: Option<bool>,
) -> Result<Value, String> {
    if !super::valid_numeric_id(&place_id) {
        return Err("Invalid Place ID".into());
    }
    let sorting = if smallest.unwrap_or(false) {
        "Asc"
    } else {
        "Desc"
    };
    let mut url = format!(
        "https://games.roblox.com/v1/games/{place_id}/servers/Public?limit=50&sortOrder={sorting}&excludeFullGames={}",
        smallest.unwrap_or(false)
    );
    if let Some(cursor) = cursor.filter(|value| !value.is_empty()) {
        if cursor.len() > 1024 {
            return Err("Invalid server cursor".into());
        }
        url.push_str("&cursor=");
        url.push_str(&super::encode_query(&cursor));
    }
    let payload = roblox::fetch_json(&url, None).await?;
    let rows = payload
        .get("data")
        .and_then(Value::as_array)
        .ok_or("Invalid Roblox server response")?;
    let servers: Vec<_> = rows.iter().filter_map(normalize_server).collect();
    Ok(
        json!({"servers": servers, "nextCursor": payload.get("nextPageCursor").and_then(Value::as_str)}),
    )
}

/// Look up Roblox's advertised ping for a live server ID, falling back to the
/// universe's root place (for teleported match sub-places) and to the median
/// ping of the place's public servers when the active instance is a reserved
/// or private server not listed by ID.
pub async fn public_server_ping(place_id: &str, server_id: &str) -> Option<u32> {
    if !super::valid_numeric_id(place_id) {
        return None;
    }
    let client = roblox::shared_http_client();
    if let Some(ping) = lookup_place_ping(client, place_id, server_id).await {
        return Some(ping);
    }
    let root_place = resolve_root_place(client, place_id).await?;
    if root_place != place_id {
        return lookup_place_ping(client, &root_place, server_id).await;
    }
    None
}

async fn lookup_place_ping(
    client: &reqwest::Client,
    place_id: &str,
    server_id: &str,
) -> Option<u32> {
    let valid_server = Uuid::parse_str(server_id).is_ok();
    let mut cursor: Option<String> = None;
    let mut fallback = Vec::new();
    for _page in 0..5 {
        let mut url = format!(
            "https://games.roblox.com/v1/games/{place_id}/servers/Public?limit=100&sortOrder=Desc&excludeFullGames=false"
        );
        if let Some(value) = cursor.as_deref() {
            url.push_str("&cursor=");
            url.push_str(&super::encode_query(value));
        }
        let response = client.get(url).send().await.ok()?;
        if !response.status().is_success() {
            break;
        }
        let payload: Value = response.json().await.ok()?;
        let Some(rows) = payload.get("data").and_then(Value::as_array) else {
            break;
        };
        if rows.is_empty() {
            break;
        }
        if valid_server {
            if let Some(ping) = ping_for_server(rows, server_id) {
                return Some(ping);
            }
        }
        if fallback.is_empty() {
            fallback.extend(rows.iter().filter_map(row_ping));
            if !valid_server {
                break;
            }
        }
        cursor = payload
            .get("nextPageCursor")
            .and_then(Value::as_str)
            .map(str::to_owned);
        if cursor.is_none() {
            break;
        }
    }
    representative_ping(&mut fallback)
}

async fn resolve_root_place(client: &reqwest::Client, place_id: &str) -> Option<String> {
    let universe_url = format!("https://apis.roblox.com/universes/v1/places/{place_id}/universe");
    let universe: Value = client.get(universe_url).send().await.ok()?.json().await.ok()?;
    let universe_id = universe.get("universeId")?.as_u64()?;
    let games_url = format!("https://games.roblox.com/v1/games?universeIds={universe_id}");
    let games: Value = client.get(games_url).send().await.ok()?.json().await.ok()?;
    let root = games
        .get("data")?
        .as_array()?
        .first()?
        .get("rootPlaceId")?
        .as_u64()?;
    Some(root.to_string())
}

fn row_ping(row: &Value) -> Option<u32> {
    row.get("ping")?
        .as_u64()
        .and_then(|ping| (1..=9_999).contains(&ping).then_some(ping as u32))
}

fn representative_ping(samples: &mut [u32]) -> Option<u32> {
    if samples.is_empty() {
        return None;
    }
    samples.sort_unstable();
    Some(samples[samples.len() / 2])
}

fn ping_for_server(rows: &[Value], server_id: &str) -> Option<u32> {
    rows.iter().find_map(|row| {
        let id = Uuid::parse_str(row.get("id")?.as_str()?).ok()?;
        if !id.hyphenated().to_string().eq_ignore_ascii_case(server_id) {
            return None;
        }
        row_ping(row)
    })
}

fn normalize_server(row: &Value) -> Option<Value> {
    let id = Uuid::parse_str(row.get("id")?.as_str()?)
        .ok()?
        .hyphenated()
        .to_string();
    let playing = row.get("playing")?.as_u64()?;
    let capacity = row.get("maxPlayers")?.as_u64()?;
    if capacity == 0 {
        return None;
    }
    let ping = row
        .get("ping")
        .and_then(Value::as_u64)
        .filter(|&ping| ping > 0);
    Some(json!({ "id": id, "playing": playing, "capacity": capacity, "ping": ping }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn official_ping_matches_server_id_and_preserves_unknown_values() {
        let id = "c382fbfa-3680-4efe-ab39-c9fde1d5cbb8";
        let rows = vec![
            json!({"id":"invalid","ping": 999}),
            json!({"id":"9aedfe90-4a32-4a27-8dea-6849ab68096e","ping":43}),
            json!({"id":id,"ping":69}),
        ];
        assert_eq!(ping_for_server(&rows, id), Some(69));
        assert_eq!(ping_for_server(&rows, "00000000-0000-0000-0000-000000000000"), None);
        assert_eq!(ping_for_server(&[json!({"id":id,"ping":0})], id), None);
    }

    #[tokio::test]
    #[ignore = "queries the live Roblox API; run with --ignored"]
    async fn live_public_server_ping_lookup() {
        let place = std::env::var("VORTEX_PING_PLACE").unwrap_or_else(|_| "8304191830".into());
        let server = std::env::var("VORTEX_PING_SERVER")
            .unwrap_or_else(|_| "1f98f052-5b9f-4583-80bd-3b546e35da8a".into());
        let ping = public_server_ping(&place, &server).await;
        println!("Roblox API ping for {place}/{server}: {ping:?}");
        assert!(ping.is_some(), "server may have left or Roblox may rate-limit the API");
    }

    #[test]
    fn public_server_rows_keep_unknown_ping_and_exclude_player_tokens() {
        let id = "12345678-1234-4123-a123-123456789abc";
        let row = normalize_server(
            &json!({"id":id,"playing":8,"maxPlayers":12,"ping":0,"playerTokens":["ignored"]}),
        )
        .unwrap();
        assert_eq!(row, json!({"id":id,"playing":8,"capacity":12,"ping":null}));
        assert!(normalize_server(&json!({"id":"invalid","playing":8,"maxPlayers":12})).is_none());
    }

    #[test]
    fn extracts_udmux_and_machine_address_from_join_script() {
        let udmux_payload = json!({
            "status": 2,
            "joinScript": {
                "MachineAddress": "10.128.0.12",
                "UdmuxEndpoints": [
                    { "Address": "128.116.86.33", "Port": 53640 }
                ]
            }
        });
        assert_eq!(
            extract_join_script_ip(&udmux_payload),
            Some(Ipv4Addr::new(128, 116, 86, 33))
        );

        let machine_payload = json!({
            "status": 2,
            "joinScript": {
                "MachineAddress": "128.116.21.44",
                "UdmuxEndpoints": []
            }
        });
        assert_eq!(
            extract_join_script_ip(&machine_payload),
            Some(Ipv4Addr::new(128, 116, 21, 44))
        );

        let private_only = json!({
            "status": 2,
            "joinScript": { "MachineAddress": "10.0.0.1" }
        });
        assert_eq!(extract_join_script_ip(&private_only), None);
    }

    #[test]
    fn normalizes_private_server_rows_and_marks_owner() {
        let row = json!({
            "vipServerId": 991122,
            "accessCode": "abc-123-access",
            "id": "12345678-1234-4123-a123-123456789abc",
            "name": "My VIP",
            "playing": 2,
            "maxPlayers": 10,
            "owner": { "id": 42, "name": "miver", "displayName": "Miver", "hasVerifiedBadge": false },
            "players": [{ "name": "alex", "displayName": "Alex" }]
        });
        let mine = normalize_private_server(&row, Some(42)).unwrap();
        assert_eq!(mine["isMine"], true);
        assert_eq!(mine["vipServerId"], 991122);
        assert_eq!(mine["accessCode"], "abc-123-access");
        assert_eq!(mine["players"], json!(["Alex"]));

        let friend = normalize_private_server(&row, Some(99)).unwrap();
        assert_eq!(friend["isMine"], false);

        let deactivated = normalize_private_server(&json!({"vipServerId": 1, "accessCode": ""}), Some(42)).unwrap();
        assert_eq!(deactivated["active"], false);
        assert!(normalize_private_server(&json!({"vipServerId": 0, "accessCode": ""}), Some(42)).is_none());
    }
}
