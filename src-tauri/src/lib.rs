use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::fs;
use std::path::Path;
use std::sync::Mutex;
use tauri::{Emitter, State};

const STEAM_ROOT: &str = r"C:\Program Files (x86)\Steam";
const RESULTS_SUBDIR: &str = r"steamapps\common\Le Mans Ultimate\UserData\Log\Results";

/// Reads every `*.xml` in `dir` and returns `(file name, contents)` pairs.
/// Unreadable files are skipped; the frontend reports parse failures itself.
#[tauri::command]
fn read_results(dir: String) -> Result<Vec<(String, String)>, String> {
  let entries = fs::read_dir(&dir).map_err(|e| format!("{dir}: {e}"))?;
  Ok(
    entries
      .flatten()
      .filter_map(|entry| {
        let name = entry.file_name().into_string().ok()?;
        if !name.ends_with(".xml") {
          return None;
        }
        // ponytail: lossy UTF-8 — LMU writes UTF-8, a stray byte shouldn't drop the whole file
        let bytes = fs::read(entry.path()).ok()?;
        Some((name, String::from_utf8_lossy(&bytes).into_owned()))
      })
      .collect(),
  )
}

/// Library roots from Steam's libraryfolders.vdf (`"path"  "D:\\SteamLibrary"` lines).
fn library_paths(vdf: &str) -> Vec<String> {
  vdf
    .lines()
    .filter_map(|l| l.trim().strip_prefix("\"path\""))
    .map(|rest| rest.trim().trim_matches('"').replace(r"\\", r"\"))
    .collect()
}

/// First existing LMU results folder across the default Steam install and all Steam libraries.
#[tauri::command]
fn find_results_dir() -> Option<String> {
  // ponytail: assumes Steam itself is in its default location; read HKCU\Software\Valve\Steam\SteamPath if users move it
  let vdf = fs::read_to_string(Path::new(STEAM_ROOT).join(r"steamapps\libraryfolders.vdf")).unwrap_or_default();
  std::iter::once(STEAM_ROOT.to_string())
    .chain(library_paths(&vdf))
    .map(|root| Path::new(&root).join(RESULTS_SUBDIR))
    .find(|p| p.is_dir())
    .map(|p| p.to_string_lossy().into_owned())
}

/// LMU's built-in web UI server; runs whenever the game does.
const LMU_API: &str = "http://localhost:6397/rest/watch";

/// Raw JSON of LMU's `standings` and `sessionInfo` endpoints; the frontend picks the fields it needs.
/// Proxied through Rust because the game's server sends no CORS headers.
#[tauri::command]
async fn lmu_live() -> Result<(String, String), String> {
  async fn get(path: &str) -> Result<String, String> {
    let res = reqwest::Client::new()
      .get(format!("{LMU_API}/{path}"))
      .timeout(std::time::Duration::from_secs(1))
      .send()
      .await
      .map_err(|e| e.to_string())?;
    res.error_for_status().map_err(|e| e.to_string())?.text().await.map_err(|e| e.to_string())
  }
  Ok((get("standings").await?, get("sessionInfo").await?))
}

#[derive(Default)]
struct ResultsWatcher(Mutex<Option<RecommendedWatcher>>);

/// Emits `results-changed` whenever an XML in `dir` is created or modified. Replaces any previous watch.
#[tauri::command]
fn watch_results(app: tauri::AppHandle, state: State<ResultsWatcher>, dir: String) -> Result<(), String> {
  let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
    let Ok(event) = res else { return };
    if matches!(event.kind, EventKind::Create(_) | EventKind::Modify(_))
      && event.paths.iter().any(|p| p.extension().is_some_and(|x| x == "xml"))
    {
      let _ = app.emit("results-changed", ());
    }
  })
  .map_err(|e| e.to_string())?;
  watcher.watch(Path::new(&dir), RecursiveMode::NonRecursive).map_err(|e| format!("{dir}: {e}"))?;
  // Dropping the old watcher stops it
  *state.0.lock().unwrap() = Some(watcher);
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(ResultsWatcher::default())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .invoke_handler(tauri::generate_handler![read_results, find_results_dir, watch_results, lmu_live])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
  #[test]
  fn reads_only_xml() {
    let dir = std::env::temp_dir().join("lmu-read-results-test");
    std::fs::create_dir_all(&dir).unwrap();
    std::fs::write(dir.join("a.xml"), "<RaceResults/>").unwrap();
    std::fs::write(dir.join("b.txt"), "nope").unwrap();
    let got = super::read_results(dir.to_string_lossy().into_owned()).unwrap();
    assert_eq!(got, vec![("a.xml".to_string(), "<RaceResults/>".to_string())]);
    assert!(super::read_results("/does/not/exist".into()).is_err());
  }

  #[test]
  fn parses_steam_library_paths() {
    let vdf = "\"libraryfolders\"\n{\n\t\"0\"\n\t{\n\t\t\"path\"\t\t\"C:\\\\Program Files (x86)\\\\Steam\"\n\t\t\"label\"\t\t\"\"\n\t}\n\t\"1\"\n\t{\n\t\t\"path\"\t\t\"D:\\\\SteamLibrary\"\n\t}\n}";
    assert_eq!(
      super::library_paths(vdf),
      vec![r"C:\Program Files (x86)\Steam".to_string(), r"D:\SteamLibrary".to_string()]
    );
  }
}
