//! Remembers where the main window sits in each mode (compact Dock, full Tasks), per monitor layout.
//! Both modes share one window, so every mode switch saves the bounds it leaves and restores the bounds it enters.
use std::{collections::BTreeMap, path::PathBuf, sync::{atomic::{AtomicU64, Ordering}, Arc, Mutex}, time::Duration};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, WebviewWindow, WindowEvent};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Mode {
    Dock,
    Tasks,
    /// Loading and sign-in, before either surface exists. Sized like Tasks, never remembered.
    Setup,
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct Rect { x: i32, y: i32, width: i32, height: i32 }

/// Physical pixels, as Windows reports them, with the scale they were measured at.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
struct Saved { #[serde(flatten)] rect: Rect, scale: f64, #[serde(default)] maximized: bool }

#[derive(Clone, Debug)]
struct Display { name: String, bounds: Rect, work: Rect, scale: f64 }

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
struct Layout { dock: Option<Saved>, tasks: Option<Saved>, #[serde(default)] used: u64 }

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
struct Store { #[serde(default)] clock: u64, #[serde(default)] layouts: BTreeMap<String, Layout> }

#[derive(Clone, Copy, Debug, PartialEq)]
struct Target { rect: Rect, maximized: bool, min: (f64, f64) }

const LAYOUT_LIMIT: usize = 8;
/// Less of a window than this on every display means it cannot be found or dragged back.
const REACHABLE: f64 = 48.0;
const DOCK_MARGIN: f64 = 16.0;
/// A Dock dropped this close to an edge of the work area (or over it) moves to a fixed margin from that edge.
const SNAP_REACH: f64 = 24.0;
const SNAP_MARGIN: f64 = 12.0;
const SAVE_DELAY: Duration = Duration::from_millis(600);

impl Mode {
    fn default_size(self) -> (f64, f64) { match self { Mode::Dock => (520.0, 580.0), Mode::Tasks | Mode::Setup => (1100.0, 780.0) } }
    fn min_size(self) -> (f64, f64) { match self { Mode::Dock => (320.0, 220.0), Mode::Tasks | Mode::Setup => (560.0, 540.0) } }
}

impl Layout {
    fn slot(&mut self, mode: Mode) -> Option<&mut Option<Saved>> {
        match mode { Mode::Dock => Some(&mut self.dock), Mode::Tasks => Some(&mut self.tasks), Mode::Setup => None }
    }
    fn get(&self, mode: Mode) -> Option<Saved> { match mode { Mode::Dock => self.dock, Mode::Tasks => self.tasks, Mode::Setup => None } }
}

impl Store {
    /// The entry for this monitor layout, or the latest one from another layout (which is then clamped or rejected).
    fn find(&self, key: &str, mode: Mode) -> Option<Saved> {
        self.layouts.get(key).and_then(|layout| layout.get(mode)).or_else(|| self.layouts.values()
            .filter(|layout| layout.get(mode).is_some()).max_by_key(|layout| layout.used).and_then(|layout| layout.get(mode)))
    }

    /// A maximised window keeps the bounds it returns to; only its state changes.
    fn record(&mut self, key: &str, mode: Mode, rect: Rect, scale: f64, maximized: bool) {
        if mode == Mode::Setup { return; }
        let previous = self.find(key, mode);
        self.clock += 1;
        let clock = self.clock;
        let layout = self.layouts.entry(key.to_owned()).or_default();
        layout.used = clock;
        let next = match (maximized, previous) {
            (true, Some(previous)) => Saved { maximized: true, ..previous },
            _ => Saved { rect, scale, maximized },
        };
        if let Some(slot) = layout.slot(mode) { *slot = Some(next); }
        while self.layouts.len() > LAYOUT_LIMIT {
            let Some(oldest) = self.layouts.iter().min_by_key(|(_, layout)| layout.used).map(|(key, _)| key.clone()) else { break };
            self.layouts.remove(&oldest);
        }
    }
}

fn layout_key(displays: &[Display]) -> String {
    let mut parts: Vec<_> = displays.iter().map(|display| format!("{}:{},{},{}x{}@{}", display.name, display.bounds.x, display.bounds.y,
        display.bounds.width, display.bounds.height, display.scale)).collect();
    parts.sort();
    parts.join("|")
}

fn overlap(a: Rect, b: Rect) -> (i64, i64) {
    let span = |a: i32, a_length: i32, b: i32, b_length: i32| ((a as i64 + a_length as i64).min(b as i64 + b_length as i64) - a.max(b) as i64).max(0);
    (span(a.x, a.width, b.x, b.width), span(a.y, a.height, b.y, b.height))
}

fn best_display(displays: &[Display], rect: Rect) -> Option<&Display> {
    displays.iter().max_by_key(|display| { let (width, height) = overlap(rect, display.work); width * height })
        .filter(|display| { let (width, height) = overlap(rect, display.work); width > 0 && height > 0 })
}

fn scaled(length: f64, scale: f64) -> i32 { (length * scale).round() as i32 }

fn fit(display: &Display, rect: Rect, mode: Mode) -> Rect {
    let (min_width, min_height) = mode.min_size();
    let size = |length: i32, min: f64, available: i32| length.max(scaled(min, display.scale)).min(available);
    let width = size(rect.width, min_width, display.work.width);
    let height = size(rect.height, min_height, display.work.height);
    Rect { x: rect.x.clamp(display.work.x, display.work.x + display.work.width - width),
        y: rect.y.clamp(display.work.y, display.work.y + display.work.height - height), width, height }
}

fn default_rect(display: &Display, mode: Mode) -> Rect {
    let (width, height) = mode.default_size();
    let (width, height) = (scaled(width, display.scale).min(display.work.width), scaled(height, display.scale).min(display.work.height));
    let work = display.work;
    let rect = match mode {
        Mode::Tasks | Mode::Setup => Rect { x: work.x + (work.width - width) / 2, y: work.y + (work.height - height) / 2, width, height },
        Mode::Dock => { let margin = scaled(DOCK_MARGIN, display.scale);
            Rect { x: work.x + work.width - width - margin, y: work.y + margin, width, height } }
    };
    fit(display, rect, mode)
}

/// Where the window goes when it enters `mode`. `current` is where it is now and picks the display for a first placement.
fn plan(displays: &[Display], saved: Option<Saved>, current: Rect, mode: Mode) -> Option<Target> {
    let restored = saved.filter(|saved| saved.scale.is_finite() && saved.scale > 0.0).and_then(|saved| {
        let display = best_display(displays, saved.rect)?;
        let (width, height) = overlap(saved.rect, display.work);
        let reachable = (REACHABLE * display.scale) as i64;
        if width < reachable || height < reachable { return None; }
        let ratio = display.scale / saved.scale;
        let rect = Rect { width: scaled(saved.rect.width as f64, ratio), height: scaled(saved.rect.height as f64, ratio), ..saved.rect };
        // The Dock floats over other apps and is never restored at full-screen size.
        Some((display, fit(display, rect, mode), saved.maximized && mode == Mode::Tasks))
    });
    let (display, rect, maximized) = match restored {
        Some(restored) => restored,
        None => { let display = best_display(displays, current).or(displays.first())?; (display, default_rect(display, mode), false) }
    };
    // A display smaller than the normal minimum must not push the window outside its work area.
    let (min_width, min_height) = mode.min_size();
    let min = (min_width.min(display.work.width as f64 / display.scale), min_height.min(display.work.height as f64 / display.scale));
    Some(Target { rect, maximized, min })
}

/// Where a dropped Dock rests: pulled to a 12 px margin from any edge it is near, otherwise left where it was dropped.
fn snap(displays: &[Display], rect: Rect) -> Option<Rect> {
    let display = best_display(displays, rect)?;
    let (work, reach, margin) = (display.work, scaled(SNAP_REACH, display.scale), scaled(SNAP_MARGIN, display.scale));
    let axis = |start: i32, length: i32, low: i32, span: i32| {
        if length + 2 * margin > span { start }
        else if start <= low + reach { low + margin }
        else if start + length >= low + span - reach { low + span - length - margin }
        else { start }
    };
    let next = Rect { x: axis(rect.x, rect.width, work.x, work.width), y: axis(rect.y, rect.height, work.y, work.height), ..rect };
    (next != rect).then_some(next)
}

/// Called when the person lets go of the Dock after moving it.
#[cfg(windows)]
pub fn snap_dock(window: &WebviewWindow) {
    let dock = window.state::<WindowBounds>().inner.lock().map(|inner| inner.mode == Some(Mode::Dock)).unwrap_or(false);
    if !dock || window.is_maximized().unwrap_or(true) || window.is_minimized().unwrap_or(true) { return; }
    let (Ok(displays), Ok(rect)) = (displays(window), current_rect(window)) else { return };
    if let Some(target) = snap(&displays, rect) { let _ = place(window, target); }
}

#[derive(Default)]
struct Inner { store: Option<Store>, mode: Option<Mode> }
#[derive(Default, Clone)]
pub struct WindowBounds { inner: Arc<Mutex<Inner>>, changes: Arc<AtomicU64> }

fn path(app: &AppHandle) -> Option<PathBuf> { Some(app.path().app_local_data_dir().ok()?.join("window-bounds.json")) }

/// Unreadable or damaged bounds only cost the remembered position.
fn parse(bytes: &[u8]) -> Store { serde_json::from_slice(bytes).unwrap_or_default() }

fn ensure_loaded<'a>(app: &AppHandle, inner: &'a mut Inner) -> &'a mut Store {
    inner.store.get_or_insert_with(|| path(app).and_then(|path| std::fs::read(path).ok()).map(|bytes| parse(&bytes)).unwrap_or_default())
}

fn write(app: &AppHandle, store: &Store) {
    let Some(path) = path(app) else { return };
    let Ok(bytes) = serde_json::to_vec(store) else { return };
    if let Some(directory) = path.parent() { let _ = std::fs::create_dir_all(directory); }
    let temporary = path.with_extension("json.tmp");
    if std::fs::write(&temporary, bytes).is_ok() { let _ = std::fs::rename(&temporary, &path); }
}

fn displays(window: &WebviewWindow) -> Result<Vec<Display>, String> {
    Ok(window.available_monitors().map_err(|e| e.to_string())?.iter().map(|monitor| {
        let (position, size, work) = (monitor.position(), monitor.size(), monitor.work_area());
        Display { name: monitor.name().cloned().unwrap_or_default(), scale: monitor.scale_factor(),
            bounds: Rect { x: position.x, y: position.y, width: size.width as i32, height: size.height as i32 },
            work: Rect { x: work.position.x, y: work.position.y, width: work.size.width as i32, height: work.size.height as i32 } }
    }).collect())
}

fn current_rect(window: &WebviewWindow) -> Result<Rect, String> {
    let position = window.outer_position().map_err(|e| e.to_string())?;
    let size = window.outer_size().map_err(|e| e.to_string())?;
    Ok(Rect { x: position.x, y: position.y, width: size.width as i32, height: size.height as i32 })
}

/// Records where the current mode sits. Runs on the main thread, so it can never see a half-applied switch.
fn capture(window: &WebviewWindow, state: &WindowBounds) -> Result<(), String> {
    if window.is_minimized().map_err(|e| e.to_string())? { return Ok(()); }
    let key = layout_key(&displays(window)?);
    let rect = current_rect(window)?;
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let maximized = window.is_maximized().map_err(|e| e.to_string())?;
    let mut inner = state.inner.lock().map_err(|_| "Window bounds unavailable")?;
    let Some(mode) = inner.mode else { return Ok(()) };
    let app = window.app_handle();
    let store = ensure_loaded(app, &mut inner);
    store.record(&key, mode, rect, scale, maximized);
    write(app, store);
    Ok(())
}

#[cfg(windows)]
fn place(window: &WebviewWindow, rect: Rect) -> Result<(), String> {
    use windows_sys::Win32::UI::WindowsAndMessaging::{SetWindowPos, SWP_NOACTIVATE, SWP_NOZORDER};
    let hwnd = window.hwnd().map_err(|e| e.to_string())?.0;
    // Position and size change together. Crossing to a display with another scale makes Windows resize the window
    // once more on the way, so the second call settles the exact size.
    for _ in 0..2 {
        if unsafe { SetWindowPos(hwnd as _, std::ptr::null_mut(), rect.x, rect.y, rect.width, rect.height, SWP_NOZORDER | SWP_NOACTIVATE) } == 0 {
            return Err("Could not move window".into());
        }
        if current_rect(window)? == rect { break; }
    }
    Ok(())
}

#[cfg(not(windows))]
fn place(window: &WebviewWindow, rect: Rect) -> Result<(), String> {
    window.set_size(tauri::PhysicalSize::new(rect.width as u32, rect.height as u32)).map_err(|e| e.to_string())?;
    window.set_position(tauri::PhysicalPosition::new(rect.x, rect.y)).map_err(|e| e.to_string())
}

fn switch(window: &WebviewWindow, state: &WindowBounds, mode: Mode) -> Result<(), String> {
    // A reload or remount of the same surface must not move a window the person has placed.
    let previous = state.inner.lock().map_err(|_| "Window bounds unavailable")?.mode;
    // Signing out or an unknown page inside Tasks likewise leaves the window where it is.
    if previous == Some(mode) || (previous == Some(Mode::Tasks) && mode == Mode::Setup) { return Ok(()); }
    if window.is_minimized().map_err(|e| e.to_string())? { window.unminimize().map_err(|e| e.to_string())?; }
    capture(window, state)?;
    let displays = displays(window)?;
    let current = current_rect(window)?;
    let saved = { let mut inner = state.inner.lock().map_err(|_| "Window bounds unavailable")?;
        ensure_loaded(window.app_handle(), &mut inner).find(&layout_key(&displays), mode) };
    let target = plan(&displays, saved, current, mode).ok_or("No display is available")?;
    if window.is_maximized().map_err(|e| e.to_string())? { window.unmaximize().map_err(|e| e.to_string())?; }
    window.set_min_size(Some(tauri::LogicalSize::new(target.min.0, target.min.1))).map_err(|e| e.to_string())?;
    place(window, target.rect)?;
    if target.maximized { window.maximize().map_err(|e| e.to_string())?; }
    state.inner.lock().map_err(|_| "Window bounds unavailable")?.mode = Some(mode);
    Ok(())
}

#[tauri::command]
pub async fn native_window_mode(window: WebviewWindow, state: tauri::State<'_, WindowBounds>, mode: Mode) -> Result<(), String> {
    if window.label() != "main" { return Err("Unknown window".into()); }
    let state = state.inner().clone();
    let native_window = window.clone();
    let (send, receive) = tokio::sync::oneshot::channel();
    window.run_on_main_thread(move || { let _ = send.send(switch(&native_window, &state, mode)); }).map_err(|e| e.to_string())?;
    receive.await.map_err(|_| "Window mode update interrupted")?
}

/// Saves the bounds shortly after the person stops moving or resizing the window, and when it is closed.
pub fn watch(window: &WebviewWindow, state: WindowBounds) {
    let native_window = window.clone();
    window.on_window_event(move |event| match event {
        WindowEvent::Moved(_) | WindowEvent::Resized(_) => {
            let change = state.changes.fetch_add(1, Ordering::Relaxed) + 1;
            let (state, window) = (state.clone(), native_window.clone());
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(SAVE_DELAY).await;
                if state.changes.load(Ordering::Relaxed) != change { return; }
                let target = window.clone();
                let _ = window.run_on_main_thread(move || { let _ = capture(&target, &state); });
            });
        }
        WindowEvent::CloseRequested { .. } => { let _ = capture(&native_window, &state); }
        _ => {}
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    fn rect(x: i32, y: i32, width: i32, height: i32) -> Rect { Rect { x, y, width, height } }
    fn display(name: &str, bounds: Rect, scale: f64) -> Display {
        // A 48 px taskbar at the bottom.
        Display { name: name.into(), bounds, work: Rect { height: bounds.height - scaled(48.0, scale), ..bounds }, scale }
    }
    fn one() -> Vec<Display> { vec![display("A", rect(0, 0, 1920, 1080), 1.0)] }
    fn two() -> Vec<Display> { let mut all = one(); all.push(display("B", rect(1920, 0, 2560, 1440), 1.5)); all }
    fn saved(rect: Rect, scale: f64) -> Option<Saved> { Some(Saved { rect, scale, maximized: false }) }
    const CORNER_DOCK: Rect = Rect { x: 1384, y: 16, width: 520, height: 580 };

    #[test]
    fn first_tasks_is_centred_on_the_display_that_holds_the_dock() {
        assert_eq!(plan(&one(), None, CORNER_DOCK, Mode::Tasks).unwrap().rect, rect(410, 126, 1100, 780));
        let target = plan(&two(), None, rect(3600, 20, 780, 870), Mode::Tasks).unwrap();
        assert_eq!(target.rect, rect(1920 + (2560 - 1650) / 2, (1440 - 72 - 1170) / 2, 1650, 1170));
    }
    #[test]
    fn first_dock_is_top_right_with_a_margin_on_the_same_display() {
        assert_eq!(plan(&one(), None, rect(410, 126, 1100, 780), Mode::Dock).unwrap().rect, CORNER_DOCK);
        let target = plan(&two(), None, rect(2200, 100, 1650, 1170), Mode::Dock).unwrap();
        assert_eq!(target.rect, rect(1920 + 2560 - 780 - 24, 24, 780, 870));
    }
    #[test]
    fn mode_switches_restore_each_modes_own_bounds() {
        let (displays, mut store) = (one(), Store::default());
        let key = layout_key(&displays);
        store.record(&key, Mode::Dock, rect(40, 300, 420, 400), 1.0, false);
        store.record(&key, Mode::Tasks, rect(200, 60, 1300, 900), 1.0, false);
        assert_eq!(plan(&displays, store.find(&key, Mode::Dock), rect(200, 60, 1300, 900), Mode::Dock).unwrap().rect, rect(40, 300, 420, 400));
        assert_eq!(plan(&displays, store.find(&key, Mode::Tasks), rect(40, 300, 420, 400), Mode::Tasks).unwrap().rect, rect(200, 60, 1300, 900));
    }
    #[test]
    fn off_screen_bounds_fall_back_to_the_first_placement() {
        assert_eq!(plan(&one(), saved(rect(2400, 100, 1100, 780), 1.0), CORNER_DOCK, Mode::Tasks).unwrap().rect, rect(410, 126, 1100, 780));
        // A sliver is not enough to find and drag the window.
        assert_eq!(plan(&one(), saved(rect(1900, 100, 1100, 780), 1.0), CORNER_DOCK, Mode::Tasks).unwrap().rect, rect(410, 126, 1100, 780));
        assert_eq!(plan(&one(), saved(rect(-32000, -32000, 160, 28), 1.0), CORNER_DOCK, Mode::Dock).unwrap().rect, CORNER_DOCK);
    }
    #[test]
    fn partly_visible_or_oversized_bounds_are_clamped_to_the_work_area() {
        assert_eq!(plan(&one(), saved(rect(1500, 700, 1100, 780), 1.0), CORNER_DOCK, Mode::Tasks).unwrap().rect, rect(820, 252, 1100, 780));
        assert_eq!(plan(&one(), saved(rect(-100, -100, 4000, 4000), 1.0), CORNER_DOCK, Mode::Tasks).unwrap().rect, rect(0, 0, 1920, 1032));
        // Never smaller than the mode's minimum.
        assert_eq!(plan(&one(), saved(rect(100, 100, 360, 140), 1.0), CORNER_DOCK, Mode::Dock).unwrap().rect, rect(100, 100, 360, 220));
    }
    #[test]
    fn a_small_display_limits_both_the_window_and_its_minimum() {
        let small = vec![display("S", rect(0, 0, 800, 600), 1.5)];
        let target = plan(&small, None, rect(0, 0, 500, 500), Mode::Tasks).unwrap();
        assert_eq!(target.rect, rect(0, 0, 800, 528));
        assert!(target.min.0 * 1.5 <= 800.0 && target.min.1 * 1.5 <= 528.0);
    }
    #[test]
    fn maximised_tasks_returns_maximised_with_its_normal_bounds_and_the_dock_never_does() {
        let (displays, mut store) = (one(), Store::default());
        let key = layout_key(&displays);
        store.record(&key, Mode::Tasks, rect(200, 60, 1300, 900), 1.0, false);
        store.record(&key, Mode::Tasks, rect(0, 0, 1920, 1032), 1.0, true);
        let target = plan(&displays, store.find(&key, Mode::Tasks), CORNER_DOCK, Mode::Tasks).unwrap();
        assert_eq!((target.rect, target.maximized), (rect(200, 60, 1300, 900), true));
        store.record(&key, Mode::Tasks, rect(300, 80, 1200, 800), 1.0, false);
        assert!(!plan(&displays, store.find(&key, Mode::Tasks), CORNER_DOCK, Mode::Tasks).unwrap().maximized);
        store.record(&key, Mode::Dock, CORNER_DOCK, 1.0, true);
        assert!(!plan(&displays, store.find(&key, Mode::Dock), CORNER_DOCK, Mode::Dock).unwrap().maximized);
    }
    #[test]
    fn each_monitor_layout_keeps_its_own_bounds_and_an_unplugged_one_falls_back() {
        let (both, single, mut store) = (two(), one(), Store::default());
        let (both_key, single_key) = (layout_key(&both), layout_key(&single));
        assert_ne!(both_key, single_key);
        store.record(&both_key, Mode::Tasks, rect(2200, 100, 1650, 1170), 1.5, false);
        // Second display gone and nothing saved for this layout: its bounds are off-screen now.
        assert_eq!(plan(&single, store.find(&single_key, Mode::Tasks), CORNER_DOCK, Mode::Tasks).unwrap().rect, rect(410, 126, 1100, 780));
        store.record(&single_key, Mode::Tasks, rect(50, 50, 1000, 700), 1.0, false);
        assert_eq!(plan(&both, store.find(&both_key, Mode::Tasks), CORNER_DOCK, Mode::Tasks).unwrap().rect, rect(2200, 100, 1650, 1170));
        assert_eq!(plan(&single, store.find(&single_key, Mode::Tasks), CORNER_DOCK, Mode::Tasks).unwrap().rect, rect(50, 50, 1000, 700));
    }
    #[test]
    fn a_scale_change_keeps_the_logical_size() {
        let before = one();
        let after = vec![display("A", rect(0, 0, 1920, 1080), 1.25)];
        let mut store = Store::default();
        store.record(&layout_key(&before), Mode::Dock, rect(100, 100, 400, 400), 1.0, false);
        assert_eq!(plan(&after, store.find(&layout_key(&after), Mode::Dock), CORNER_DOCK, Mode::Dock).unwrap().rect, rect(100, 100, 500, 500));
    }
    #[test]
    fn old_layouts_are_dropped_and_damaged_files_start_empty() {
        let mut store = Store::default();
        for index in 0..20 { store.record(&index.to_string(), Mode::Dock, CORNER_DOCK, 1.0, false); }
        assert_eq!(store.layouts.len(), LAYOUT_LIMIT);
        assert!(store.layouts.contains_key("19") && !store.layouts.contains_key("0"));
        let round_trip = parse(&serde_json::to_vec(&store).unwrap());
        assert_eq!(round_trip.find("19", Mode::Dock), store.find("19", Mode::Dock));
        assert!(parse(b"{not json").layouts.is_empty());
        assert!(plan(&one(), Some(Saved { rect: CORNER_DOCK, scale: 0.0, maximized: false }), CORNER_DOCK, Mode::Dock).is_some());
    }
    #[test]
    fn the_loading_screen_is_never_remembered() {
        let (displays, mut store) = (one(), Store::default());
        let key = layout_key(&displays);
        store.record(&key, Mode::Tasks, rect(0, 0, 1920, 1032), 1.0, true);
        store.record(&key, Mode::Setup, rect(410, 126, 1100, 780), 1.0, false);
        assert!(store.find(&key, Mode::Tasks).unwrap().maximized);
        assert_eq!(plan(&displays, store.find(&key, Mode::Setup), CORNER_DOCK, Mode::Setup).unwrap(), Target { rect: rect(410, 126, 1100, 780), maximized: false, min: (560.0, 540.0) });
    }
    #[test]
    fn a_dropped_dock_snaps_to_a_margin_from_near_edges_only() {
        let dock = |x, y| rect(x, y, 520, 580);
        assert_eq!(snap(&one(), dock(1390, 200)), Some(dock(1388, 200)));
        assert_eq!(snap(&one(), dock(-40, 300)), Some(dock(12, 300)));
        // Corners snap on both axes, and the taskbar is not part of the work area.
        assert_eq!(snap(&one(), dock(1500, 440)), Some(dock(1388, 440)));
        assert_eq!(snap(&one(), dock(1388, 445)), Some(dock(1388, 440)));
        assert_eq!(snap(&one(), dock(600, 200)), None);
        assert_eq!(snap(&one(), dock(12, 12)), None);
        // Margins follow the display's scale, and an inner edge between displays counts as an edge too.
        assert_eq!(snap(&two(), dock(1930, 300)), Some(dock(1938, 300)));
        // Too large to leave a margin: left alone on that axis.
        assert_eq!(snap(&one(), rect(300, 2, 520, 1030)), None);
    }
    #[test]
    fn layout_key_ignores_display_order() {
        let mut reversed = two();
        reversed.reverse();
        assert_eq!(layout_key(&two()), layout_key(&reversed));
    }
}
