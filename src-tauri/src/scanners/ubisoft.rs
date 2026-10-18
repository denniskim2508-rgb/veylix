use crate::library;
use crate::drives::DriveInfo;
use std::fs;
use std::path::Path;

pub fn scan_ubisoft(drives: &[DriveInfo]) -> Vec<library::GameRow> {
    let mut games = Vec::new();

    for drive in drives {
        let ubi_dirs = vec![
            format!("{}Program Files (x86)\\Ubisoft\\Ubisoft Game Launcher\\games", drive.root_path),
            format!("{}Program Files\\Ubisoft\\Ubisoft Game Launcher\\games", drive.root_path),
            format!("{}Ubisoft Game Launcher\\games", drive.root_path),
        ];

        for ubi_dir in &ubi_dirs {
            if Path::new(ubi_dir).exists() {
                games.extend(scan_ubisoft_directory(ubi_dir, drive.letter));
            }
        }
    }

    games
}

fn scan_ubisoft_directory(dir: &str, drive_letter: char) -> Vec<library::GameRow> {
    let mut games = Vec::new();

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let game_name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                let game_id = format!("ubi_{}", game_name.to_lowercase().replace(' ', "_"));

                if !library::game_exists("ubisoft", &game_id).unwrap_or(false) {
                    let launch_cmd = format!("uplay://launch/{}/0", game_name.to_lowercase().replace(' ', ""));

                    if let Ok(id) = library::insert_game(
                        &game_name,
                        "ubisoft",
                        Some(&path.to_string_lossy()),
                        None,
                        Some(&game_id),
                        Some(&launch_cmd),
                        Some(&drive_letter.to_string()),
                    ) {
                        games.push(library::GameRow {
                            id,
                            title: game_name,
                            platform: "ubisoft".to_string(),
                            install_path: Some(path.to_string_lossy().to_string()),
                            executable_path: None,
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
                            launch_command: Some(launch_cmd),
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
