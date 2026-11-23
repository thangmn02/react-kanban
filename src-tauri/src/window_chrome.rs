use std::sync::{Arc, Mutex};
use tauri::WebviewWindow;

#[derive(Default)]
pub struct WindowShape(Arc<Mutex<Option<(bool, u32, u32, bool)>>>);

pub fn initialize(window: &WebviewWindow) -> Result<(), String> {
    #[cfg(windows)]
    {
        let _ = frameless::WINDOW.set(window.clone());
        frameless::attach(window.hwnd().map_err(|e| e.to_string())?.0 as _, false)?;
    }
    #[cfg(not(windows))]
    let _ = window;
    Ok(())
}

#[cfg(windows)]
mod frameless {
    use windows_sys::Win32::{Foundation::{HWND, LPARAM, LRESULT, WPARAM},
        UI::{Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass},
            WindowsAndMessaging::{WM_NCACTIVATE, WM_NCDESTROY, WM_NCPAINT, WM_EXITSIZEMOVE, WM_ENTERSIZEMOVE, GetWindowRect}}, Foundation::RECT};
    use std::sync::{atomic::{AtomicI64, Ordering}, OnceLock};

    /// The size when a drag began: a drag that also changed the size was a resize or a Windows snap, not a move.
    static DRAG_SIZE: AtomicI64 = AtomicI64::new(0);
    pub static WINDOW: OnceLock<tauri::WebviewWindow> = OnceLock::new();
    fn size_key(hwnd: HWND) -> i64 {
        let mut rect = RECT { left: 0, top: 0, right: 0, bottom: 0 };
        unsafe { GetWindowRect(hwnd, &mut rect); }
        i64::from(rect.right - rect.left) << 32 | i64::from(rect.bottom - rect.top)
    }

    const FRAME_SUBCLASS: usize = 0x4b4f5241;

    fn paint_result(message: u32) -> Option<LRESULT> {
        match message {
            WM_NCPAINT => Some(0),
            WM_NCACTIVATE => Some(1),
            _ => None,
        }
    }

    unsafe extern "system" fn window_proc(hwnd: HWND, message: u32, wparam: WPARAM,
        lparam: LPARAM, id: usize, dock: usize) -> LRESULT {
        // The webview paints the entire frameless surface. DefWindowProc's
        // non-client painting otherwise leaks a caption and border through it.
        if let Some(result) = paint_result(message) { return result; }
        if message == WM_NCDESTROY {
            RemoveWindowSubclass(hwnd, Some(window_proc), id);
        }
        // Preserve Tauri's resize hit testing, activation, DPI and close handling.
        let result = DefSubclassProc(hwnd, message, wparam, lparam);
        if message == WM_ENTERSIZEMOVE { DRAG_SIZE.store(size_key(hwnd), Ordering::Relaxed); }
        if message == WM_EXITSIZEMOVE && dock != 0 {
            if DRAG_SIZE.load(Ordering::Relaxed) == size_key(hwnd) {
                if let Some(window) = WINDOW.get() { crate::window_bounds::snap_dock(window); }
            }
        }
        result
    }

    pub fn attach(hwnd: HWND, dock: bool) -> Result<(), String> {
        // SetWindowSubclass must run on the thread that owns the window.
        if unsafe { SetWindowSubclass(hwnd, Some(window_proc), FRAME_SUBCLASS, dock as usize) } == 0 {
            return Err("Could not disable native frame painting".into());
        }
        Ok(())
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        #[test]
        fn suppresses_only_frame_paint_and_accepts_activation() {
            assert_eq!(paint_result(WM_NCPAINT), Some(0));
            assert_eq!(paint_result(WM_NCACTIVATE), Some(1));
            for message in [WM_NCDESTROY, 0x0084, 0x0005, 0x02e0, 0x0010] {
                assert_eq!(paint_result(message), None);
            }
        }
    }
}

/// The radius Windows 11 clips a rounded window to, and the one Kora cuts itself on older Windows.
/// The page paints with whichever is active (`--native-dock-radius`), so the clip and the card always agree.
const COMPOSITOR_RADIUS: u32 = 8;
const REGION_RADIUS: u32 = 22;

/// Windows never rounds a maximised window, so the page must not either.
fn corner_radius(compositor: bool, maximized: bool) -> u32 {
    if maximized { 0 } else if compositor { COMPOSITOR_RADIUS } else { REGION_RADIUS }
}

fn geometry(width: u32, height: u32, scale: f64) -> Result<(i32, i32, i32), String> {
    let width = i32::try_from(width).map_err(|_| "Window width is too large")?;
    let height = i32::try_from(height).map_err(|_| "Window height is too large")?;
    // Match the CSS radius at every display scale.
    let diameter = (f64::from(REGION_RADIUS * 2) * scale).round().clamp(1.0, width.min(height).max(1) as f64) as i32;
    Ok((width, height, diameter))
}

#[cfg(windows)]
fn backdrop_attributes() -> [(u32, u32); 2] {
    use windows_sys::Win32::Graphics::Dwm::{DWMWA_SYSTEMBACKDROP_TYPE,
        DWMWA_USE_IMMERSIVE_DARK_MODE, DWMSBT_NONE};
    // The page paints solid surfaces, so no system material shows through the Dock or its corners.
    [(DWMWA_USE_IMMERSIVE_DARK_MODE as _, 0),
        (DWMWA_SYSTEMBACKDROP_TYPE as _, DWMSBT_NONE as _)]
}

#[cfg(windows)]
fn border_color(rounded: bool) -> u32 {
    use windows_sys::Win32::Graphics::Dwm::{DWMWA_COLOR_DEFAULT, DWMWA_COLOR_NONE};
    if rounded { DWMWA_COLOR_NONE } else { DWMWA_COLOR_DEFAULT }
}

#[tauri::command]
pub async fn native_dock_shape(window: WebviewWindow, state: tauri::State<'_, WindowShape>, rounded: bool) -> Result<u32, String> {
    let shape = Arc::clone(&state.0);
    let native_window = window.clone();
    let (send, receive) = tokio::sync::oneshot::channel();
    window.run_on_main_thread(move || {
        let _ = send.send(apply_shape(native_window, shape, rounded));
    }).map_err(|e| e.to_string())?;
    receive.await.map_err(|_| "Window shape update interrupted")?
}

/// Keeps the dock above other windows, or releases it for the normal Tasks window.
///
/// The windowing library remembers that it already asked for "always on top" and then ignores a repeated
/// request, so once Windows moves the dock down (another topmost window, a fullscreen app, a display change)
/// asking again through it does nothing. This asks Windows directly, every time.
#[tauri::command]
pub async fn native_pin_dock(window: WebviewWindow, pinned: bool) -> Result<(), String> {
    if window.label() != "main" { return Err("Unknown window".into()); }
    // Keep the library's own record in step, so its later changes start from the truth.
    window.set_always_on_top(pinned).map_err(|e| e.to_string())?;
    #[cfg(windows)]
    {
        let native_window = window.clone();
        let (send, receive) = tokio::sync::oneshot::channel();
        window.run_on_main_thread(move || { let _ = send.send(assert_topmost(&native_window, pinned)); }).map_err(|e| e.to_string())?;
        receive.await.map_err(|_| "Window pin update interrupted")??;
    }
    Ok(())
}

#[cfg(windows)]
fn assert_topmost(window: &WebviewWindow, pinned: bool) -> Result<(), String> {
    use windows_sys::Win32::UI::WindowsAndMessaging::{SetWindowPos, HWND_NOTOPMOST, HWND_TOPMOST};
    let hwnd = window.hwnd().map_err(|e| e.to_string())?.0;
    // Z-order only: the dock is never moved, resized or given focus by pinning.
    if unsafe { SetWindowPos(hwnd as _, if pinned { HWND_TOPMOST } else { HWND_NOTOPMOST }, 0, 0, 0, 0, pin_flags()) } == 0 {
        return Err("Could not update window order".into());
    }
    Ok(())
}

#[cfg(windows)]
fn pin_flags() -> u32 {
    use windows_sys::Win32::UI::WindowsAndMessaging::{SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE};
    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE
}

fn apply_shape(window: WebviewWindow, state: Arc<Mutex<Option<(bool, u32, u32, bool)>>>, rounded: bool) -> Result<u32, String> {
    if window.label() != "main" { return Err("Unknown window".into()); }
    #[cfg(windows)]
    frameless::attach(window.hwnd().map_err(|e| e.to_string())?.0 as _, rounded)?;
    let size = window.outer_size().map_err(|e| e.to_string())?;
    if size.width == 0 || size.height == 0 { return Ok(COMPOSITOR_RADIUS); }
    #[cfg(not(windows))]
    let compositor_corners = false;
    #[cfg(windows)]
    let compositor_corners = {
        use windows_sys::Win32::Graphics::Dwm::{DwmSetWindowAttribute,
            DWMWA_BORDER_COLOR, DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_ROUND};
        // Dock and Tasks are both rounded; `rounded` only tells the Dock from the Tasks window.
        let preference = DWMWCP_ROUND;
        let hwnd = window.hwnd().map_err(|e| e.to_string())?.0;
        for (attribute, value) in backdrop_attributes() {
            unsafe { DwmSetWindowAttribute(hwnd as _, attribute,
                &value as *const _ as _, std::mem::size_of_val(&value) as _); }
        }
        // The card paints its own hairline. The system border would add a second, darker ring outside the Dock's corners.
        let border = border_color(rounded);
        unsafe { DwmSetWindowAttribute(hwnd as _, DWMWA_BORDER_COLOR as _, &border as *const _ as _, std::mem::size_of_val(&border) as _); }
        // DWM clips the webview smoothly; the region below is the fallback for older Windows.
        (unsafe { DwmSetWindowAttribute(window.hwnd().map_err(|e| e.to_string())?.0 as _,
            DWMWA_WINDOW_CORNER_PREFERENCE as _, &preference as *const _ as _, std::mem::size_of_val(&preference) as _) }) >= 0
    };
    let maximized = window.is_maximized().map_err(|e| e.to_string())?;
    let radius = corner_radius(compositor_corners, maximized);
    let mut previous = state.lock().map_err(|_| "Window shape unavailable")?;
    let cut = !compositor_corners && !maximized;
    #[cfg(not(windows))]
    let _ = cut;
    let key = (rounded, size.width, size.height, compositor_corners);
    if *previous == Some(key) { return Ok(radius); }
    #[cfg(windows)]
    {
        use windows_sys::Win32::Graphics::Gdi::{CreateRoundRectRgn, DeleteObject, SetWindowRgn};
        let hwnd = window.hwnd().map_err(|e| e.to_string())?.0;
        // Windows owns HRGN only on successful SetWindowRgn; delete failed allocations.
        unsafe {
            let region = if cut {
                let (width, height, diameter) = geometry(size.width, size.height, window.scale_factor().map_err(|e| e.to_string())?)?;
                CreateRoundRectRgn(0, 0, width, height, diameter, diameter)
            } else { std::ptr::null_mut() };
            if cut && region.is_null() { return Err("Could not round window".into()); }
            if SetWindowRgn(hwnd as _, region, 1) == 0 {
                if !region.is_null() { DeleteObject(region as _); }
                return Err("Could not update window shape".into());
            }
        }
    }
    *previous = Some(key);
    Ok(radius)
}

#[cfg(test)]
mod tests {
    use super::{corner_radius, geometry};
    #[test]
    fn one_radius_follows_the_active_clip_and_a_maximised_dock_is_square() {
        assert_eq!(corner_radius(true, false), 8);
        assert_eq!(corner_radius(false, false), 22);
        assert_eq!(corner_radius(true, true), 0);
        assert_eq!(corner_radius(false, true), 0);
    }
    #[cfg(windows)]
    #[test]
    fn only_the_dock_drops_the_system_border() {
        assert_eq!(super::border_color(true), 0xFFFF_FFFE);
        assert_eq!(super::border_color(false), 0xFFFF_FFFF);
    }
    #[test]
    fn corners_follow_display_scale_without_changing_window_bounds() {
        assert_eq!(geometry(520, 460, 1.0).unwrap(), (520, 460, 44));
        assert_eq!(geometry(780, 690, 1.5).unwrap(), (780, 690, 66));
        assert_eq!(geometry(1040, 920, 2.0).unwrap(), (1040, 920, 88));
        assert!(geometry(u32::MAX, 460, 1.0).is_err());
    }
    #[cfg(windows)]
    #[test]
    fn pinning_changes_order_only_never_position_size_or_focus() {
        // SWP_NOSIZE 0x1, SWP_NOMOVE 0x2, SWP_NOACTIVATE 0x10
        assert_eq!(super::pin_flags(), 0x13);
    }
    #[cfg(windows)]
    #[test]
    fn no_system_material_is_left_behind_either_surface() {
        assert_eq!(super::backdrop_attributes(), [(20, 0), (38, 1)]);
    }
}
