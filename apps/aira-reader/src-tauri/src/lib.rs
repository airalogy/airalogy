use std::{
    env,
    ffi::OsString,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
};

use serde::Serialize;
use tauri::{Emitter, Manager};

const OPEN_FILES_EVENT: &str = "aira-reader-open-files";

#[derive(Serialize)]
struct DesktopFile {
    name: String,
    path: String,
    bytes: Vec<u8>,
}

#[derive(Default)]
struct OpenFileState {
    frontend_ready: AtomicBool,
    pending_paths: Mutex<Vec<String>>,
}

impl OpenFileState {
    fn take_initial_paths(&self) -> Vec<String> {
        self.frontend_ready.store(true, Ordering::SeqCst);
        let mut pending_paths = self
            .pending_paths
            .lock()
            .expect("open-file pending path state poisoned");
        pending_paths.drain(..).collect()
    }

    fn queue_if_frontend_is_not_ready(&self, paths: &[String]) {
        if self.frontend_ready.load(Ordering::SeqCst) {
            return;
        }
        let mut pending_paths = self
            .pending_paths
            .lock()
            .expect("open-file pending path state poisoned");
        pending_paths.extend(paths.iter().cloned());
    }
}

#[tauri::command]
fn initial_file_paths(state: tauri::State<'_, OpenFileState>) -> Vec<String> {
    let mut paths = collect_aira_paths(env::args_os().skip(1), None);
    paths.extend(state.take_initial_paths());
    dedupe_paths(paths)
}

#[tauri::command]
fn read_aira_file(path: String) -> Result<DesktopFile, String> {
    let path = normalize_path(&path, None);
    if !is_aira_path(&path) {
        return Err("Airalogy Reader can only open .aira archives.".into());
    }

    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("archive.aira")
        .to_string();
    let bytes = std::fs::read(&path)
        .map_err(|error| format!("Failed to read {}: {error}", path.display()))?;

    Ok(DesktopFile {
        name,
        path: path.to_string_lossy().into_owned(),
        bytes,
    })
}

fn is_aira_path(path: &Path) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("aira"))
}

fn normalize_path(value: &str, cwd: Option<&Path>) -> PathBuf {
    let path_value = value
        .strip_prefix("file://")
        .map(normalize_file_url_path)
        .unwrap_or_else(|| value.to_string());
    let path = PathBuf::from(path_value);
    if path.is_absolute() {
        path
    } else {
        cwd.map_or(path.clone(), |base| base.join(path))
    }
}

fn normalize_file_url_path(value: &str) -> String {
    let path = value
        .strip_prefix("localhost/")
        .map(|path| format!("/{path}"))
        .unwrap_or_else(|| value.to_string());
    percent_decode(&path)
}

fn percent_decode(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;

    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            if let (Some(high), Some(low)) =
                (hex_value(bytes[index + 1]), hex_value(bytes[index + 2]))
            {
                decoded.push(high * 16 + low);
                index += 3;
                continue;
            }
        }
        decoded.push(bytes[index]);
        index += 1;
    }

    String::from_utf8_lossy(&decoded).into_owned()
}

fn hex_value(value: u8) -> Option<u8> {
    match value {
        b'0'..=b'9' => Some(value - b'0'),
        b'a'..=b'f' => Some(value - b'a' + 10),
        b'A'..=b'F' => Some(value - b'A' + 10),
        _ => None,
    }
}

fn collect_aira_paths<I>(args: I, cwd: Option<&Path>) -> Vec<String>
where
    I: IntoIterator<Item = OsString>,
{
    args.into_iter()
        .filter_map(|arg| arg.into_string().ok())
        .filter(|arg| !arg.starts_with('-'))
        .map(|arg| normalize_path(&arg, cwd))
        .filter(|path| is_aira_path(path))
        .map(|path| path.to_string_lossy().into_owned())
        .collect()
}

fn collect_aira_file_urls(urls: Vec<tauri::Url>) -> Vec<String> {
    let paths = urls
        .into_iter()
        .filter_map(|url| url.to_file_path().ok())
        .filter(|path| is_aira_path(path))
        .map(|path| path.to_string_lossy().into_owned())
        .collect();
    dedupe_paths(paths)
}

fn dedupe_paths(paths: Vec<String>) -> Vec<String> {
    let mut deduped = Vec::new();
    for path in paths {
        if !deduped.contains(&path) {
            deduped.push(path);
        }
    }
    deduped
}

fn handle_opened_file_urls(app: &tauri::AppHandle, urls: Vec<tauri::Url>) {
    let paths = collect_aira_file_urls(urls);
    if paths.is_empty() {
        return;
    }

    if let Some(state) = app.try_state::<OpenFileState>() {
        state.queue_if_frontend_is_not_ready(&paths);
    }

    let _ = app.emit(OPEN_FILES_EVENT, paths);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_encoded_file_urls() {
        let path = normalize_path("file:///tmp/My%20Archive.aira", None);

        assert_eq!(path, PathBuf::from("/tmp/My Archive.aira"));
    }

    #[test]
    fn normalizes_localhost_file_urls() {
        let path = normalize_path("file://localhost/tmp/archive.aira", None);

        assert_eq!(path, PathBuf::from("/tmp/archive.aira"));
    }

    #[test]
    fn collects_only_aira_paths() {
        let paths = collect_aira_paths(
            [
                OsString::from("--flag"),
                OsString::from("archive.aira"),
                OsString::from("notes.txt"),
            ],
            Some(Path::new("/tmp")),
        );

        assert_eq!(paths, vec!["/tmp/archive.aira"]);
    }

    #[test]
    fn collects_file_open_urls() {
        let paths = collect_aira_file_urls(vec![
            tauri::Url::parse("file:///tmp/My%20Archive.aira").unwrap(),
            tauri::Url::parse("file:///tmp/notes.txt").unwrap(),
            tauri::Url::parse("file:///tmp/My%20Archive.aira").unwrap(),
        ]);

        assert_eq!(paths, vec!["/tmp/My Archive.aira"]);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(OpenFileState::default())
        .invoke_handler(tauri::generate_handler![initial_file_paths, read_aira_file])
        .build(tauri::generate_context!())
        .expect("error while building Airalogy Reader")
        .run(|app, event| {
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            if let tauri::RunEvent::Opened { urls } = event {
                handle_opened_file_urls(app, urls);
            }
        });
}
