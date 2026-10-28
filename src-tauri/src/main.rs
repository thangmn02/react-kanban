#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(test)]
mod beat;
mod browser_music;
mod companion_setup;
mod browser_audio;
#[cfg(windows)]
mod browser_audio_windows;
#[cfg(windows)]
mod browser_process;
mod window_chrome;
mod note_windows;
mod note_journal;
#[cfg(test)]
mod tempo;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                window_chrome::initialize(&window).map_err(std::io::Error::other)?;
                window.show()?;
            }
            app.manage(window_chrome::WindowShape::default());
            app.manage(note_windows::NativeNotes::default());
            note_windows::setup(app.handle())?;
            app.manage(browser_audio::BrowserAudio::default());
            let music = browser_music::BrowserMusic::new(app.handle().clone());
            app.manage(music.clone());
            music.start();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            browser_music::native_music_request,
            companion_setup::native_music_setup,
            browser_audio::native_audio_start,
            browser_audio::native_audio_renew,
            browser_audio::native_audio_stop,
            window_chrome::native_dock_shape,
            note_windows::native_notes_control,
            note_windows::native_note_request
        ])
        .run(tauri::generate_context!())
        .expect("Unable to start Kora");
}
