use crate::plugins::traits::{Plugin, MetadataPlugin, PluginType, GameMetadata, MetadataField, MetadataFieldType, MetadataResult};
use std::any::Any;

pub struct SteamStoreMetadataPlugin;

impl SteamStoreMetadataPlugin {
    pub fn new() -> Self {
        Self
    }
}

impl Default for SteamStoreMetadataPlugin {
    fn default() -> Self {
        Self::new()
    }
}

impl Plugin for SteamStoreMetadataPlugin {
    fn id(&self) -> &str {
        "steam_store"
    }

    fn name(&self) -> &str {
        "Steam Store"
    }

    fn version(&self) -> &str {
        "1.0.0"
    }

    fn description(&self) -> &str {
        "Fetch game metadata from Steam Store API"
    }

    fn author(&self) -> &str {
        "GameHub"
    }

    fn plugin_type(&self) -> PluginType {
        PluginType::Metadata
    }

    fn on_load(&mut self) {}
    fn on_unload(&mut self) {}

    fn as_any(&self) -> &dyn Any {
        self
    }
}

impl MetadataPlugin for SteamStoreMetadataPlugin {
    fn supported_fields(&self) -> Vec<MetadataField> {
        vec![
            MetadataField { name: "cover".to_string(), display_name: "Cover Image".to_string(), field_type: MetadataFieldType::Image },
            MetadataField { name: "background".to_string(), display_name: "Background Image".to_string(), field_type: MetadataFieldType::Image },
            MetadataField { name: "description".to_string(), display_name: "Description".to_string(), field_type: MetadataFieldType::LongText },
            MetadataField { name: "release_date".to_string(), display_name: "Release Date".to_string(), field_type: MetadataFieldType::Date },
            MetadataField { name: "developer".to_string(), display_name: "Developer".to_string(), field_type: MetadataFieldType::Text },
            MetadataField { name: "publisher".to_string(), display_name: "Publisher".to_string(), field_type: MetadataFieldType::Text },
            MetadataField { name: "genres".to_string(), display_name: "Genres".to_string(), field_type: MetadataFieldType::List },
            MetadataField { name: "screenshots".to_string(), display_name: "Screenshots".to_string(), field_type: MetadataFieldType::Image },
        ]
    }

    fn get_metadata(&self, _game: &GameMetadata) -> Option<MetadataResult> {
        // TODO: Implement actual Steam Store API call
        None
    }

    fn search_game(&self, _query: &str) -> Vec<crate::plugins::traits::SearchResult> {
        // TODO: Implement Steam Store search
        Vec::new()
    }
}
