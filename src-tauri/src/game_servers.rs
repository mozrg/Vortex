use crate::roblox;
use serde_json::{json, Value};
use uuid::Uuid;

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
    let client = reqwest::Client::builder()
        .user_agent("Vortex-Place-Launcher")
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .ok()?;
    if let Some(ping) = lookup_place_ping(&client, place_id, server_id).await {
        return Some(ping);
    }
    let root_place = resolve_root_place(&client, place_id).await?;
    if root_place != place_id {
        return lookup_place_ping(&client, &root_place, server_id).await;
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
}
