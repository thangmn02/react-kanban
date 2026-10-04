use std::sync::{Arc, Mutex};
use tauri::WebviewWindow;

#[derive(Default)]
pub struct WindowShape(Arc<Mutex<Option<(bool, u32, u32, bool)>>>);

pub fn initialize(window: &WebviewWindow) -> Result<(), String> {
    #[cfg(windows)]
    frameless::attach(window.hwnd().map_err(|e| e.to_string())?.0 as _)?;
    #[cfg(not(windows))]
    let _ = window;
    Ok(())
}

#[cfg(windows)]
mod frameless {
    use windows_sys::Win32::{Foundation::{HWND, LPARAM, LRESULT, WPARAM},
        UI::{Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass},
            WindowsAndMessaging::{WM_NCACTIVATE, WM_NCDESTROY, WM_NCPAINT}}};

    const FRAME_SUBCLASS: usize = 0x4b4f5241;

    fn paint_result(message: u32) -> Option<LRESULT> {
        match message {
            WM_NCPAINT => Some(0),
            WM_NCACTIVATE => Some(1),
            _ => None,
        }
    }

    unsafe extern "system" fn window_proc(hwnd: HWND, message: u32, wparam: WPARAM,
        lparam: LPARAM, id: usize, _: usize) -> LRESULT {
        // The webview paints the entire frameless surface. DefWindowProc's
        // non-client painting otherwise leaks a caption and border through it.
        if let Some(result) = paint_result(message) { return result; }
        if message == WM_NCDESTROY {
            RemoveWindowSubclass(hwnd, Some(window_proc), id);
        }
        // Preserve Tauri's resize hit testing, activation, DPI and close handling.
        DefSubclassProc(hwnd, message, wparam, lparam)
    }

    pub fn attach(hwnd: HWND) -> Result<(), String> {
        // SetWindowSubclass must run on the thread that owns the window.
        if unsafe { SetWindowSubclass(hwnd, Some(window_proc), FRAME_SUBCLASS, 0) } == 0 {
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

fn geometry(width: u32, height: u32, scale: f64) -> Result<(i32, i32, i32), String> {
    let width = i32::try_from(width).map_err(|_| "Window width is too large")?;
    let height = i32::try_from(height).map_err(|_| "Window height is too large")?;
    // Match the 22 logical-pixel CSS radius at every display scale.
    let diameter = (44.0 * scale).round().clamp(1.0, width.min(height).max(1) as f64) as i32;
    Ok((width, height, diameter))
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

fn apply_shape(window: WebviewWindow, state: Arc<Mutex<Option<(bool, u32, u32, bool)>>>, rounded: bool) -> Result<u32, String> {
    if window.label() != "main" { return Err("Unknown window".into()); }
    #[cfg(windows)]
    frameless::attach(window.hwnd().map_err(|e| e.to_string())?.0 as _)?;
    let size = window.outer_size().map_err(|e| e.to_string())?;
    if size.width == 0 || size.height == 0 { return Ok(8); }
    #[cfg(not(windows))]
    let compositor_corners = false;
    #[cfg(windows)]
    let compositor_corners = {
        use windows_sys::Win32::Graphics::Dwm::{DwmSetWindowAttribute,
            DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_ROUND, DWMWCP_DONOTROUND};
        let preference = if rounded { DWMWCP_ROUND } else { DWMWCP_DONOTROUND };
        // DWM clips both the webview and Acrylic. A GDI cut-out instead leaves
        // opaque corner blocks in the compositor's rectangular backdrop.
        (unsafe { DwmSetWindowAttribute(window.hwnd().map_err(|e| e.to_string())?.0 as _,
            DWMWA_WINDOW_CORNER_PREFERENCE as _, &preference as *const _ as _, std::mem::size_of_val(&preference) as _) }) >= 0
    };
    let radius = if compositor_corners { 8 } else { 22 };
    let mut previous = state.lock().map_err(|_| "Window shape unavailable")?;
    let key = (rounded, size.width, size.height, compositor_corners);
    if *previous == Some(key) { return Ok(radius); }
    #[cfg(windows)]
    {
        use windows_sys::Win32::Graphics::Gdi::{CreateRoundRectRgn, DeleteObject, SetWindowRgn};
        let hwnd = window.hwnd().map_err(|e| e.to_string())?.0;
        // Windows owns HRGN only on successful SetWindowRgn; delete failed allocations.
        unsafe {
            let region = if rounded && !compositor_corners {
                let (width, height, diameter) = geometry(size.width, size.height, window.scale_factor().map_err(|e| e.to_string())?)?;
                CreateRoundRectRgn(0, 0, width, height, diameter, diameter)
            } else { std::ptr::null_mut() };
            if rounded && !compositor_corners && region.is_null() { return Err("Could not round window".into()); }
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
    use super::geometry;
    #[test]
    fn corners_follow_display_scale_without_changing_window_bounds() {
        assert_eq!(geometry(520, 460, 1.0).unwrap(), (520, 460, 44));
        assert_eq!(geometry(780, 690, 1.5).unwrap(), (780, 690, 66));
        assert_eq!(geometry(1040, 920, 2.0).unwrap(), (1040, 920, 88));
        assert!(geometry(u32::MAX, 460, 1.0).is_err());
    }
}
