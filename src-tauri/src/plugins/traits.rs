#![allow(dead_code)]

use crate::library::GameRow;
use crate::drives::DriveInfo;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameMetadata {
    pub title: String,
    pub platform: String,
    pub install_path: Option<String>,
    pub executable_path: Option<String>,
    pub cover_image: Option<String>,
    pub background_image: Option<String>,
    pub description: Option<String>,
    pub release_date: Option<String>,
    pub genre: Option<String>,
    pub developer: Option<String>,
    pub publisher: Option<String>,
    pub platform_game_id: Option<String>,
    pub launch_command: Option<String>,
    pub drive_letter: Option<String>,
    pub is_installed: bool,
    pub age_rating: Option<String>,
    pub version: Option<String>,
    pub region: Option<String>,
    pub community_score: Option<f64>,
    pub critic_score: Option<f64>,
}

impl GameMetadata {
    pub fn to_game_row(self, id: i64) -> GameRow {
        GameRow {
            id,
            title: self.title,
            platform: self.platform,
            install_path: self.install_path,
            executable_path: self.executable_path,
            cover_image: self.cover_image,
            background_image: self.background_image,
            description: self.description,
            release_date: self.release_date,
            genre: self.genre,
            developer: self.developer,
            publisher: self.publisher,
            play_time: 0,
            last_played: None,
            is_installed: self.is_installed,
            is_favorite: false,
            platform_game_id: self.platform_game_id,
            launch_command: self.launch_command,
            drive_letter: self.drive_letter,
            icon: None,
            logo: None,
            trailer_path: None,
            trailer_source: None,
            created_at: String::new(),
            updated_at: String::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetadataField {
    pub name: String,
    pub display_name: String,
    pub field_type: MetadataFieldType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MetadataFieldType {
    Text,
    LongText,
    Number,
    Date,
    Image,
    Url,
    List,
    Rating,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetadataResult {
    pub cover_image: Option<String>,
    pub background_image: Option<String>,
    pub description: Option<String>,
    pub release_date: Option<String>,
    pub developer: Option<String>,
    pub publisher: Option<String>,
    pub genres: Vec<String>,
    pub tags: Vec<String>,
    pub rating: Option<f64>,
    pub screenshots: Vec<String>,
    pub videos: Vec<String>,
    pub community_score: Option<f64>,
    pub critic_score: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub id: String,
    pub title: String,
    pub platform: Option<String>,
    pub year: Option<u32>,
    pub cover_image: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SidebarItem {
    pub id: String,
    pub title: String,
    pub icon: Option<String>,
    pub icon_type: SidebarIconType,
    pub badge: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SidebarIconType {
    Platform,
    Custom,
    Counter,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameMenuItem {
    pub id: String,
    pub title: String,
    pub icon: Option<String>,
    pub visible_for_games: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MainMenuItem {
    pub id: String,
    pub title: String,
    pub icon: Option<String>,
    pub path: Option<String>,
    pub sub_items: Vec<MainMenuItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub plugin_type: PluginType,
    pub entry_point: Option<String>,
    pub settings_schema: Option<HashMap<String, SettingDefinition>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PluginType {
    Library,
    Metadata,
    Generic,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingDefinition {
    pub field_type: String,
    pub label: String,
    pub default_value: Option<serde_json::Value>,
    pub description: Option<String>,
}

pub trait Plugin: Send + Sync {
    fn id(&self) -> &str;
    fn name(&self) -> &str;
    fn version(&self) -> &str;
    fn description(&self) -> &str;
    fn author(&self) -> &str;
    fn plugin_type(&self) -> PluginType;
    fn on_load(&mut self);
    fn on_unload(&mut self);
    fn as_any(&self) -> &dyn std::any::Any;
    fn get_settings(&self) -> Option<serde_json::Value> {
        None
    }
    fn save_settings(&mut self, _settings: serde_json::Value) {}
}

pub trait LibraryPlugin: Plugin {
    fn get_games(&self, drives: &[DriveInfo]) -> Vec<GameMetadata>;
    fn get_game_details(&self, _game_id: &str) -> Option<GameMetadata> {
        None
    }
    fn is_client_installed(&self) -> bool;
    fn get_library_icon(&self) -> Option<Vec<u8>> {
        None
    }
    fn get_library_background(&self) -> Option<String> {
        None
    }
}

pub trait MetadataPlugin: Plugin {
    fn supported_fields(&self) -> Vec<MetadataField>;
    fn get_metadata(&self, game: &GameMetadata) -> Option<MetadataResult>;
    fn search_game(&self, _query: &str) -> Vec<SearchResult> {
        Vec::new()
    }
}

pub trait GenericPlugin: Plugin {
    fn get_sidebar_items(&self) -> Vec<SidebarItem> {
        Vec::new()
    }
    fn get_game_menu_items(&self) -> Vec<GameMenuItem> {
        Vec::new()
    }
    fn get_main_menu_items(&self) -> Vec<MainMenuItem> {
        Vec::new()
    }
    fn on_game_started(&self, _game: &GameRow) {}
    fn on_game_stopped(&self, _game: &GameRow, _duration_minutes: u64) {}
    fn on_game_selected(&self, _game: &GameRow) {}
    fn on_application_started(&self) {}
    fn on_application_stopped(&self) {}
    fn on_library_updated(&self, _games: &[GameRow]) {}
}
