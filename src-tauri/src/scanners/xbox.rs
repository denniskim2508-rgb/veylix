use crate::library;
use crate::drives::DriveInfo;
use std::fs;
use std::path::Path;

pub fn scan_xbox(drives: &[DriveInfo]) -> Vec<library::GameRow> {
    let mut games = Vec::new();

    // Scan XboxGames folders on all drives
    for drive in drives {
        let xbox_dirs = vec![
            format!("{}XboxGames", drive.root_path),
            format!("{}Program Files\\WindowsApps", drive.root_path),
        ];

        for xbox_dir in &xbox_dirs {
            if Path::new(&xbox_dir).exists() {
                games.extend(scan_xbox_directory(&xbox_dir, drive.letter));
            }
        }
    }

    games
}

fn scan_xbox_directory(dir: &str, drive_letter: char) -> Vec<library::GameRow> {
    let mut games = Vec::new();

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                // Check for MicrosoftGame.config to identify Xbox games
                let config_path = path.join("MicrosoftGame.config");
                if !config_path.exists() {
                    continue;
                }

                let game_name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                // Clean up WindowsApps naming convention
                let clean_name = clean_xbox_name(&game_name);
                let game_id = format!("xbox_{}", clean_name.to_lowercase().replace(' ', "_"));

                if !library::game_exists("xbox", &game_id).unwrap_or(false) {
                    // Find the executable
                    let exe_path = find_xbox_executable(&path);

                    if let Ok(id) = library::insert_game(
                        &clean_name,
                        "xbox",
                        Some(&path.to_string_lossy()),
                        exe_path.as_deref(),
                        Some(&game_id),
                        None, // Xbox games use shell:AppsFolder launching
                        Some(&drive_letter.to_string()),
                    ) {
                        games.push(library::GameRow {
                            id,
                            title: clean_name,
                            platform: "xbox".to_string(),
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
                            launch_command: None,
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

fn clean_xbox_name(name: &str) -> String {
    // Xbox package names look like: Microsoft.SunriseFarm_8wekyb3d8bbwe
    // We want: Microsoft.SunriseFarm
    if let Some(idx) = name.find('_') {
        name[..idx].to_string()
    } else {
        name.to_string()
    }
}

fn find_xbox_executable(dir: &Path) -> Option<String> {
    // Look for Gameface binaries (UE4/UE5 games)
    let gameface_bin = dir.join("Gameface").join("Binaries").join("Win64");
    if gameface_bin.exists() {
        if let Ok(entries) = fs::read_dir(&gameface_bin) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().map(|e| e == "exe").unwrap_or(false) {
                    let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                    if !name.contains("Unreal") && !name.contains("Crash") {
                        return Some(path.to_string_lossy().to_string());
                    }
                }
            }
        }
    }

    // Look for other exe files
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
