use crate::library;
use crate::drives::DriveInfo;
use std::collections::HashSet;
use std::fs;
use std::path::Path;

const SKIP_EXECUTABLES: &[&str] = &[
    "setup", "uninstall", "unins000", "update", "updater", "launcher",
    "crash", "report", "helper", "service", "agent", "monitor",
    "install", "remove", "repair", "config", "settings", "options",
    "unins", "isunins",
];

pub fn scan_local(drives: &[DriveInfo], scan_folders: &[String]) -> Vec<library::GameRow> {
    let mut games = Vec::new();
    let mut seen_paths: HashSet<String> = HashSet::new();

    for folder in scan_folders {
        if let Ok(entries) = fs::read_dir(folder) {
            for entry in entries.flatten() {
                let path = entry.path();
                let name_lower = entry.file_name().to_string_lossy().to_lowercase();

                if entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
                    let path_str = path.to_string_lossy().to_string();
                    if seen_paths.contains(&path_str) {
                        continue;
                    }
                    if let Some(game) = try_detect_game(&path) {
                        seen_paths.insert(path_str.clone());
                        if library::game_exists("local", &path_str).unwrap_or(false) {
                            let _ = library::update_game_executable("local", &path_str, game.executable.as_deref());
                        } else {
                            if let Ok(id) = library::insert_game(
                                &game.title,
                                "local",
                                Some(&path_str),
                                game.executable.as_deref(),
                                Some(&path_str),
                                game.executable.as_deref(),
                                path_str.chars().next().map(|c| c.to_string()).as_deref(),
                            ) {
                                let drive_letter = path_str.chars().next().map(|c| c.to_string());
                                games.push(library::GameRow {
                                    id,
                                    title: game.title,
                                    platform: "local".to_string(),
                                    install_path: Some(path_str.clone()),
                                    executable_path: game.executable.clone(),
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
                                    platform_game_id: Some(path_str.clone()),
                                    launch_command: game.executable,
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
                } else if name_lower.ends_with(".exe") {
                    let base_name = name_lower.trim_end_matches(".exe").to_string();
                    if SKIP_EXECUTABLES.iter().any(|s| base_name.contains(s)) {
                        continue;
                    }
                    let path_str = path.to_string_lossy().to_string();
                    if seen_paths.contains(&path_str) {
                        continue;
                    }
                    let title = base_name.replace('_', " ").replace('-', " ");
                    if library::game_exists("local", &path_str).unwrap_or(false) {
                        let _ = library::update_game_executable("local", &path_str, Some(&path_str));
                    } else {
                        if let Ok(id) = library::insert_game(
                            &title,
                            "local",
                            None,
                            Some(&path_str),
                            Some(&path_str),
                            Some(&path_str),
                            path_str.chars().next().map(|c| c.to_string()).as_deref(),
                        ) {
                            seen_paths.insert(path_str.clone());
                            games.push(library::GameRow {
                                id,
                                title,
                                platform: "local".to_string(),
                                install_path: None,
                                executable_path: Some(path_str.clone()),
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
                                platform_game_id: Some(path_str.clone()),
                                launch_command: Some(path_str.clone()),
                                drive_letter: path_str.chars().next().map(|c| c.to_string()),
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

    for drive in drives {
        let common_dirs = vec![
            format!("{}Games", drive.root_path),
            format!("{}Game", drive.root_path),
            format!("{}PC Games", drive.root_path),
        ];

        for pattern in &common_dirs {
            if Path::new(pattern).exists() {
                scan_directory_for_games(Path::new(pattern), &mut games, &mut seen_paths);
            }
        }

        let steamapps_common = format!("{}SteamLibrary\\steamapps\\common", drive.root_path);
        if Path::new(&steamapps_common).exists() {
            if let Ok(entries) = fs::read_dir(&steamapps_common) {
                for entry in entries.flatten() {
                    if entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
                        let path = entry.path();
                        let path_str = path.to_string_lossy().to_string();
                        if seen_paths.contains(&path_str) {
                            continue;
                        }
                        if !library::game_exists("local", &path_str).unwrap_or(false) {
                            let title = entry.file_name().to_string_lossy().to_string();
                            let exe_path = find_first_exe(&path);
                            if let Ok(id) = library::insert_game(
                                &title,
                                "local",
                                Some(&path_str),
                                exe_path.as_deref(),
                                Some(&path_str),
                                exe_path.as_deref(),
                                path_str.chars().next().map(|c| c.to_string()).as_deref(),
                            ) {
                                seen_paths.insert(path_str.clone());
                                games.push(library::GameRow {
                                    id,
                                    title,
                                    platform: "local".to_string(),
                                    install_path: Some(path_str.clone()),
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
                                    platform_game_id: Some(path_str.clone()),
                                    launch_command: exe_path,
                                    drive_letter: path_str.chars().next().map(|c| c.to_string()),
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

    games
}

fn find_first_exe(dir: &Path) -> Option<String> {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension() {
                    if ext.eq_ignore_ascii_case("exe") {
                        let name = path.file_stem().unwrap_or_default().to_string_lossy().to_lowercase();
                        if !SKIP_EXECUTABLES.iter().any(|s| name.contains(s)) {
                            return Some(path.to_string_lossy().to_string());
                        }
                    }
                }
            }
        }
    }
    None
}

fn scan_directory_for_games(dir: &Path, games: &mut Vec<library::GameRow>, seen: &mut HashSet<String>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name_lower = entry.file_name().to_string_lossy().to_lowercase();

            if entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
                let path_str = path.to_string_lossy().to_string();
                if seen.contains(&path_str) {
                    continue;
                }
                if let Some(game) = try_detect_game(&path) {
                    seen.insert(path_str.clone());
                    if library::game_exists("local", &path_str).unwrap_or(false) {
                        let _ = library::update_game_executable("local", &path_str, game.executable.as_deref());
                    } else {
                        if let Ok(id) = library::insert_game(
                            &game.title,
                            "local",
                            Some(&path_str),
                            game.executable.as_deref(),
                            Some(&path_str),
                            game.executable.as_deref(),
                            path_str.chars().next().map(|c| c.to_string()).as_deref(),
                        ) {
                            games.push(library::GameRow {
                                id,
                                title: game.title,
                                platform: "local".to_string(),
                                install_path: Some(path_str.clone()),
                                executable_path: game.executable.clone(),
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
                                platform_game_id: Some(path_str.clone()),
                                launch_command: game.executable,
                                drive_letter: path_str.chars().next().map(|c| c.to_string()),
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
            } else if name_lower.ends_with(".exe") {
                let base_name = name_lower.trim_end_matches(".exe").to_string();
                if SKIP_EXECUTABLES.iter().any(|s| base_name.contains(s)) {
                    continue;
                }
                let path_str = path.to_string_lossy().to_string();
                if seen.contains(&path_str) {
                    continue;
                }
                let title = base_name.replace('_', " ").replace('-', " ");
                if library::game_exists("local", &path_str).unwrap_or(false) {
                    let _ = library::update_game_executable("local", &path_str, Some(&path_str));
                } else {
                    if let Ok(id) = library::insert_game(
                        &title,
                        "local",
                        None,
                        Some(&path_str),
                        Some(&path_str),
                        Some(&path_str),
                        path_str.chars().next().map(|c| c.to_string()).as_deref(),
                    ) {
                        seen.insert(path_str.clone());
                        games.push(library::GameRow {
                            id,
                            title,
                            platform: "local".to_string(),
                            install_path: None,
                            executable_path: Some(path_str.clone()),
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
                            platform_game_id: Some(path_str.clone()),
                            launch_command: Some(path_str.clone()),
                            drive_letter: path_str.chars().next().map(|c| c.to_string()),
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

struct DetectedGame {
    title: String,
    executable: Option<String>,
}

fn try_detect_game(dir: &Path) -> Option<DetectedGame> {
    let dir_name = dir.file_name()?.to_string_lossy().to_string();
    let dir_lower = dir_name.to_lowercase();

    if dir_lower.starts_with(".") || dir_lower == "system volume information" {
        return None;
    }

    let mut exes: Vec<String> = Vec::new();

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            let name_lower = name.to_lowercase();

            if !entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) && name_lower.ends_with(".exe") {
                let base_name = name_lower.trim_end_matches(".exe").to_string();
                let is_skipped = SKIP_EXECUTABLES.iter().any(|skip| base_name.contains(skip));
                if !is_skipped {
                    exes.push(entry.path().to_string_lossy().to_string());
                }
            }
        }
    }

    if exes.is_empty() {
        return None;
    }

    let best_exe = if exes.len() == 1 {
        exes[0].clone()
    } else {
        let game_exe = exes.iter().find(|e| {
            let lower = e.to_lowercase();
            !lower.contains("uninstall") && !lower.contains("setup") && !lower.contains("config")
        });
        game_exe.cloned().unwrap_or(exes[0].clone())
    };

    let title = dir_name
        .replace("_", " ")
        .replace("-", " ");

    Some(DetectedGame {
        title,
        executable: Some(best_exe),
    })
}
