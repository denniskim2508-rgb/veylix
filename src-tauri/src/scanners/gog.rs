use crate::library;
use crate::drives::DriveInfo;
use std::fs;
use std::path::Path;

pub fn scan_gog(_drives: &[DriveInfo]) -> Vec<library::GameRow> {
    let mut games = Vec::new();

    // Try registry-based detection via local app data
    let gog_path = dirs::data_local_dir().map(|p| p.join("GOG.com").join("Galaxy").join("library"));

    if let Some(path) = gog_path {
        if path.exists() {
            games.extend(scan_gog_library(&path));
        }
    }

    // Fallback: scan common GOG install paths
    for drive in _drives {
        let gog_games = format!("{}GOG Games", drive.root_path);
        if Path::new(&gog_games).exists() {
            games.extend(scan_gog_directory(&gog_games, drive.letter));
        }
    }

    games
}

fn find_exe_in_dir(dir: &Path) -> Option<String> {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension() {
                    if ext.eq_ignore_ascii_case("exe") {
                        return Some(path.to_string_lossy().to_string());
                    }
                }
            }
        }
    }
    None
}

fn scan_gog_library(dir: &Path) -> Vec<library::GameRow> {
    let mut games = Vec::new();

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                // Look for goggame-*.info files
                if let Ok(info_entries) = fs::read_dir(&path) {
                    for info_entry in info_entries.flatten() {
                        let info_path = info_entry.path();
                        let file_name = info_path.file_name().unwrap_or_default().to_string_lossy().to_string();
                        if file_name.starts_with("goggame-") && file_name.ends_with(".info") {
                            if let Some(game) = parse_gog_info(&info_path) {
                                games.push(game);
                            }
                        }
                    }
                }
            }
        }
    }

    games
}

fn scan_gog_directory(dir: &str, drive_letter: char) -> Vec<library::GameRow> {
    let mut games = Vec::new();

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let game_name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                let game_id = format!("gog_{}", game_name.to_lowercase().replace(' ', "_"));

                if library::game_exists("gog", &game_id).unwrap_or(false) {
                    let exe_path = find_exe_in_dir(&path);
                    let _ = library::update_game_executable("gog", &game_id, exe_path.as_deref());
                } else {
                    let exe_path = find_exe_in_dir(&path);
                    if let Ok(id) = library::insert_game(
                        &game_name,
                        "gog",
                        Some(&path.to_string_lossy()),
                        exe_path.as_deref(),
                        Some(&game_id),
                        exe_path.as_deref(),
                        Some(&drive_letter.to_string()),
                    ) {
                        games.push(library::GameRow {
                            id,
                            title: game_name,
                            platform: "gog".to_string(),
                            install_path: Some(path.to_string_lossy().to_string()),
                            executable_path: exe_path.clone(),
                            cover_image: None,
                            background_image: None,
                            description: None,
                            release_date: None,
                            genre: None,
                            developer: None,
                            publisher: None,
                            play_time: 0,
                            last_played: None,
                            is_installed: true,
                            is_favorite: false,
                            platform_game_id: Some(game_id),
                            launch_command: exe_path,
                            drive_letter: Some(drive_letter.to_string()),
                            icon: None,
                            logo: None,
                            trailer_path: None,
                            trailer_source: None,
                            created_at: String::new(),
                            updated_at: String::new(),
                        });
                    }
                }
            }
        }
    }

    games
}

#[derive(serde::Deserialize)]
struct GogInfo {
    #[serde(rename = "gameId")]
    game_id: Option<String>,
    name: Option<String>,
}

fn parse_gog_info(path: &Path) -> Option<library::GameRow> {
    let content = fs::read_to_string(path).ok()?;
    let info: GogInfo = serde_json::from_str(&content).ok()?;

    let game_id = info.game_id?;
    let name = info.name?;
    let install_dir = path.parent()?;
    let install_path = install_dir.to_string_lossy().to_string();
    let drive_letter = install_path.chars().next().map(|c| c.to_string());

    if library::game_exists("gog", &game_id).unwrap_or(false) {
        let exe_path = find_exe_in_dir(install_dir);
        let _ = library::update_game_executable("gog", &game_id, exe_path.as_deref());
        return None;
    }

    let exe_path = find_exe_in_dir(install_dir);

    let id = library::insert_game(
        &name,
        "gog",
        Some(&install_path),
        exe_path.as_deref(),
        Some(&game_id),
        exe_path.as_deref(),
        drive_letter.as_deref(),
    ).ok()?;

    Some(library::GameRow {
        id,
        title: name,
        platform: "gog".to_string(),
        install_path: Some(install_path),
        executable_path: exe_path.clone(),
        cover_image: None,
        background_image: None,
        description: None,
        release_date: None,
        genre: None,
        developer: None,
        publisher: None,
        play_time: 0,
        last_played: None,
        is_installed: true,
        is_favorite: false,
        platform_game_id: Some(game_id),
        launch_command: exe_path,
        drive_letter,
        icon: None,
        logo: None,
        trailer_path: None,
        trailer_source: None,
        created_at: String::new(),
        updated_at: String::new(),
    })
}
