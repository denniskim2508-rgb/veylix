use crate::plugins::traits::{Plugin, MetadataPlugin, PluginType, GameMetadata, MetadataField, MetadataFieldType, MetadataResult};
use std::any::Any;

pub struct IgdbMetadataPlugin {
    settings: serde_json::Value,
}

impl IgdbMetadataPlugin {
    pub fn new() -> Self {
        Self {
            settings: serde_json::json!({
                "client_id": "",
                "client_secret": "",
                "auto_fetch": false
            }),
        }
    }
}

impl Default for IgdbMetadataPlugin {
    fn default() -> Self {
        Self::new()
    }
}

impl Plugin for IgdbMetadataPlugin {
    fn id(&self) -> &str {
        "igdb"
    }

    fn name(&self) -> &str {
        "IGDB"
    }

    fn version(&self) -> &str {
        "1.0.0"
    }

    fn description(&self) -> &str {
        "Fetch game metadata from IGDB (Internet Game Database)"
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

    fn get_settings(&self) -> Option<serde_json::Value> {
        Some(self.settings.clone())
    }

    fn save_settings(&mut self, settings: serde_json::Value) {
        self.settings = settings;
    }
}

impl MetadataPlugin for IgdbMetadataPlugin {
    fn supported_fields(&self) -> Vec<MetadataField> {
        vec![
            MetadataField { name: "cover".to_string(), display_name: "Cover Image".to_string(), field_type: MetadataFieldType::Image },
            MetadataField { name: "background".to_string(), display_name: "Background Image".to_string(), field_type: MetadataFieldType::Image },
            MetadataField { name: "description".to_string(), display_name: "Description".to_string(), field_type: MetadataFieldType::LongText },
            MetadataField { name: "release_date".to_string(), display_name: "Release Date".to_string(), field_type: MetadataFieldType::Date },
            MetadataField { name: "developer".to_string(), display_name: "Developer".to_string(), field_type: MetadataFieldType::Text },
            MetadataField { name: "publisher".to_string(), display_name: "Publisher".to_string(), field_type: MetadataFieldType::Text },
            MetadataField { name: "genres".to_string(), display_name: "Genres".to_string(), field_type: MetadataFieldType::List },
            MetadataField { name: "rating".to_string(), display_name: "Rating".to_string(), field_type: MetadataFieldType::Rating },
            MetadataField { name: "screenshots".to_string(), display_name: "Screenshots".to_string(), field_type: MetadataFieldType::Image },
            MetadataField { name: "videos".to_string(), display_name: "Videos".to_string(), field_type: MetadataFieldType::Url },
        ]
    }

    fn get_metadata(&self, _game: &GameMetadata) -> Option<MetadataResult> {
        // TODO: Implement actual IGDB API call
        // For now, return None to indicate no metadata available
        None
    }

    fn search_game(&self, _query: &str) -> Vec<crate::plugins::traits::SearchResult> {
        // TODO: Implement IGDB search
        Vec::new()
    }
}
