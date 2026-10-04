use serde_json::{json, Value};
use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
#[derive(Clone)]
struct Subscription {
    session: String,
    subscriber: String,
    capture: String,
    sequence: u64,
}
#[derive(Default)]
struct Feed {
    sessions: Vec<Value>,
    subscription: Option<Subscription>,
    audible_at: u64,
    reason: String,
}
#[derive(Clone)]
pub struct NativeAudio {
    app: AppHandle,
    feed: Arc<Mutex<Feed>>,
    enabled: Arc<AtomicBool>,
}
impl NativeAudio {
    pub fn new(app: AppHandle) -> Self {
        Self {
            app,
            feed: Arc::new(Mutex::new(Feed::default())),
            enabled: Arc::new(AtomicBool::new(false)),
        }
    }
    pub fn start(&self) {
        let clock = self.clone();
        thread::spawn(move || loop {
            let _ = clock.app.emit("native-clock", now());
            thread::sleep(Duration::from_secs(1));
        });
        #[cfg(windows)]
        {
            let media = self.clone();
            thread::spawn(move || windows_audio::metadata(media));
            let audio = self.clone();
            thread::spawn(move || windows_audio::capture(audio));
        }
    }
    fn status(&self, feed: &Feed, playing: bool) -> Value {
        if !self.enabled.load(Ordering::Relaxed) {
            json!({"mode":"clock","reason":"disabled"})
        } else if !playing {
            json!({"mode":"clock","reason":"not-playing"})
        } else if now().saturating_sub(feed.audible_at) <= 300 && feed.subscription.is_some() {
            json!({"mode":"capture","captureId":feed.subscription.as_ref().unwrap().capture})
        } else {
            json!({"mode":"clock","reason":if feed.reason.is_empty() { "silent" } else { &feed.reason }})
        }
    }
    fn publish(&self, sub: &Subscription, mut event: Value) {
        event["sessionId"] = json!(sub.session);
        event["subscriptionId"] = json!(sub.subscriber);
        event["emittedAt"] = json!(now());
        let _ = self.app.emit("native-music-beat", event);
    }
    fn snapshot(&self) -> Value {
        let feed = self.feed.lock().unwrap();
        let sessions: Vec<_> = feed
            .sessions
            .iter()
            .map(|s| {
                let mut session = s.clone();
                session["syncState"] = if feed
                    .subscription
                    .as_ref()
                    .is_some_and(|sub| sub.session == s["id"])
                {
                    self.status(&feed, s["playing"] == true)
                } else {
                    json!({"mode":"clock","reason":"not-selected"})
                };
                session
            })
            .collect();
        json!({"ok":true,"sessions":sessions})
    }
}

#[tauri::command]
pub fn native_audio_enable(audio: State<'_, NativeAudio>, enabled: bool) -> bool {
    audio.enabled.store(enabled, Ordering::Relaxed);
    let mut feed = audio.feed.lock().unwrap();
    feed.audible_at = 0;
    if let Some(sub) = feed.subscription.as_mut() {
        sub.capture = Uuid::new_v4().to_string();
        sub.sequence = 0;
    }
    enabled
}

#[tauri::command]
pub async fn native_music_request(
    audio: State<'_, NativeAudio>,
    action: String,
    session_id: Option<String>,
    subscription_id: Option<String>,
) -> Result<Value, String> {
    match action.as_str() {
        "sessions.get" => Ok(audio.snapshot()),
        "dock.beat.sync.start" => {
            let session = session_id.ok_or("Missing session")?;
            let subscriber = subscription_id.ok_or("Missing subscriber")?;
            if session.len() > 100 || subscriber.len() > 100 {
                return Err("Invalid subscription".into());
            }
            let mut feed = audio.feed.lock().unwrap();
            if !feed.sessions.iter().any(|s| s["id"] == session) {
                return Err("Session unavailable".into());
            }
            // Renewals do not reset the detector. No browser-tab lease: the native
            // subscription stays alive while the widget is minimized.
            if !feed
                .subscription
                .as_ref()
                .is_some_and(|s| s.session == session && s.subscriber == subscriber)
            {
                feed.subscription = Some(Subscription {
                    session,
                    subscriber,
                    capture: Uuid::new_v4().to_string(),
                    sequence: 0,
                });
                feed.audible_at = 0;
            }
            Ok(json!({"ok":true}))
        }
        "dock.beat.sync.stop" => {
            let mut feed = audio.feed.lock().unwrap();
            if feed.subscription.as_ref().is_some_and(|s| {
                Some(&s.session) == session_id.as_ref()
                    && Some(&s.subscriber) == subscription_id.as_ref()
            }) {
                feed.subscription = None;
                feed.audible_at = 0;
            }
            Ok(json!({"ok":true}))
        }
        "media.play" | "media.pause" => {
            #[cfg(windows)]
            {
                let id = session_id.ok_or("Missing session")?;
                let state = audio.inner().clone();
                let playing = action == "media.play";
                tauri::async_runtime::spawn_blocking(move || {
                    windows_audio::control(&state, &id, playing)
                })
                .await
                .map_err(|_| "Playback unavailable")??;
                Ok(audio.snapshot())
            }
            #[cfg(not(windows))]
            {
                Err("Windows media controls unavailable".into())
            }
        }
        _ => Err("Unsupported action".into()),
    }
}

#[cfg(windows)]
mod windows_audio {
    use super::*;
    use crate::{
        beat::{Detector, N},
        tempo::Tempo,
    };
    use std::{collections::VecDeque, time::Instant};
    use wasapi::{DeviceEnumerator, Direction, SampleType, StreamMode, WaveFormat};
    use windows::Media::Control::{
        GlobalSystemMediaTransportControlsSession as MediaSession,
        GlobalSystemMediaTransportControlsSessionManager as MediaManager,
        GlobalSystemMediaTransportControlsSessionPlaybackStatus as Playback,
    };

    // These objects are only used on MTA worker threads, never the UI thread.
    type Sessions = Vec<(String, MediaSession)>;
    static MEDIA: std::sync::OnceLock<Mutex<Sessions>> = std::sync::OnceLock::new();
    struct Apartment;
    impl Apartment {
        fn init() -> Result<Self, String> {
            wasapi::initialize_mta().ok().map_err(|e| e.to_string())?;
            Ok(Self)
        }
    }
    impl Drop for Apartment {
        fn drop(&mut self) {
            wasapi::deinitialize();
        }
    }
    pub fn control(state: &NativeAudio, id: &str, playing: bool) -> Result<(), String> {
        let _apartment = Apartment::init()?;
        let session = MEDIA
            .get()
            .and_then(|m| {
                m.lock()
                    .ok()?
                    .iter()
                    .find(|(key, _)| key == id)
                    .map(|(_, s)| s.clone())
            })
            .ok_or("Playback unavailable")?;
        let result = if playing {
            session.TryPlayAsync()
        } else {
            session.TryPauseAsync()
        };
        if !result.and_then(|op| op.join()).map_err(|e| e.to_string())? {
            return Err("Playback unsupported".into());
        }
        // The next metadata update confirms the actual state; no optimistic beat.
        state.feed.lock().unwrap().audible_at = 0;
        Ok(())
    }
    pub fn metadata(state: NativeAudio) {
        let Ok(_apartment) = Apartment::init() else {
            return;
        };
        let mut manager = None;
        let registry = MEDIA.get_or_init(|| Mutex::new(vec![]));
        loop {
            if manager.is_none() {
                manager = MediaManager::RequestAsync().and_then(|op| op.join()).ok();
            }
            let mut items = vec![];
            let mut tracked = vec![];
            if let Some(view) = manager.as_ref().and_then(|m| m.GetSessions().ok()) {
                let previous = registry.lock().unwrap().clone();
                for index in 0..view.Size().unwrap_or(0) {
                    let Ok(session) = view.GetAt(index) else {
                        continue;
                    };
                    let id = previous
                        .iter()
                        .find(|(_, old)| *old == session)
                        .map(|(id, _)| id.clone())
                        .unwrap_or_else(|| format!("native:{}", Uuid::new_v4()));
                    let Ok(properties) = session
                        .TryGetMediaPropertiesAsync()
                        .and_then(|op| op.join())
                    else {
                        continue;
                    };
                    let title = properties.Title().unwrap_or_default().to_string_lossy();
                    if title.is_empty() {
                        continue;
                    }
                    let playing = session
                        .GetPlaybackInfo()
                        .and_then(|p| p.PlaybackStatus())
                        .is_ok_and(|p| p == Playback::Playing);
                    let position = session
                        .GetTimelineProperties()
                        .and_then(|t| t.Position())
                        .map_or(0., |p| (p.Duration as f64 / 10_000_000.).max(0.));
                    items.push(json!({"id":id,"title":title.chars().take(1000).collect::<String>(),
                        "artist":properties.Artist().unwrap_or_default().to_string_lossy().chars().take(1000).collect::<String>(),
                        "source":session.SourceAppUserModelId().unwrap_or_default().to_string_lossy().chars().take(1000).collect::<String>(),
                        "paused":!playing,"playing":playing,"currentTime":position,"playbackRate":1,"sampledAt":now(),"canControl":true}));
                    tracked.push((id, session));
                }
            } else {
                manager = None;
            }
            *registry.lock().unwrap() = tracked;
            let mut feed = state.feed.lock().unwrap();
            // Local players without SMTC still get honest system-audio beats,
            // but no invented track metadata or fake play/pause controls.
            if items.iter().all(|s| s["playing"] != true)
                && state.enabled.load(Ordering::Relaxed)
                && now().saturating_sub(feed.audible_at) < 1000
            {
                items.push(json!({"id":"native:system","title":"System audio","artist":"","source":"Windows","paused":false,"playing":true,"currentTime":0,"playbackRate":1,"sampledAt":now(),"canControl":false}));
            }
            if let Some(sub) = &feed.subscription {
                let old = feed.sessions.iter().find(|s| s["id"] == sub.session);
                let new = items.iter().find(|s| s["id"] == sub.session);
                if old.map(|s| (&s["title"], &s["artist"], &s["playing"]))
                    != new.map(|s| (&s["title"], &s["artist"], &s["playing"]))
                {
                    if let Some(sub) = feed.subscription.as_mut() {
                        sub.capture = Uuid::new_v4().to_string();
                        sub.sequence = 0;
                    }
                    feed.audible_at = 0;
                }
            }
            feed.sessions = items;
            if let Some(sub) = &feed.subscription {
                let session = feed.sessions.iter().find(|s| s["id"] == sub.session);
                let playing = session.is_some_and(|s| s["playing"] == true);
                let mut status = state.status(&feed, playing);
                status["kind"] = json!("sync.state");
                state.publish(sub, status);
                if let Some(s) = session {
                    state.publish(sub, json!({"kind":"clock","clock":{"playing":playing,"paused":!playing,"currentTime":s["currentTime"],"playbackRate":1,"sampledAt":now()}}));
                }
            }
            drop(feed);
            thread::sleep(Duration::from_millis(500));
        }
    }
    pub fn capture(state: NativeAudio) {
        let Ok(_apartment) = Apartment::init() else {
            return;
        };
        loop {
            if !state.enabled.load(Ordering::Relaxed) {
                thread::sleep(Duration::from_millis(100));
                continue;
            }
            if capture_device(&state).is_err() {
                let mut feed = state.feed.lock().unwrap();
                feed.audible_at = 0;
                feed.reason = "device-unavailable".into();
                if let Some(sub) = feed.subscription.as_mut() {
                    sub.capture = Uuid::new_v4().to_string();
                }
            }
            thread::sleep(Duration::from_millis(500));
        }
    }
    fn capture_device(state: &NativeAudio) -> Result<(), Box<dyn std::error::Error>> {
        let enumerator = DeviceEnumerator::new()?;
        // Render endpoint + Capture direction sets AUDCLNT_STREAMFLAGS_LOOPBACK;
        // this never opens a microphone or writes PCM to disk.
        let device = enumerator.get_default_device(&Direction::Render)?;
        let device_id = device.get_id()?;
        let mut client = device.get_iaudioclient()?;
        let format = WaveFormat::new(32, 32, &SampleType::Float, 48000, 2, None);
        let (_, minimum) = client.get_device_period()?;
        client.initialize_client(
            &format,
            &Direction::Capture,
            &StreamMode::EventsShared {
                autoconvert: true,
                buffer_duration_hns: minimum,
            },
        )?;
        let event = client.set_get_eventhandle()?;
        let reader = client.get_audiocaptureclient()?;
        client.start_stream()?;
        let mut bytes = VecDeque::with_capacity(32768);
        let mut mono = VecDeque::with_capacity(N * 4);
        let mut detector = Detector::new(48000.);
        let mut tempo = Tempo::default();
        let mut capture_id = String::new();
        let origin = Instant::now();
        let mut checked_device = Instant::now();
        let mut last_state = 0.;
        let mut last_audible = 0.;
        loop {
            if !state.enabled.load(Ordering::Relaxed) {
                break;
            }
            if checked_device.elapsed().as_secs() >= 1 {
                checked_device = Instant::now();
                if enumerator
                    .get_default_device(&Direction::Render)?
                    .get_id()?
                    != device_id
                {
                    break;
                }
            }
            reader.read_from_device_to_deque(&mut bytes)?;
            while bytes.len() >= 8 {
                let mut frame = [0u8; 8];
                for b in &mut frame {
                    *b = bytes.pop_front().unwrap();
                }
                mono.push_back(
                    (f32::from_le_bytes(frame[..4].try_into().unwrap())
                        + f32::from_le_bytes(frame[4..].try_into().unwrap()))
                        * 0.5,
                );
            }
            // Drop stale PCM after suspension instead of replaying queued hits.
            if mono.len() > N + 4800 {
                mono.drain(..mono.len() - N);
            }
            while mono.len() >= N {
                // Timestamp the audio frame, not each iteration of a batch.
                let time = (origin.elapsed().as_secs_f64() * 1000. - (mono.len() - N) as f64 / 48.)
                    .max(0.);
                let mut feed = state.feed.lock().unwrap();
                let id = feed
                    .subscription
                    .as_ref()
                    .map(|s| s.capture.clone())
                    .unwrap_or_default();
                if id != capture_id {
                    capture_id = id;
                    detector = Detector::new(48000.);
                    tempo = Tempo::default();
                    last_audible = time;
                }
                let analysis = detector.analyze(mono.make_contiguous(), time);
                if analysis.audible {
                    feed.audible_at = now();
                    feed.reason.clear();
                    last_audible = time;
                }
                let playing = feed.subscription.as_ref().is_some_and(|sub| {
                    feed.sessions
                        .iter()
                        .any(|s| s["id"] == sub.session && s["playing"] == true)
                });
                let live = playing && analysis.audible;
                let (updated, tick) = if playing {
                    tempo.analyze(analysis.envelope, time)
                } else {
                    (false, None)
                };
                if time - last_state > 100. {
                    if let Some(sub) = &feed.subscription {
                        let mut status = state.status(&feed, playing);
                        status["kind"] = json!("sync.state");
                        state.publish(sub, status);
                    }
                    last_state = time;
                }
                if live {
                    if let Some(sub) = feed.subscription.as_mut() {
                        if !analysis.hits.is_empty() {
                            sub.sequence += 1;
                            state.publish(sub, json!({"kind":"onset","bands":analysis.hits,"captureId":sub.capture,"sequence":sub.sequence}));
                        }
                        if updated {
                            state.publish(sub, json!({"kind":"tempo.state","captureId":sub.capture,"tempo":{"locked":tempo.locked,"bpm":tempo.bpm,"confidence":tempo.confidence}}));
                        }
                        if let Some(tick) = tick {
                            state.publish(
                                sub,
                                json!({"kind":"tempo.tick","captureId":sub.capture,"tick":tick}),
                            );
                        }
                    }
                } else if !playing || time - last_audible > 300. {
                    tempo = Tempo::default();
                }
                drop(feed);
                mono.drain(..800.min(mono.len()));
            }
            let _ = event.wait_for_event(50); // A silent endpoint may not signal.
        }
        client.stop_stream()?;
        let mut feed = state.feed.lock().unwrap();
        feed.audible_at = 0;
        if let Some(sub) = feed.subscription.as_mut() {
            sub.capture = Uuid::new_v4().to_string();
        }
        Ok(())
    }
}
