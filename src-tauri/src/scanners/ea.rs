use crate::library;
use crate::drives::DriveInfo;
use std::fs;
use std::path::Path;

pub fn scan_ea(drives: &[DriveInfo]) -> Vec<library::GameRow> {
    let mut games = Vec::new();

    for drive in drives {
        let ea_dirs = vec![
            format!("{}Program Files\\EA Games", drive.root_path),
            format!("{}Program Files (x86)\\EA Games", drive.root_path),
            format!("{}EA Games", drive.root_path),
        ];

        for ea_dir in &ea_dirs {
            if Path::new(ea_dir).exists() {
                games.extend(scan_ea_directory(ea_dir, drive.letter));
            }
        }
    }

    games
}

fn scan_ea_directory(dir: &str, drive_letter: char) -> Vec<library::GameRow> {
    let mut games = Vec::new();

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let game_name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                let installer_data = path.join("__Installer").join("installerdata.xml");

                let (game_id, launch_cmd) = if installer_data.exists() {
                    parse_installer_data(&installer_data)
                } else {
                    (format!("ea_{}", game_name.to_lowercase().replace(' ', "_")), None)
                };

                if !library::game_exists("ea", &game_id).unwrap_or(false) {
                    // Try to find the main executable
                    let exe_path = find_game_executable(&path);

                    if let Ok(id) = library::insert_game(
                        &game_name,
                        "ea",
                        Some(&path.to_string_lossy()),
                        exe_path.as_deref(),
                        Some(&game_id),
                        launch_cmd.as_deref(),
                        Some(&drive_letter.to_string()),
                    ) {
                        games.push(library::GameRow {
                            id,
                            title: game_name,
                            platform: "ea".to_string(),
                            install_path: Some(path.to_string_lossy().to_string()),
                            executable_path: exe_path,
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
                            launch_command: launch_cmd,
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

fn parse_installer_data(path: &Path) -> (String, Option<String>) {
    let content = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return (String::new(), None),
    };

    // Simple XML parsing for contentIDs
    let game_id = extract_xml_tag(&content, "contentIDs")
        .map(|s| s.split(',').next().unwrap_or(&s).trim().to_string())
        .unwrap_or_default();

    let launch_cmd = if !game_id.is_empty() {
        Some(format!("origin2://game/launch?offerIds={}", game_id))
    } else {
        None
    };

    (game_id, launch_cmd)
}

fn extract_xml_tag(content: &str, tag: &str) -> Option<String> {
    let start = format!("<{}>", tag);
    let end = format!("</{}>", tag);

    let start_idx = content.find(&start)? + start.len();
    let end_idx = content.find(&end)?;

    Some(content[start_idx..end_idx].trim().to_string())
}

fn find_game_executable(dir: &Path) -> Option<String> {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map(|e| e == "exe").unwrap_or(false) {
                return Some(path.to_string_lossy().to_string());
            }
        }
    }
    None
}
