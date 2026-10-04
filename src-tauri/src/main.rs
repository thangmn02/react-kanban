#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(test)]
mod beat;
mod browser_music;
mod window_chrome;
#[cfg(test)]
mod tempo;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                window_chrome::initialize(&window).map_err(std::io::Error::other)?;
                window.show()?;
            }
            app.manage(window_chrome::WindowShape::default());
            let music = browser_music::BrowserMusic::new(app.handle().clone());
            app.manage(music.clone());
            music.start();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            browser_music::native_music_request,
            browser_music::native_music_setup,
            window_chrome::native_dock_shape
        ])
        .run(tauri::generate_context!())
        .expect("Unable to start Kora");
}
