#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod audio;
mod beat;
mod tempo;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let audio = audio::NativeAudio::new(app.handle().clone());
            app.manage(audio.clone());
            audio.start();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            audio::native_music_request,
            audio::native_audio_enable
        ])
        .run(tauri::generate_context!())
        .expect("Unable to start Kanban Focus");
}
