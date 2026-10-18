use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ArtworkType {
    Cover,
    Hero,
    Logo,
    Background,
    Icon,
    Screenshot,
    Header,
    Capsule,
}

impl ArtworkType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Cover => "cover",
            Self::Hero => "hero",
            Self::Logo => "logo",
            Self::Background => "background",
            Self::Icon => "icon",
            Self::Screenshot => "screenshot",
            Self::Header => "header",
            Self::Capsule => "capsule",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "cover" => Some(Self::Cover),
            "hero" => Some(Self::Hero),
            "logo" => Some(Self::Logo),
            "background" => Some(Self::Background),
            "icon" => Some(Self::Icon),
            "screenshot" => Some(Self::Screenshot),
            "header" => Some(Self::Header),
            "capsule" => Some(Self::Capsule),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ArtworkSelectionMode {
    Automatic,
    Manual,
}

impl ArtworkSelectionMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Automatic => "automatic",
            Self::Manual => "manual",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderCapability {
    Metadata,
    Cover,
    Hero,
    Logo,
    Background,
    Screenshot,
    Icon,
    Header,
    Capsule,
    Search,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameArtworkCandidate {
    pub id: i64,
    pub game_id: i64,
    pub artwork_type: String,
    pub url: String,
    pub thumbnail_url: Option<String>,
    pub width: i32,
    pub height: i32,
    pub provider: String,
    pub provider_asset_id: Option<String>,
    pub score: f64,
    pub is_primary: bool,
    pub selection_mode: String,
    pub cached_path: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalId {
    pub id: i64,
    pub game_id: i64,
    pub provider: String,
    pub external_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderPriority {
    pub id: i64,
    pub category: String,
    pub provider: String,
    pub priority_order: i32,
    pub is_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderStatus {
    pub id: String,
    pub name: String,
    pub is_configured: bool,
    pub status: String,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchCandidate {
    pub provider: String,
    pub provider_id: String,
    pub title: String,
    pub release_year: Option<u32>,
    pub platforms: Vec<String>,
    pub confidence: f64,
    pub cover_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrichedMetadata {
    pub title: Option<String>,
    pub description: Option<String>,
    pub developer: Option<String>,
    pub publisher: Option<String>,
    pub release_date: Option<String>,
    pub genres: Vec<String>,
    pub rating: Option<f64>,
    pub steam_app_id: Option<String>,
    pub igdb_id: Option<String>,
    pub rawg_id: Option<String>,
    pub steamgriddb_id: Option<String>,
}
