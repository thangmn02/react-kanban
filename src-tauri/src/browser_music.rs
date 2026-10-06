//! Companion metadata/onsets only. Native PCM never crosses this WebSocket.
use futures_util::{
    future::{join_all, select, Either},
    SinkExt, StreamExt,
};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::{
    net::TcpListener,
    sync::{mpsc, oneshot},
    time::timeout,
};
use tokio_tungstenite::{
    accept_hdr_async_with_config,
    tungstenite::{
        handshake::server::{ErrorResponse, Request, Response},
        protocol::WebSocketConfig,
        Message,
    },
};
use uuid::Uuid;

const PORT: u16 = 47635;
const PROTOCOL: &str = "kora-widget-v1";
const MAX_FRAME: usize = 64 * 1024;
type Pending = (String, oneshot::Sender<Value>);

#[derive(Clone)]
pub struct BrowserMusic {
    app: AppHandle,
    peers: Arc<Mutex<HashMap<String, mpsc::Sender<Value>>>>,
    pending: Arc<Mutex<HashMap<String, Pending>>>,
    connections: Arc<Mutex<HashMap<String, u16>>>,
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn allowed_origin(origin: &str) -> bool {
    origin
        .strip_prefix("chrome-extension://")
        .is_some_and(|id| id.len() == 32 && id.bytes().all(|b| (b'a'..=b'p').contains(&b)))
}

fn allowed_source(source: &str) -> bool {
    matches!(
        source,
        "youtube.com"
            | "www.youtube.com"
            | "m.youtube.com"
            | "music.youtube.com"
            | "soundcloud.com"
            | "www.soundcloud.com"
            | "m.soundcloud.com"
            | "open.spotify.com"
            | "music.apple.com"
            | "deezer.com"
            | "www.deezer.com"
            | "tidal.com"
            | "www.tidal.com"
            | "listen.tidal.com"
    )
}

fn handshake(request: &Request, response: Response) -> Result<Response, ErrorResponse> {
    let origin = request
        .headers()
        .get("Origin")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let host = request
        .headers()
        .get("Host")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if !allowed_origin(origin)
        || host != format!("127.0.0.1:{PORT}")
        || request.uri().path() != "/kora-music"
    {
        return Err(Response::builder()
            .status(403)
            .body(Some("Unavailable".into()))
            .unwrap());
    }
    Ok(response)
}

impl BrowserMusic {
    pub fn new(app: AppHandle) -> Self {
        Self {
            app,
            peers: Arc::default(),
            pending: Arc::default(),
            connections: Arc::default(),
        }
    }
    pub fn start(&self) {
        let clock = self.clone();
        std::thread::spawn(move || loop {
            let _ = clock.app.emit("native-clock", now());
            std::thread::sleep(Duration::from_secs(1));
        });
        let bridge = self.clone();
        tauri::async_runtime::spawn(async move {
            // Explicit IPv4 loopback bind; never expose the bridge on the LAN.
            let Ok(listener) = TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, PORT)).await
            else {
                return;
            };
            let slots = Arc::new(tokio::sync::Semaphore::new(8));
            while let Ok((stream, address)) = listener.accept().await {
                if !address.ip().is_loopback() {
                    continue;
                }
                let Ok(permit) = slots.clone().try_acquire_owned() else {
                    continue;
                };
                let bridge = bridge.clone();
                tauri::async_runtime::spawn(async move {
                    let _permit = permit;
                    let config = WebSocketConfig::default()
                        .max_message_size(Some(MAX_FRAME))
                        .max_frame_size(Some(MAX_FRAME));
                    let Ok(Ok(mut socket)) = timeout(
                        Duration::from_secs(2),
                        accept_hdr_async_with_config(stream, handshake, Some(config)),
                    )
                    .await
                    else {
                        return;
                    };
                    let nonce = Uuid::new_v4().to_string();
                    let hello = json!({"type":"hello","protocol":PROTOCOL,"nonce":nonce});
                    if socket
                        .send(Message::Text(hello.to_string().into()))
                        .await
                        .is_err()
                    {
                        return;
                    }
                    let Ok(Some(Ok(Message::Text(ack)))) =
                        timeout(Duration::from_secs(2), socket.next()).await
                    else {
                        return;
                    };
                    let Ok(ack) = serde_json::from_str::<Value>(&ack) else {
                        return;
                    };
                    if ack["type"] != "hello"
                        || ack["protocol"] != PROTOCOL
                        || ack["nonce"] != nonce
                    {
                        return;
                    }
                    let id = Uuid::new_v4().to_string();
                    let (send, mut receive) = mpsc::channel::<Value>(64);
                    bridge.peers.lock().unwrap().insert(id.clone(), send);
                    bridge.connections.lock().unwrap().insert(id.clone(), address.port());
                    loop {
                        let next = select(
                            Box::pin(receive.recv()),
                            Box::pin(timeout(Duration::from_secs(35), socket.next())),
                        )
                        .await;
                        match next {
                            Either::Left((message, pending)) => {
                                drop(pending);
                                let Some(mut message) = message else {
                                    break;
                                };
                                message["nonce"] = json!(nonce);
                                if socket
                                    .send(Message::Text(message.to_string().into()))
                                    .await
                                    .is_err()
                                {
                                    break;
                                }
                            }
                            Either::Right((incoming, pending)) => {
                                drop(pending);
                                let Ok(Some(Ok(message))) = incoming else {
                                    break;
                                };
                                match message {
                                    Message::Text(text) => {
                                        let Ok(mut value) = serde_json::from_str::<Value>(&text)
                                        else {
                                            continue;
                                        };
                                        if value["nonce"] != nonce {
                                            continue;
                                        }
                                        if value["type"] == "response" {
                                            let Some(key) = value["requestId"].as_str() else {
                                                continue;
                                            };
                                            let mut pending = bridge.pending.lock().unwrap();
                                            if pending
                                                .get(key)
                                                .is_some_and(|(owner, _)| owner == &id)
                                            {
                                                if let Some((_, reply)) = pending.remove(key) {
                                                    let _ = reply.send(value);
                                                }
                                            }
                                        } else if value["type"] == "beat" {
                                            let Some(session) = value["sessionId"]
                                                .as_str()
                                                .filter(|s| s.len() <= 250)
                                            else {
                                                continue;
                                            };
                                            // Keep original emission time: minimized/queued flashes must expire.
                                            if !value["emittedAt"]
                                                .as_u64()
                                                .is_some_and(|t| now().abs_diff(t) <= 600)
                                            {
                                                continue;
                                            }
                                            value["sessionId"] = json!(format!("{id}:{session}"));
                                            let _ = bridge.app.emit("native-music-beat", value);
                                        }
                                    }
                                    Message::Ping(data) => {
                                        if socket.send(Message::Pong(data)).await.is_err() {
                                            break;
                                        }
                                    }
                                    Message::Close(_) => break,
                                    _ => {}
                                }
                            }
                        }
                    }
                    bridge.peers.lock().unwrap().remove(&id);
                    bridge.connections.lock().unwrap().remove(&id);
                    bridge
                        .pending
                        .lock()
                        .unwrap()
                        .retain(|_, (owner, _)| owner != &id);
                });
            }
        });
    }
    async fn ask(&self, peer: &str, mut message: Value) -> Result<Value, String> {
        let sender = self
            .peers
            .lock()
            .unwrap()
            .get(peer)
            .cloned()
            .ok_or("Companion disconnected")?;
        let request_id = Uuid::new_v4().to_string();
        message["type"] = json!("request");
        message["requestId"] = json!(request_id);
        let (reply, receive) = oneshot::channel();
        self.pending
            .lock()
            .unwrap()
            .insert(request_id.clone(), (peer.to_owned(), reply));
        let result = async {
            sender
                .try_send(message)
                .map_err(|_| "Companion busy".to_owned())?;
            timeout(Duration::from_millis(1800), receive)
                .await
                .map_err(|_| "Companion timed out".to_owned())?
                .map_err(|_| "Companion disconnected".to_owned())
        }
        .await;
        self.pending.lock().unwrap().remove(&request_id);
        result
    }
    pub async fn audio_browser_port(&self, session_id: &str) -> Result<u16, String> {
        if session_id.len() > 300 { return Err("Invalid music session".into()); }
        let (peer, session) = session_id.split_once(':').ok_or("Invalid music session")?;
        let response = self.ask(peer, json!({"action":"sessions.get"})).await?;
        let valid = response["sessions"].as_array().is_some_and(|sessions| sessions.iter().take(64).any(|item|
            item["id"].as_str() == Some(session) && item["paused"] == false && item["playing"] == true
                && item["source"].as_str().is_some_and(allowed_source)));
        if !valid { return Err("The selected music is not playing".into()); }
        self.connections.lock().map_err(|_| "Music connection unavailable")?
            .get(peer).copied().ok_or_else(|| "Companion disconnected".into())
    }
}

#[tauri::command]
pub async fn native_music_request(
    music: State<'_, BrowserMusic>,
    action: String,
    session_id: Option<String>,
    subscription_id: Option<String>,
    native_audio: Option<bool>,
) -> Result<Value, String> {
    if action == "sessions.get" {
        let peers: Vec<_> = music.peers.lock().unwrap().keys().cloned().collect();
        if peers.is_empty() {
            return Ok(json!({"ok":false,"error":"not-installed"}));
        }
        let requests = peers
            .iter()
            .map(|peer| music.ask(peer, json!({"action":action})));
        let mut sessions = Vec::new();
        for (peer, response) in peers.iter().zip(join_all(requests).await) {
            let Ok(response) = response else {
                continue;
            };
            if let Some(items) = response["sessions"].as_array() {
                for session in items.iter().take(64) {
                    let Some(source) = session["source"].as_str() else {
                        continue;
                    };
                    let Some(id) = session["id"].as_str().filter(|id| id.len() <= 250) else {
                        continue;
                    };
                    if !allowed_source(source) {
                        continue;
                    }
                    let mut session = session.clone();
                    session["id"] = json!(format!("{peer}:{id}"));
                    sessions.push(session);
                }
            }
        }
        return Ok(json!({"ok":true,"sessions":sessions}));
    }
    if !matches!(
        action.as_str(),
        "media.play"
            | "media.pause"
            | "media.focus"
            | "instrument.setup"
            | "dock.beat.sync.start"
            | "dock.beat.sync.stop"
    ) {
        return Err("Unsupported music action".into());
    }
    let session = session_id
        .filter(|s| s.len() <= 300)
        .ok_or("Missing session")?;
    let (peer, session) = session.split_once(':').ok_or("Invalid session")?;
    if action.starts_with("dock.")
        && !subscription_id
            .as_ref()
            .is_some_and(|s| !s.is_empty() && s.len() <= 100)
    {
        return Err("Invalid subscription".into());
    }
    let mut result = music
        .ask(
            peer,
            json!({"action":action,"sessionId":session,"subscriptionId":subscription_id,"nativeAudio":native_audio.unwrap_or(false)}),
        )
        .await?;
    if let Some(sessions) = result["sessions"].as_array_mut() {
        for s in sessions {
            if let Some(id) = s["id"].as_str() {
                s["id"] = json!(format!("{peer}:{id}"));
            }
        }
    }
    Ok(result)
}

#[tauri::command]
pub fn native_music_setup(app: AppHandle) -> Result<(), String> {
    let folder = app.path().resolve("music-companion", tauri::path::BaseDirectory::Resource)
        .map_err(|_| "Could not locate the included Companion".to_owned())?;
    if !folder.join("extension/manifest.json").is_file() {
        return Err("The included Companion is missing. Reinstall Kora to restore it.".into());
    }
    #[cfg(windows)]
    std::process::Command::new("explorer.exe")
        .arg(folder)
        .spawn()
        .map_err(|_| "Could not open the Companion folder".to_owned())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn excludes_web_origins_and_non_music_sources() {
        assert!(allowed_origin(
            "chrome-extension://abcdefghijklmnopabcdefghijklmnop"
        ));
        for origin in [
            "https://evil.example",
            "http://localhost:5173",
            "null",
            "chrome-extension://../evil",
        ] {
            assert!(!allowed_origin(origin));
        }
        for source in [
            "zalo.me",
            "chat.zalo.me",
            "System audio",
            "Spotify.exe",
            "evil.youtube.com",
        ] {
            assert!(!allowed_source(source));
        }
        assert!(allowed_source("music.youtube.com"));
        assert!(allowed_source("music.apple.com"));
    }
    #[test]
    fn rejects_wrong_host_path_and_missing_origin() {
        let valid = Request::builder()
            .uri("/kora-music")
            .header("Host", "127.0.0.1:47635")
            .header(
                "Origin",
                "chrome-extension://abcdefghijklmnopabcdefghijklmnop",
            )
            .body(())
            .unwrap();
        assert!(handshake(&valid, Response::new(())).is_ok());
        let invalid = Request::builder()
            .uri("/kora-music")
            .header("Host", "evil.example")
            .body(())
            .unwrap();
        assert!(handshake(&invalid, Response::new(())).is_err());
    }
}
