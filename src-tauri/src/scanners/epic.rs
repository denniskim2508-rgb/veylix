use crate::library;
use crate::drives::DriveInfo;
use std::fs;
use std::path::Path;

#[derive(Debug, serde::Deserialize)]
#[allow(dead_code)]
struct EpicManifest {
    #[serde(rename = "AppName")]
    app_name: Option<String>,
    #[serde(rename = "DisplayName")]
    display_name: Option<String>,
    #[serde(rename = "InstallLocation")]
    install_location: Option<String>,
    #[serde(rename = "LaunchExecutable")]
    launch_executable: Option<String>,
    #[serde(rename = "CatalogItemId")]
    catalog_item_id: Option<String>,
}

pub fn scan_epic(_drives: &[DriveInfo]) -> Vec<library::GameRow> {
    let games = Vec::new();

    let program_data = match dirs::data_local_dir() {
        Some(p) => p.parent().unwrap_or(&p).join("Epic").join("EpicGamesLauncher").join("Data").join("Manifests"),
        None => return games,
    };

    if !program_data.exists() {
        // Try alternate path
        let alt = Path::new("C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests");
        if !alt.exists() {
            return games;
        }
        return scan_epic_dir(alt);
    }

    scan_epic_dir(&program_data)
}

fn scan_epic_dir(dir: &Path) -> Vec<library::GameRow> {
    let mut games = Vec::new();

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let file_name = entry.file_name().to_string_lossy().to_string();
            if !file_name.ends_with(".item") {
                continue;
            }

            if let Ok(content) = fs::read_to_string(entry.path()) {
                if let Ok(manifest) = serde_json::from_str::<EpicManifest>(&content) {
                    let app_name = match manifest.app_name {
                        Some(name) if !name.is_empty() => name,
                        _ => continue,
                    };

                    let display_name = manifest.display_name.unwrap_or_else(|| app_name.clone());
                    let install_location = manifest.install_location.unwrap_or_default();

                    if install_location.is_empty() || !Path::new(&install_location).exists() {
                        continue;
                    }

                    let launch_exe = manifest.launch_executable.unwrap_or_default();
                    let executable_path = if launch_exe.is_empty() {
                        None
                    } else {
                        Some(format!("{}\\{}", install_location, launch_exe))
                    };

                    let drive_letter = install_location.chars().next().map(|c| c.to_string());
                    let launch_cmd = format!("com.epicgames.launcher://apps/{}?action=launch&silent=true", app_name);

                    if !library::game_exists("epic", &app_name).unwrap_or(false) {
                        if let Ok(id) = library::insert_game(
                            &display_name,
                            "epic",
                            Some(&install_location),
                            executable_path.as_deref(),
                            Some(&app_name),
                            Some(&launch_cmd),
                            drive_letter.as_deref(),
                        ) {
                            games.push(library::GameRow {
                                id,
                                title: display_name,
                                platform: "epic".to_string(),
                                install_path: Some(install_location),
                                executable_path,
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
                                platform_game_id: Some(app_name),
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

    games
}
