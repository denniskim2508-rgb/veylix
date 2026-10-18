use crate::plugins::traits::{Plugin, LibraryPlugin, PluginType, GameMetadata};
use crate::drives::DriveInfo;
use crate::scanners::xbox;
use std::any::Any;

pub struct XboxPlugin;

impl XboxPlugin {
    pub fn new() -> Self {
        Self
    }
}

impl Default for XboxPlugin {
    fn default() -> Self {
        Self::new()
    }
}

impl Plugin for XboxPlugin {
    fn id(&self) -> &str {
        "xbox"
    }

    fn name(&self) -> &str {
        "Xbox"
    }

    fn version(&self) -> &str {
        "1.0.0"
    }

    fn description(&self) -> &str {
        "Import games from Xbox / Microsoft Store"
    }

    fn author(&self) -> &str {
        "GameHub"
    }

    fn plugin_type(&self) -> PluginType {
        PluginType::Library
    }

    fn on_load(&mut self) {}
    fn on_unload(&mut self) {}

    fn as_any(&self) -> &dyn Any {
        self
    }
}

impl LibraryPlugin for XboxPlugin {
    fn get_games(&self, drives: &[DriveInfo]) -> Vec<GameMetadata> {
        let game_rows = xbox::scan_xbox(drives);
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
        std::path::Path::new("C:\\Program Files\\WindowsApps\\Microsoft.XboxApp_48.109.30000.0_x64__8wekyb3d8bbwe\\GameOverlayRender.exe").exists()
            || std::path::Path::new("C:\\XboxGames").exists()
    }
}
