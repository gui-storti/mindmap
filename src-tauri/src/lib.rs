use tauri_plugin_dialog::DialogExt;

/// Open a native file picker and return the selected file's bytes.
/// Returns `None` when the user cancels the dialog.
#[tauri::command]
async fn open_mind_file(app: tauri::AppHandle) -> Result<Option<Vec<u8>>, String> {
    let picked = app
        .dialog()
        .file()
        .set_title("Open mind map")
        .add_filter("Mind maps", &["mind", "json"])
        .blocking_pick_file();

    match picked {
        Some(file_path) => {
            let path = file_path
                .into_path()
                .map_err(|e| format!("Could not resolve selected path: {e}"))?;
            let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
            Ok(Some(bytes))
        }
        None => Ok(None),
    }
}

/// Open a native "save as" dialog and write the given bytes to the chosen path.
/// Does nothing when the user cancels the dialog.
#[tauri::command]
async fn save_mind_file(
    app: tauri::AppHandle,
    data: Vec<u8>,
    suggested_name: String,
) -> Result<(), String> {
    let picked = app
        .dialog()
        .file()
        .set_title("Save mind map")
        .add_filter("Mind maps", &["mind"])
        .set_file_name(suggested_name)
        .blocking_save_file();

    match picked {
        Some(file_path) => {
            let path = file_path
                .into_path()
                .map_err(|e| format!("Could not resolve selected path: {e}"))?;
            std::fs::write(&path, data).map_err(|e| e.to_string())?;
            Ok(())
        }
        None => Ok(()),
    }
}

/// Generic "save as" dialog for arbitrary file types.
/// Does nothing when the user cancels the dialog.
#[tauri::command]
async fn save_file(
    app: tauri::AppHandle,
    data: Vec<u8>,
    suggested_name: String,
    filter_name: String,
    filter_exts: Vec<String>,
) -> Result<(), String> {
    let picked = app
        .dialog()
        .file()
        .set_title("Save file")
        .add_filter(&filter_name, &filter_exts)
        .set_file_name(suggested_name)
        .blocking_save_file();

    match picked {
        Some(file_path) => {
            let path = file_path
                .into_path()
                .map_err(|e| format!("Could not resolve selected path: {e}"))?;
            std::fs::write(&path, data).map_err(|e| e.to_string())?;
            Ok(())
        }
        None => Ok(()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![open_mind_file, save_mind_file, save_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
