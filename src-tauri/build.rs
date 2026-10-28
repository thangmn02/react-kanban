fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&[
        "native_music_request", "native_music_setup", "native_audio_start", "native_audio_renew", "native_audio_stop", "native_dock_shape", "native_notes_control", "native_note_request"
    ]))).expect("Unable to generate scoped native command permissions")
}
