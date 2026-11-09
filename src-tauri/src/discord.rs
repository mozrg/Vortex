use serde_json::{json, Value};
use std::sync::Arc;
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};
use tokio::net::windows::named_pipe::{ClientOptions, NamedPipeClient};
use tokio::sync::{mpsc, oneshot, Mutex as AsyncMutex};
use tokio::time::{timeout, Duration};
use uuid::Uuid;

use crate::state::AppState;

const DEFAULT_CLIENT_ID: &str = "1536230039870505020";
const CONNECT_TIMEOUT: Duration = Duration::from_secs(5);

pub struct DiscordCommand {
    pub enabled: bool,
    pub activity: Option<Value>,
    pub update_activity: bool,
    pub reply: oneshot::Sender<Result<(), String>>,
}

struct Connection {
    writer: Arc<AsyncMutex<tokio::io::WriteHalf<NamedPipeClient>>>,
    closed: oneshot::Receiver<()>,
    reader_task: tokio::task::JoinHandle<()>,
}

impl Drop for Connection {
    fn drop(&mut self) {
        self.reader_task.abort();
    }
}

pub async fn send_activity(
    state: &AppState,
    enabled: bool,
    activity: Option<Value>,
    update_activity: bool,
) -> Result<(), String> {
    let sender = state
        .discord_commands
        .lock()
        .map_err(|_| "Discord worker unavailable".to_string())?
        .clone()
        .ok_or_else(|| "Discord worker is not ready".to_string())?;
    let (reply, response) = oneshot::channel();
    sender
        .send(DiscordCommand {
            enabled,
            activity,
            update_activity,
            reply,
        })
        .map_err(|_| "Discord worker stopped".to_string())?;
    response
        .await
        .map_err(|_| "Discord worker stopped".to_string())?
}

/// The handshake id: a custom application id from Settings when present,
/// otherwise the id Vortex ships with.
pub fn effective_client_id(state: &AppState) -> String {
    let custom = state
        .discord_client_id
        .lock()
        .map(|value| value.trim().to_string())
        .unwrap_or_default();
    if custom.chars().all(|c| c.is_ascii_digit()) && custom.len() >= 15 {
        custom
    } else {
        DEFAULT_CLIENT_ID.to_string()
    }
}

pub fn public_status(state: &AppState, enabled: bool) -> Result<Value, String> {
    let discord = state
        .discord
        .lock()
        .map_err(|_| "Discord state unavailable".to_string())?;
    let client_id = effective_client_id(state);
    Ok(json!({
        "enabled": enabled,
        "connected": discord.connected,
        "hasClientId": !client_id.is_empty(),
        "clientId": client_id,
        "error": discord.error,
        "account": discord.account
    }))
}

pub async fn run(mut commands: mpsc::UnboundedReceiver<DiscordCommand>, state: Arc<AppState>) {
    let mut connection: Option<Connection> = None;
    let mut enabled = false;
    let mut active_client_id = effective_client_id(&state);
    let mut reconnect = tokio::time::interval(Duration::from_secs(10));
    reconnect.tick().await;
    loop {
        tokio::select! {
            command = commands.recv() => {
                let Some(command) = command else { break };
                enabled = command.enabled;
                // A changed application id needs a fresh IPC handshake.
                let wanted_client_id = effective_client_id(&state);
                if wanted_client_id != active_client_id {
                    active_client_id = wanted_client_id;
                    connection = None;
                }
                if !enabled {
                    connection = None;
                    set_connection_state(&state, false, "");
                    let _ = command.reply.send(Ok(()));
                    continue;
                }
                if connection.as_mut().is_some_and(|active| active.closed.try_recv().is_ok()) { connection = None; }
                if connection.is_none() {
                    match start_connection(&state, &active_client_id).await {
                        Ok(active) => connection = Some(active),
                        Err(error) => {
                            set_connection_state(&state, false, &error);
                            let _ = command.reply.send(Err(error));
                            continue;
                        }
                    }
                }
                if command.update_activity {
                    if let Some(active) = connection.as_mut() {
                        if let Err(error) = send_rpc_activity(&active.writer, command.activity).await {
                            connection = None;
                            set_connection_state(&state, false, &error);
                            let _ = command.reply.send(Err(error));
                            continue;
                        }
                    }
                }
                let _ = command.reply.send(Ok(()));
            }
            _ = reconnect.tick(), if enabled => {
                if connection.as_mut().is_some_and(|active| active.closed.try_recv().is_ok()) {
                    connection = None;
                    set_connection_state(&state, false, "discord-not-running");
                }
                let wanted_client_id = effective_client_id(&state);
                if wanted_client_id != active_client_id {
                    active_client_id = wanted_client_id;
                    connection = None;
                }
                if connection.is_none() {
                    if let Ok(active) = start_connection(&state, &active_client_id).await {
                        connection = Some(active);
                        let activity = state.discord.lock().ok().and_then(|discord| discord.activity.as_ref().map(|value| json!({"details": value.details, "state": value.state})));
                        if let Some(active) = connection.as_ref() {
                            if let Err(error) = send_rpc_activity(&active.writer, activity).await {
                                connection = None;
                                set_connection_state(&state, false, &error);
                            }
                        }
                    }
                }
            }
        }
    }
}

async fn start_connection(state: &AppState, client_id: &str) -> Result<Connection, String> {
    let (mut reader, writer) = open_connection(client_id).await?;
    let (closed_tx, closed_rx) = oneshot::channel();
    let writer = Arc::new(AsyncMutex::new(writer));
    let reader_writer = writer.clone();
    let reader_task = tokio::spawn(async move {
        loop {
            match read_frame(&mut reader).await {
                Ok((3, payload)) => {
                    if write_frame(&mut *reader_writer.lock().await, 4, &payload)
                        .await
                        .is_err()
                    {
                        break;
                    }
                }
                Ok((2, _)) | Err(_) => break,
                _ => {}
            }
        }
        let _ = closed_tx.send(());
    });
    set_connection_state(state, true, "");
    Ok(Connection {
        writer,
        closed: closed_rx,
        reader_task,
    })
}

async fn send_rpc_activity(
    writer: &Arc<AsyncMutex<tokio::io::WriteHalf<NamedPipeClient>>>,
    activity: Option<Value>,
) -> Result<(), String> {
    let activity = activity.map(|mut value| {
        if !value.is_object() {
            value = json!({});
        }
        value["type"] = json!(0);
        value
    });
    let request = json!({
        "cmd": "SET_ACTIVITY",
        "args": { "pid": std::process::id(), "activity": activity },
        "nonce": Uuid::new_v4().to_string()
    });
    let body = serde_json::to_vec(&request).map_err(|error| error.to_string())?;
    write_frame(&mut *writer.lock().await, 1, &body)
        .await
        .map_err(|error| error.to_string())
}

async fn open_connection(
    client_id: &str,
) -> Result<
    (
        tokio::io::ReadHalf<NamedPipeClient>,
        tokio::io::WriteHalf<NamedPipeClient>,
    ),
    String,
> {
    let mut last_error = String::from("discord-not-running");
    for index in 0..10 {
        let path = format!(r"\\?\pipe\discord-ipc-{index}");
        match ClientOptions::new().open(&path) {
            Ok(mut pipe) => {
                let handshake = json!({ "v": 1, "client_id": client_id });
                let payload = serde_json::to_vec(&handshake).map_err(|error| error.to_string())?;
                write_frame(&mut pipe, 0, &payload)
                    .await
                    .map_err(|error| error.to_string())?;
                let ready = timeout(CONNECT_TIMEOUT, async {
                    loop {
                        let (opcode, payload) = read_frame(&mut pipe)
                            .await
                            .map_err(|error| error.to_string())?;
                        if opcode == 2 {
                            return Err("Discord closed the RPC connection".to_string());
                        }
                        if opcode == 1 {
                            let message: Value =
                                serde_json::from_slice(&payload).unwrap_or(Value::Null);
                            if message.get("evt").and_then(Value::as_str) == Some("READY") {
                                return Ok(());
                            }
                            if let Some(error) = message
                                .get("data")
                                .and_then(|data| data.get("message"))
                                .and_then(Value::as_str)
                            {
                                return Err(error.to_string());
                            }
                        }
                    }
                })
                .await
                .map_err(|_| "Discord handshake timed out".to_string())?;
                ready?;
                return Ok(tokio::io::split(pipe));
            }
            Err(error) => last_error = error.to_string(),
        }
    }
    if last_error.contains("The system cannot find the file") || last_error.contains("os error 2") {
        Err("discord-not-running".to_string())
    } else {
        Err(format!("Discord IPC unavailable: {last_error}"))
    }
}

async fn read_frame<R: AsyncRead + Unpin>(reader: &mut R) -> std::io::Result<(u32, Vec<u8>)> {
    let mut header = [0_u8; 8];
    reader.read_exact(&mut header).await?;
    let opcode = u32::from_le_bytes(header[0..4].try_into().expect("four bytes"));
    let length = u32::from_le_bytes(header[4..8].try_into().expect("four bytes")) as usize;
    if length > 1024 * 1024 {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "Discord IPC frame too large",
        ));
    }
    let mut payload = vec![0_u8; length];
    reader.read_exact(&mut payload).await?;
    Ok((opcode, payload))
}

async fn write_frame<W: AsyncWrite + Unpin>(
    writer: &mut W,
    opcode: u32,
    payload: &[u8],
) -> std::io::Result<()> {
    writer.write_all(&opcode.to_le_bytes()).await?;
    writer
        .write_all(&(payload.len() as u32).to_le_bytes())
        .await?;
    writer.write_all(payload).await?;
    writer.flush().await
}

fn set_connection_state(state: &AppState, connected: bool, error: &str) {
    if let Ok(mut discord) = state.discord.lock() {
        discord.connected = connected;
        discord.error = error.to_string();
    }
}
