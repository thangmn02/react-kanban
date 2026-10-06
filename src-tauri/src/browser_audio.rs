//! Local process-only PCM transport to the trusted app. No output or mute changes.
use std::{sync::{Arc, Mutex, atomic::{AtomicBool, AtomicU64, Ordering}}, time::{Instant, Duration}};
use tauri::{State, WebviewWindow, Emitter, ipc::{Channel, InvokeResponseBody}};
use crate::browser_music::BrowserMusic;

#[derive(Clone)]
struct Capture {
    id: String, stopped: Arc<AtomicBool>, lease: Arc<Mutex<Instant>>,
    acknowledged: Arc<AtomicU64>, sent: Arc<AtomicU64>,
}
#[derive(Clone, Default)]
pub struct BrowserAudio(Arc<Mutex<Option<Capture>>>);

impl BrowserAudio {
    fn stop(&self, id: Option<&str>) -> Result<(), String> {
        let mut current = self.0.lock().map_err(|_| "Audio capture unavailable")?;
        if current.as_ref().is_some_and(|capture| id.is_none_or(|id| id == capture.id)) {
            if let Some(capture) = current.take() { capture.stopped.store(true, Ordering::Release); }
        }
        Ok(())
    }
}

#[tauri::command]
pub async fn native_audio_start(window: WebviewWindow, music: State<'_, BrowserMusic>, audio: State<'_, BrowserAudio>,
    session_id: String, capture_id: String, on_audio: Channel<InvokeResponseBody>) -> Result<(), String> {
    if window.label() != "main" || capture_id.is_empty() || capture_id.len() > 100 { return Err("Invalid audio capture".into()); }
    #[cfg(not(windows))]
    { let _ = (music, audio, session_id, on_audio); Err("Automatic browser beats require Windows".into()) }
    #[cfg(windows)]
    {
        let capture = Capture { id: capture_id, stopped: Arc::default(),
            lease: Arc::new(Mutex::new(Instant::now() + Duration::from_secs(5))),
            acknowledged: Arc::default(), sent: Arc::default() };
        {
            let mut current = audio.0.lock().map_err(|_| "Audio capture unavailable")?;
            if let Some(old) = current.replace(capture.clone()) { old.stopped.store(true, Ordering::Release); }
        }
        let port = match music.audio_browser_port(&session_id).await {
            Ok(port) => port,
            Err(error) => { audio.stop(Some(&capture.id))?; return Err(error); }
        };
        if capture.stopped.load(Ordering::Acquire) { return Err("Audio capture was replaced".into()); }
        let (ready, receive) = tokio::sync::oneshot::channel();
        let owned_audio = audio.inner().clone();
        std::thread::spawn(move || {
            let mut ready = Some(ready);
            let result = (|| {
                let _com = crate::browser_audio_windows::ComApartment::new().map_err(|_| "Could not initialize browser audio")?;
                let browser = crate::browser_process::from_companion_port(port)?;
                let input = crate::browser_audio_windows::ProcessCapture::new(browser.id)
                    .map_err(|_| "Process-only capture is unavailable. Windows 10 build 20348 or newer is required.")?;
                if capture.stopped.load(Ordering::Acquire) { return Err("Audio capture was replaced".to_owned()); }
                if let Some(ready) = ready.take() { let _ = ready.send(Ok(())); }
                while !capture.stopped.load(Ordering::Acquire) {
                    if !browser.alive() { return Err("browser-closed".to_owned()); }
                    if Instant::now() > *capture.lease.lock().map_err(|_| "capture-expired")? { return Err("expired".to_owned()); }
                    if capture.sent.load(Ordering::Acquire).saturating_sub(capture.acknowledged.load(Ordering::Acquire)) > 128 {
                        return Err("audio-backlog".to_owned());
                    }
                    while let Some(packet) = input.packet().map_err(|_| "capture-failed")? {
                        if capture.stopped.load(Ordering::Acquire) { break; }
                        if capture.sent.load(Ordering::Acquire).saturating_sub(capture.acknowledged.load(Ordering::Acquire)) >= 128 {
                            return Err("audio-backlog".to_owned());
                        }
                        let sequence = capture.sent.fetch_add(1, Ordering::AcqRel) + 1;
                        let mut bytes = Vec::with_capacity(16 + packet.len() * 4);
                        bytes.extend_from_slice(&sequence.to_le_bytes());
                        bytes.extend_from_slice(&(packet.len() as u32 / 2).to_le_bytes());
                        bytes.extend_from_slice(&crate::browser_audio_windows::SAMPLE_RATE.to_le_bytes());
                        for sample in packet { bytes.extend_from_slice(&sample.to_le_bytes()); }
                        on_audio.send(InvokeResponseBody::Raw(bytes)).map_err(|_| "audio-disconnected")?;
                    }
                    std::thread::sleep(Duration::from_millis(10));
                }
                Ok(())
            })();
            if let Some(ready) = ready.take() { let _ = ready.send(result.clone()); }
            if let Err(reason) = result {
                let _ = window.emit("native-audio-ended", serde_json::json!({"captureId":capture.id,"reason":reason}));
            }
            let _ = owned_audio.stop(Some(&capture.id));
        });
        receive.await.map_err(|_| "Browser audio could not start".to_owned())?
    }
}

#[tauri::command]
pub fn native_audio_renew(window: WebviewWindow, audio: State<'_, BrowserAudio>, capture_id: String, sequence: u64) -> Result<(), String> {
    if window.label() != "main" { return Err("Invalid audio window".into()); }
    let state = audio.0.lock().map_err(|_| "Audio capture unavailable")?;
    let capture = state.as_ref().filter(|capture| capture.id == capture_id && !capture.stopped.load(Ordering::Acquire))
        .ok_or("Audio capture stopped")?;
    if sequence > capture.sent.load(Ordering::Acquire) { return Err("Invalid audio acknowledgement".into()); }
    capture.acknowledged.fetch_max(sequence, Ordering::AcqRel);
    *capture.lease.lock().map_err(|_| "Audio capture unavailable")? = Instant::now() + Duration::from_secs(5);
    Ok(())
}
#[tauri::command]
pub fn native_audio_stop(window: WebviewWindow, audio: State<'_, BrowserAudio>, capture_id: String) -> Result<(), String> {
    if window.label() != "main" { return Err("Invalid audio window".into()); }
    audio.stop(Some(&capture_id))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn old_capture_cleanup_cannot_stop_its_replacement() {
        let audio = BrowserAudio::default();
        let stopped = Arc::new(AtomicBool::new(false));
        *audio.0.lock().unwrap() = Some(Capture { id:"new".into(), stopped:stopped.clone(),
            lease:Arc::new(Mutex::new(Instant::now())), acknowledged:Arc::default(), sent:Arc::default() });
        audio.stop(Some("old")).unwrap();
        assert!(!stopped.load(Ordering::Acquire));
        audio.stop(Some("new")).unwrap();
        assert!(stopped.load(Ordering::Acquire));
        assert!(audio.0.lock().unwrap().is_none());
    }
}
