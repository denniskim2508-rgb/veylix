use crate::library;
use crate::drives::DriveInfo;
use std::fs;
use std::path::Path;

pub fn scan_battlenet(_drives: &[DriveInfo]) -> Vec<library::GameRow> {
    let mut games = Vec::new();

    // Battle.net stores installed games in Battle.net.config
    let config_path = dirs::data_local_dir()
        .map(|p| p.parent().unwrap_or(&p).join("Battle.net").join("Battle.net.config"));

    if let Some(path) = config_path {
        if path.exists() {
            games.extend(parse_battlenet_config(&path));
        }
    }

    games
}

#[derive(serde::Deserialize, Debug)]
struct BattleNetConfig {
    #[serde(rename = "Games")]
    games: Option<serde_json::Value>,
}

#[derive(Debug)]
struct BattleNetGame {
    product_code: String,
    name: String,
    install_path: Option<String>,
}

fn parse_battlenet_config(path: &Path) -> Vec<library::GameRow> {
    let mut games = Vec::new();

    let content = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return games,
    };

    // Battle.net.config is JSON but with some quirks
    // Try parsing as JSON first
    if let Ok(config) = serde_json::from_str::<BattleNetConfig>(&content) {
        if let Some(games_obj) = config.games {
            if let Some(obj) = games_obj.as_object() {
                for (product_code, game_data) in obj {
                    if let Some(game_info) = game_data.as_object() {
                        let resumable = game_info.get("Resumable").and_then(|v| v.as_str());
                        if resumable == Some("true") {
                            let name = get_battlenet_game_name(product_code);
                            let install_path = game_info.get("Path").and_then(|v| v.as_str()).map(|s| s.to_string());

                            let game = BattleNetGame {
                                product_code: product_code.clone(),
                                name,
                                install_path,
                            };

                            if let Some(row) = add_battlenet_game(game) {
                                games.push(row);
                            }
                        }
                    }
                }
            }
        }
    }

    games
}

fn get_battlenet_game_name(code: &str) -> String {
    match code {
        "fenris" | "Fen" => "Diablo IV".to_string(),
        "D3" => "Diablo III".to_string(),
        "Pro" | "prometheus" => "Overwatch 2".to_string(),
        "WoW" => "World of Warcraft".to_string(),
        "S2" => "StarCraft II".to_string(),
        "ODIN" => "Call of Duty: Modern Warfare".to_string(),
        "VIPR" => "Call of Duty: Black Ops 4".to_string(),
        "WLBY" => "Crash Bandicoot 4".to_string(),
        "Aqua" => "Avowed".to_string(),
        _ => code.to_string(),
    }
}

fn add_battlenet_game(game: BattleNetGame) -> Option<library::GameRow> {
    let game_id = format!("bnet_{}", game.product_code);

    if library::game_exists("battlenet", &game_id).unwrap_or(true) {
        return None;
    }

    let launch_cmd = format!("battlenet://{}", game.product_code);
    let install_path = game.install_path.unwrap_or_default();
    let drive_letter = install_path.chars().next().map(|c| c.to_string());

    let id = library::insert_game(
        &game.name,
        "battlenet",
        Some(&install_path),
        None,
        Some(&game_id),
        Some(&launch_cmd),
        drive_letter.as_deref(),
    ).ok()?;

    Some(library::GameRow {
        id,
        title: game.name,
        platform: "battlenet".to_string(),
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
        is_installed: true,
        is_favorite: false,
        platform_game_id: Some(game_id),
        launch_command: Some(launch_cmd),
        drive_letter,
        icon: None,
        logo: None,
        trailer_path: None,
        trailer_source: None,
        created_at: String::new(),
        updated_at: String::new(),
    })
}
