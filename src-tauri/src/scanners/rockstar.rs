use crate::library;
use crate::drives::DriveInfo;
use std::fs;
use std::path::Path;

pub fn scan_rockstar(drives: &[DriveInfo]) -> Vec<library::GameRow> {
    let mut games = Vec::new();

    for drive in drives {
        let rs_dirs = vec![
            format!("{}Program Files\\Rockstar Games", drive.root_path),
            format!("{}Program Files (x86)\\Rockstar Games", drive.root_path),
            format!("{}Rockstar Games", drive.root_path),
        ];

        for rs_dir in &rs_dirs {
            if Path::new(rs_dir).exists() {
                games.extend(scan_rockstar_directory(&rs_dir, drive.letter));
            }
        }
    }

    games
}

fn scan_rockstar_directory(dir: &str, drive_letter: char) -> Vec<library::GameRow> {
    let mut games = Vec::new();

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let game_name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                let launch_code = get_rockstar_launch_code(&game_name);
                let game_id = format!("rockstar_{}", launch_code);

                if !library::game_exists("rockstar", &game_id).unwrap_or(false) {
                    let launch_cmd = format!("rockstargames://{}", launch_code);

                    if let Ok(id) = library::insert_game(
                        &game_name,
                        "rockstar",
                        Some(&path.to_string_lossy()),
                        None,
                        Some(&game_id),
                        Some(&launch_cmd),
                        Some(&drive_letter.to_string()),
                    ) {
                        games.push(library::GameRow {
                            id,
                            title: game_name,
                            platform: "rockstar".to_string(),
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

fn get_rockstar_launch_code(name: &str) -> String {
    match name.to_lowercase().as_str() {
        s if s.contains("gta") && s.contains("v") => "five".to_string(),
        s if s.contains("red dead") => "rdr2".to_string(),
        s if s.contains("gta") && s.contains("iii") => "gta3unreal".to_string(),
        s if s.contains("gta") && s.contains("vice") => "gtavcunreal".to_string(),
        s if s.contains("gta") && s.contains("san") => "gtasaunreal".to_string(),
        s if s.contains("l.a. noire") || s.contains("la noire") => "lanoire".to_string(),
        s if s.contains("max payne 3") => "maxpayne3".to_string(),
        _ => name.to_lowercase().replace(' ', "_"),
    }
}
