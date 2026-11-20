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
