use std::sync::Mutex;
use tauri::WebviewWindow;

#[derive(Default)]
pub struct WindowShape(Mutex<Option<(bool, i32, i32, i32)>>);

fn geometry(width: u32, height: u32, scale: f64) -> Result<(i32, i32, i32), String> {
    let width = i32::try_from(width).map_err(|_| "Window width is too large")?;
    let height = i32::try_from(height).map_err(|_| "Window height is too large")?;
    // Match the 22 logical-pixel CSS radius at every display scale.
    let diameter = (44.0 * scale).round().clamp(1.0, width.min(height).max(1) as f64) as i32;
    Ok((width, height, diameter))
}

#[tauri::command]
pub fn native_dock_shape(window: WebviewWindow, state: tauri::State<'_, WindowShape>, rounded: bool) -> Result<(), String> {
    if window.label() != "main" { return Err("Unknown window".into()); }
    let size = window.outer_size().map_err(|e| e.to_string())?;
    if size.width == 0 || size.height == 0 { return Ok(()); }
    let (width, height, diameter) = geometry(size.width, size.height, window.scale_factor().map_err(|e| e.to_string())?)?;
    let mut previous = state.0.lock().map_err(|_| "Window shape unavailable")?;
    let key = (rounded, width, height, diameter);
    if *previous == Some(key) { return Ok(()); }
    #[cfg(windows)]
    {
        use windows_sys::Win32::Graphics::Gdi::{CreateRoundRectRgn, DeleteObject, SetWindowRgn};
        let hwnd = window.hwnd().map_err(|e| e.to_string())?.0;
        // Windows owns HRGN only on successful SetWindowRgn; delete failed allocations.
        unsafe {
            let region = if rounded { CreateRoundRectRgn(0, 0, width, height, diameter, diameter) } else { std::ptr::null_mut() };
            if rounded && region.is_null() { return Err("Could not round window".into()); }
            if SetWindowRgn(hwnd as _, region, 1) == 0 {
                if !region.is_null() { DeleteObject(region as _); }
                return Err("Could not update window shape".into());
            }
        }
    }
    *previous = Some(key);
    Ok(())
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
