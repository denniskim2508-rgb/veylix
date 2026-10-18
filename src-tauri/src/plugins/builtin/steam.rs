use crate::plugins::traits::{Plugin, LibraryPlugin, PluginType, GameMetadata};
use crate::drives::DriveInfo;
use crate::scanners::steam;
use std::any::Any;

pub struct SteamPlugin {
    settings: serde_json::Value,
}

impl SteamPlugin {
    pub fn new() -> Self {
        Self {
            settings: serde_json::json!({
                "scan_other_drives": true,
                "scan_steam_dirs": true
            }),
        }
    }
}

impl Default for SteamPlugin {
    fn default() -> Self {
        Self::new()
    }
}

impl Plugin for SteamPlugin {
    fn id(&self) -> &str {
        "steam"
    }

    fn name(&self) -> &str {
        "Steam"
    }

    fn version(&self) -> &str {
        "1.0.0"
    }

    fn description(&self) -> &str {
        "Import games from Steam"
    }

    fn author(&self) -> &str {
        "GameHub"
    }

    fn plugin_type(&self) -> PluginType {
        PluginType::Library
    }

    fn on_load(&mut self) {
        // Load saved settings
    }

    fn on_unload(&mut self) {
        // Save settings
    }

    fn as_any(&self) -> &dyn Any {
        self
    }

    fn get_settings(&self) -> Option<serde_json::Value> {
        Some(self.settings.clone())
    }

    fn save_settings(&mut self, settings: serde_json::Value) {
        self.settings = settings;
    }
}

impl LibraryPlugin for SteamPlugin {
    fn get_games(&self, drives: &[DriveInfo]) -> Vec<GameMetadata> {
        let game_rows = steam::scan_steam(drives);
        game_rows
            .into_iter()
            .map(|row| GameMetadata {
                title: row.title,
                platform: row.platform,
                install_path: row.install_path,
                executable_path: row.executable_path,
                cover_image: row.cover_image,
                background_image: row.background_image,
                description: row.description,
                release_date: row.release_date,
                genre: row.genre,
                developer: row.developer,
                publisher: row.publisher,
                platform_game_id: row.platform_game_id,
                launch_command: row.launch_command,
                drive_letter: row.drive_letter,
                is_installed: row.is_installed,
                age_rating: None,
                version: None,
                region: None,
                community_score: None,
                critic_score: None,
            })
            .collect()
    }

    fn is_client_installed(&self) -> bool {
        // Check if Steam is installed
        std::path::Path::new("C:\\Program Files (x86)\\Steam\\steam.exe").exists()
            || std::path::Path::new("D:\\Steam\\steam.exe").exists()
    }
}
