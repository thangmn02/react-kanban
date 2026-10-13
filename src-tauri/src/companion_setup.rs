//! Replace only Kora's stable unpacked Companion from its signed app resources.
use crate::browser_music::BrowserMusic;
use serde::Serialize;
use std::{
    fs,
    path::{Component, Path, PathBuf},
};
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;

static UPDATE_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupResult {
    version: String,
    folder: String,
    status: &'static str,
    browsers_ready: usize,
    folder_opened: bool,
}

pub fn version_parts(version: &str) -> Option<[u16; 4]> {
    let parts: Vec<_> = version.split('.').collect();
    if !(1..=4).contains(&parts.len()) {
        return None;
    }
    let mut result = [0; 4];
    for (index, part) in parts.iter().enumerate() {
        if part.is_empty() || !part.bytes().all(|c| c.is_ascii_digit()) {
            return None;
        }
        result[index] = part.parse().ok()?;
    }
    Some(result)
}

fn no_link(path: &Path) -> Result<(), String> {
    let metadata =
        fs::symlink_metadata(path).map_err(|e| format!("Could not read Companion files: {e}"))?;
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if metadata.file_attributes() & 0x400 != 0 {
            return Err("Companion folders cannot contain links or junctions.".into());
        }
    }
    if metadata.file_type().is_symlink() {
        return Err("Companion folders cannot contain links.".into());
    }
    Ok(())
}

fn read_file(root: &Path, relative: &str) -> Result<Vec<u8>, String> {
    let relative_path = Path::new(relative);
    if relative.is_empty()
        || relative.contains('\\')
        || !relative_path
            .components()
            .all(|part| matches!(part, Component::Normal(_)))
    {
        return Err("Invalid Companion package path.".into());
    }
    no_link(root)?;
    let mut path = root.to_path_buf();
    for part in relative_path.components() {
        path.push(part);
        no_link(&path)?;
    }
    if !path.is_file() || fs::metadata(&path).map_err(|e| e.to_string())?.len() > 32 * 1024 * 1024 {
        return Err("Invalid Companion package file.".into());
    }
    fs::read(path).map_err(|e| format!("Could not read Companion package: {e}"))
}

fn manifest_version(bytes: &[u8]) -> Result<String, String> {
    let value: serde_json::Value =
        serde_json::from_slice(bytes).map_err(|_| "Invalid Companion manifest.")?;
    let version = value["version"]
        .as_str()
        .filter(|v| version_parts(v).is_some())
        .ok_or("Invalid Companion version.")?;
    if value["manifest_version"] != 3 || value["name"] != "Kora Music Companion" {
        return Err("Invalid Companion package identity.".into());
    }
    Ok(version.to_owned())
}

#[derive(Debug)]
struct Prepared {
    version: String,
    folder: PathBuf,
}

fn install_bundle(source: &Path, app_data: &Path) -> Result<Prepared, String> {
    fs::create_dir_all(app_data).map_err(|e| format!("Could not prepare Companion folder: {e}"))?;
    no_link(app_data)?;
    no_link(source)?;
    let names: Vec<String> = serde_json::from_slice(&read_file(source, "package-files.json")?)
        .map_err(|_| "Invalid Companion package inventory.")?;
    if names.is_empty() || names.len() > 128 {
        return Err("Invalid Companion package inventory.".into());
    }
    for required in [
        "extension/manifest.json",
        "extension/background.js",
        "extension/percussion-runtime.js",
        "extension/generated/percussion/percussion.onnx",
        "extension/vendor/percussion/ort-wasm-simd-threaded.wasm",
        "Install Music Companion.html",
    ] {
        if !names.iter().any(|name| name == required) {
            return Err("The included Companion is incomplete. Reinstall Kora.".into());
        }
    }
    let mut files = Vec::new();
    let mut bytes = 0;
    for name in &names {
        if files.iter().any(|(existing, _)| existing == name) {
            return Err("Duplicate Companion package path.".into());
        }
        let data = read_file(source, name)?;
        bytes += data.len();
        if bytes > 64 * 1024 * 1024 {
            return Err("Companion package is too large.".into());
        }
        files.push((name.clone(), data));
    }
    let version = manifest_version(
        &files
            .iter()
            .find(|(name, _)| name == "extension/manifest.json")
            .unwrap()
            .1,
    )?;
    let folder = app_data.join("music-companion");
    let existed = fs::symlink_metadata(&folder).is_ok();
    if existed {
        no_link(&folder)?;
        if let Ok(old) = read_file(&folder, "extension/manifest.json") {
            if let Ok(old_version) = manifest_version(&old) {
                if version_parts(&old_version) > version_parts(&version) {
                    return Err(
                        "Your Companion is newer than this Kora build. Update Kora first.".into(),
                    );
                }
            }
        }
        if files
            .iter()
            .all(|(name, data)| read_file(&folder, name).is_ok_and(|old| old == *data))
        {
            return Ok(Prepared { version, folder });
        }
    }
    let suffix = Uuid::new_v4();
    let stage = app_data.join(format!(".music-companion-stage-{suffix}"));
    let backup = app_data.join(format!("music-companion-backup-{suffix}"));
    fs::create_dir(&stage).map_err(|e| format!("Could not stage Companion: {e}"))?;
    let result = (|| {
        for (name, data) in &files {
            let target = stage.join(name);
            fs::create_dir_all(target.parent().unwrap()).map_err(|e| e.to_string())?;
            fs::write(&target, data).map_err(|e| format!("Could not stage Companion: {e}"))?;
            if read_file(&stage, name)? != *data {
                return Err("Companion file verification failed.".into());
            }
        }
        replace_folder(&stage, &folder, &backup)?;
        Ok(Prepared { version, folder })
    })();
    // The unique staging directory belongs only to this operation.
    if stage.exists() {
        let _ = fs::remove_dir_all(&stage);
    }
    result
}

fn replace_folder(stage: &Path, folder: &Path, backup: &Path) -> Result<(), String> {
    let existed = folder.exists();
    if existed {
        fs::rename(folder, backup).map_err(|e| {
            format!("Could not back up Companion. Close its folder and try again: {e}")
        })?;
    }
    if let Err(error) = fs::rename(stage, folder) {
        if existed {
            fs::rename(backup, folder).map_err(|restore| {
                format!(
                    "Update failed ({error}); restore the previous folder from {} ({restore}).",
                    backup.display()
                )
            })?;
        }
        return Err(format!(
            "Companion update failed; previous files were preserved: {error}"
        ));
    }
    Ok(())
}

#[tauri::command]
pub async fn native_music_setup(
    app: AppHandle,
    music: State<'_, BrowserMusic>,
) -> Result<SetupResult, String> {
    let _guard = UPDATE_LOCK
        .try_lock()
        .map_err(|_| "A Companion update is already running.")?;
    let source = app
        .path()
        .resolve("music-companion", tauri::path::BaseDirectory::Resource)
        .map_err(|_| "Could not locate the included Companion.")?;
    let app_data = app
        .path()
        .app_local_data_dir()
        .map_err(|_| "Could not locate the Companion installation folder.")?;
    let prepared = tauri::async_runtime::spawn_blocking(move || install_bundle(&source, &app_data))
        .await
        .map_err(|e| e.to_string())??;
    let (ready, complete) = music.reload_companions(&prepared.version).await;
    let status = if complete {
        "ready"
    } else if music.connected_companions() > 0 {
        "reload-required"
    } else {
        "install-required"
    };
    #[cfg(windows)]
    let folder_opened = if complete {
        false
    } else {
        std::process::Command::new("explorer.exe")
            .arg(&prepared.folder)
            .spawn()
            .is_ok()
    };
    #[cfg(not(windows))]
    let folder_opened = false;
    Ok(SetupResult {
        version: prepared.version,
        folder: prepared
            .folder
            .join("extension")
            .to_string_lossy()
            .into_owned(),
        status,
        browsers_ready: ready,
        folder_opened,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    struct Fixture(PathBuf);
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
    fn fixture(version: &str) -> (Fixture, PathBuf, PathBuf) {
        let fixture =
            Fixture(std::env::temp_dir().join(format!("kora-companion-test-{}", Uuid::new_v4())));
        let source = fixture.0.join("bundle");
        let app_data = fixture.0.join("app-data");
        let names = [
            "extension/manifest.json",
            "extension/background.js",
            "extension/percussion-runtime.js",
            "extension/generated/percussion/percussion.onnx",
            "extension/vendor/percussion/ort-wasm-simd-threaded.wasm",
            "Install Music Companion.html",
        ];
        for name in names {
            let file = source.join(name);
            fs::create_dir_all(file.parent().unwrap()).unwrap();
            fs::write(file, "fixture file").unwrap();
        }
        fs::write(source.join("extension/manifest.json"), serde_json::json!({"name":"Kora Music Companion", "manifest_version":3,"version":version}).to_string()).unwrap();
        fs::write(
            source.join("package-files.json"),
            serde_json::to_vec(&names).unwrap(),
        )
        .unwrap();
        (fixture, source, app_data)
    }
    #[test]
    fn replaces_the_old_override_in_place_and_keeps_a_backup() {
        let (_fixture, source, app_data) = fixture("0.3.16");
        let old = install_bundle(&source, &app_data).unwrap();
        fs::write(old.folder.join("private-note.txt"), "keep this").unwrap();
        let manifest = source.join("extension/manifest.json");
        fs::write(
            &manifest,
            fs::read_to_string(&manifest)
                .unwrap()
                .replace("0.3.16", "0.3.23"),
        )
        .unwrap();
        let new = install_bundle(&source, &app_data).unwrap();
        assert_eq!(new.folder, old.folder);
        assert_eq!(new.version, "0.3.23");
        let backup = fs::read_dir(&app_data)
            .unwrap()
            .filter_map(Result::ok)
            .find(|f| {
                f.file_name()
                    .to_string_lossy()
                    .starts_with("music-companion-backup-")
            })
            .unwrap();
        assert_eq!(
            fs::read_to_string(backup.path().join("private-note.txt")).unwrap(),
            "keep this"
        );
        assert!(
            manifest_version(&fs::read(backup.path().join("extension/manifest.json")).unwrap())
                .unwrap()
                == "0.3.16"
        );
    }
    #[test]
    fn repeated_install_is_idempotent_and_newer_installs_are_not_downgraded() {
        let (_fixture, source, app_data) = fixture("0.3.23");
        install_bundle(&source, &app_data).unwrap();
        install_bundle(&source, &app_data).unwrap();
        assert_eq!(fs::read_dir(&app_data).unwrap().count(), 1);
        let manifest = app_data.join("music-companion/extension/manifest.json");
        fs::write(
            &manifest,
            fs::read_to_string(&manifest)
                .unwrap()
                .replace("0.3.23", "0.4.0"),
        )
        .unwrap();
        assert!(install_bundle(&source, &app_data)
            .unwrap_err()
            .contains("newer"));
        assert!(fs::read_to_string(manifest).unwrap().contains("0.4.0"));
    }
    #[test]
    fn incomplete_or_escaping_payload_never_replaces_installed_files() {
        let (_fixture, source, app_data) = fixture("0.3.23");
        install_bundle(&source, &app_data).unwrap();
        fs::remove_file(source.join("extension/background.js")).unwrap();
        assert!(install_bundle(&source, &app_data).is_err());
        assert!(app_data
            .join("music-companion/extension/background.js")
            .is_file());
        assert!(read_file(&source, "../outside").is_err());
        assert!(read_file(&source, "extension\\manifest.json").is_err());
    }
    #[test]
    fn failed_replacement_restores_the_previous_directory() {
        let (_fixture, _source, app_data) = fixture("0.3.23");
        fs::create_dir_all(app_data.join("live")).unwrap();
        fs::write(app_data.join("live/old.txt"), "previous").unwrap();
        assert!(replace_folder(
            &app_data.join("missing-stage"),
            &app_data.join("live"),
            &app_data.join("backup")
        )
        .is_err());
        assert_eq!(
            fs::read_to_string(app_data.join("live/old.txt")).unwrap(),
            "previous"
        );
        assert!(!app_data.join("backup").exists());
    }
    #[test]
    fn rejects_malformed_version_and_manifest_without_replacing_files() {
        for version in ["", "65536", "0.3.x", "1.2.3.4.5", "../file"] {
            assert!(version_parts(version).is_none());
        }
        let (_fixture, source, app_data) = fixture("0.3.23");
        install_bundle(&source, &app_data).unwrap();
        fs::write(source.join("extension/manifest.json"), "invalid JSON").unwrap();
        assert!(install_bundle(&source, &app_data).is_err());
        assert_eq!(
            manifest_version(
                &fs::read(app_data.join("music-companion/extension/manifest.json")).unwrap()
            )
            .unwrap(),
            "0.3.23"
        );
    }
    #[cfg(windows)]
    #[test]
    fn rejects_a_junction_in_the_package_or_installation_path() {
        let (_fixture, source, app_data) = fixture("0.3.23");
        install_bundle(&source, &app_data).unwrap();
        let link = app_data.join("link");
        let result = std::process::Command::new("cmd.exe")
            .args(["/c", "mklink", "/J"])
            .arg(&link)
            .arg(&source)
            .output()
            .unwrap();
        assert!(
            result.status.success(),
            "Could not create test junction: {:?}",
            result
        );
        let checked = no_link(&link);
        fs::remove_dir(&link).unwrap();
        assert!(checked.is_err());
    }
}
