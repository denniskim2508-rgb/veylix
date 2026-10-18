use std::path::PathBuf;

fn get_app_dir() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("gamehub")
}

pub fn get_artwork_dir(game_id: i64) -> PathBuf {
    get_app_dir().join("artwork").join(game_id.to_string())
}

pub fn get_artwork_full_path(relative_path: &str) -> PathBuf {
    get_app_dir().join(relative_path)
}

pub fn save_artwork_file(
    game_id: i64,
    artwork_type: &str,
    source_path: &str,
) -> Result<String, String> {
    let dest_dir = get_artwork_dir(game_id);
    std::fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;

    // Clean up any existing artwork of this type first
    remove_artwork_file(game_id, artwork_type)?;

    let ext = std::path::Path::new(source_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png");

    let filename = format!("{}.{}", artwork_type, ext);
    let dest_path = dest_dir.join(&filename);

    std::fs::copy(source_path, &dest_path).map_err(|e| e.to_string())?;

    Ok(format!("artwork/{}/{}", game_id, filename))
}

pub fn remove_artwork_file(game_id: i64, artwork_type: &str) -> Result<(), String> {
    let dir = get_artwork_dir(game_id);
    if !dir.exists() {
        return Ok(());
    }

    let entries = std::fs::read_dir(&dir).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with(artwork_type) {
            let _ = std::fs::remove_file(entry.path());
        }
    }

    Ok(())
}

pub fn save_screenshot_file(
    game_id: i64,
    index: usize,
    source_path: &str,
) -> Result<String, String> {
    let dest_dir = get_artwork_dir(game_id);
    std::fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;

    let ext = std::path::Path::new(source_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png");

    let filename = format!("screenshot_{}.{}", index, ext);
    let dest_path = dest_dir.join(&filename);

    std::fs::copy(source_path, &dest_path).map_err(|e| e.to_string())?;

    Ok(format!("artwork/{}/{}", game_id, filename))
}

pub fn remove_screenshot_file(game_id: i64, index: usize) -> Result<(), String> {
    let dir = get_artwork_dir(game_id);
    if !dir.exists() {
        return Ok(());
    }

    let prefix = format!("screenshot_{}", index);
    let entries = std::fs::read_dir(&dir).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with(&prefix) {
            let _ = std::fs::remove_file(entry.path());
        }
    }

    Ok(())
}

pub fn cleanup_game_artwork(game_id: i64) -> Result<(), String> {
    let dir = get_artwork_dir(game_id);
    if dir.exists() {
        std::fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}
