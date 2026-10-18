use crate::library;
use crate::drives::DriveInfo;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug)]
#[allow(dead_code)]
struct SteamApp {
    app_id: String,
    name: String,
    install_dir: String,
    state_flags: String,
}

pub fn scan_steam(drives: &[DriveInfo]) -> Vec<library::GameRow> {
    let mut games = Vec::new();

    for drive in drives {
        let common_paths = vec![
            format!("{}Program Files (x86)\\Steam", drive.root_path),
            format!("{}Steam", drive.root_path),
            format!("{}SteamLibrary", drive.root_path),
            format!("{}Games\\Steam", drive.root_path),
        ];

        for steam_path in &common_paths {
            let library_folders_path = Path::new(steam_path).join("steamapps").join("libraryfolders.vdf");
            if !library_folders_path.exists() {
                continue;
            }

            let libraries = parse_library_folders(&library_folders_path);
            for lib_path in &libraries {
                let steamapps_dir = lib_path.join("steamapps");
                if !steamapps_dir.exists() {
                    continue;
                }

                if let Ok(entries) = fs::read_dir(&steamapps_dir) {
                    for entry in entries.flatten() {
                        let file_name = entry.file_name().to_string_lossy().to_string();
                        if file_name.starts_with("appmanifest_") && file_name.ends_with(".acf") {
                            let acf_path = entry.path();
                            if let Some(app) = parse_acf(&acf_path) {
                                let game_path = lib_path.join("steamapps").join("common").join(&app.install_dir);
                                let is_installed = app.state_flags == "4" && game_path.exists();
                                let install_path = game_path.to_string_lossy().to_string();
                                let drive_letter = install_path.chars().next().map(|c| c.to_string());

                                if !library::game_exists("steam", &app.app_id).unwrap_or(false) {
                                    let launch_cmd = format!("steam://rungameid/{}", app.app_id);
                                    if let Ok(id) = library::insert_game(
                                        &app.name,
                                        "steam",
                                        Some(&install_path),
                                        None,
                                        Some(&app.app_id),
                                        Some(&launch_cmd),
                                        drive_letter.as_deref(),
                                    ) {
                                        games.push(library::GameRow {
                                            id,
                                            title: app.name.clone(),
                                            platform: "steam".to_string(),
                                            install_path: Some(install_path),
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
                                            is_installed,
                                            is_favorite: false,
                                            platform_game_id: Some(app.app_id),
                                            launch_command: Some(launch_cmd),
                                            drive_letter,
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
                }
            }
        }
    }

    games
}

fn parse_library_folders(path: &Path) -> Vec<PathBuf> {
    let mut libraries = Vec::new();

    if let Ok(content) = fs::read_to_string(path) {
        let mut current_path = String::new();
        let mut in_entry = false;

        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.contains("\"path\"") {
                if let Some(value) = extract_vdf_value(trimmed) {
                    current_path = value.replace("\\\\", "\\").replace("\\/", "/");
                    in_entry = true;
                }
            } else if in_entry && trimmed == "}" {
                if !current_path.is_empty() {
                    libraries.push(PathBuf::from(&current_path));
                    current_path.clear();
                    in_entry = false;
                }
            }
        }
    }

    libraries
}

fn parse_acf(path: &Path) -> Option<SteamApp> {
    let content = fs::read_to_string(path).ok()?;
    let mut app_id = String::new();
    let mut name = String::new();
    let mut install_dir = String::new();
    let mut state_flags = String::new();

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.contains("\"appid\"") {
            app_id = extract_vdf_value(trimmed).unwrap_or_default();
        } else if trimmed.contains("\"name\"") {
            name = extract_vdf_value(trimmed).unwrap_or_default();
        } else if trimmed.contains("\"installdir\"") {
            install_dir = extract_vdf_value(trimmed).unwrap_or_default();
        } else if trimmed.contains("\"StateFlags\"") {
            state_flags = extract_vdf_value(trimmed).unwrap_or_default();
        }
    }

    if app_id.is_empty() || name.is_empty() {
        return None;
    }

    Some(SteamApp {
        app_id,
        name,
        install_dir,
        state_flags,
    })
}

fn extract_vdf_value(line: &str) -> Option<String> {
    let start = line.find('"')?;
    let rest = &line[start + 1..];
    let end = rest.find('"')?;

    let after_key = &rest[end + 1..];
    let value_start = after_key.find('"')?;
    let value_rest = &after_key[value_start + 1..];
    let value_end = value_rest.find('"')?;

    Some(value_rest[..value_end].to_string())
}
