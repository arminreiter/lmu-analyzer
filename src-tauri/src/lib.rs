use std::fs;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .invoke_handler(tauri::generate_handler![read_results])
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
}
