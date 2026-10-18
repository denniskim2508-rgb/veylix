use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum AddonCategory {
    ThemesDesktop,
    ThemesFullscreen,
    Libraries,
    MetadataSources,
    Generic,
}

impl AddonCategory {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::ThemesDesktop => "themes-desktop",
            Self::ThemesFullscreen => "themes-fullscreen",
            Self::Libraries => "libraries",
            Self::MetadataSources => "metadata-sources",
            Self::Generic => "generic",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "themes-desktop" => Some(Self::ThemesDesktop),
            "themes-fullscreen" => Some(Self::ThemesFullscreen),
            "libraries" => Some(Self::Libraries),
            "metadata-sources" => Some(Self::MetadataSources),
            "generic" => Some(Self::Generic),
            _ => None,
        }
    }

    pub fn label(&self) -> &'static str {
        match self {
            Self::ThemesDesktop => "Themes Desktop",
            Self::ThemesFullscreen => "Themes Fullscreen",
            Self::Libraries => "Libraries",
            Self::MetadataSources => "Metadata Sources",
            Self::Generic => "Generic",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum AddonType {
    ThemeFullscreen,
    ThemeDesktop,
    Library,
    MetadataSource,
    Generic,
}

impl AddonType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::ThemeFullscreen => "theme-fullscreen",
            Self::ThemeDesktop => "theme-desktop",
            Self::Library => "library",
            Self::MetadataSource => "metadata-source",
            Self::Generic => "generic",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "theme-fullscreen" => Some(Self::ThemeFullscreen),
            "theme-desktop" => Some(Self::ThemeDesktop),
            "library" => Some(Self::Library),
            "metadata-source" => Some(Self::MetadataSource),
            "generic" => Some(Self::Generic),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddonVersion {
    pub version: String,
    pub download_url: String,
    #[serde(default)]
    pub sha256: Option<String>,
    #[serde(default)]
    pub min_game_hub_version: Option<String>,
    #[serde(default)]
    pub max_game_hub_version: Option<String>,
    #[serde(default)]
    pub changelog: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddonCatalogEntry {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub addon_type: AddonType,
    pub category: AddonCategory,
    pub author: String,
    pub description: String,
    #[serde(default)]
    pub long_description: Option<String>,
    pub version: String,
    #[serde(default)]
    pub min_game_hub_version: Option<String>,
    #[serde(default)]
    pub max_game_hub_version: Option<String>,
    #[serde(default)]
    pub icon_url: Option<String>,
    #[serde(default)]
    pub screenshots: Vec<String>,
    #[serde(default)]
    pub homepage_url: Option<String>,
    #[serde(default)]
    pub source_repository: Option<String>,
    #[serde(default)]
    pub license: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    pub versions: Vec<AddonVersion>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddonCatalog {
    pub catalog_version: u32,
    pub game_hub_min_version: Option<String>,
    pub updated_at: Option<String>,
    #[serde(default)]
    pub categories: Vec<CatalogCategory>,
    pub addons: Vec<AddonCatalogEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogCategory {
    pub id: String,
    pub label: String,
    #[serde(default)]
    pub icon: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledAddon {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub addon_type: AddonType,
    pub version: String,
    pub author: String,
    #[serde(default)]
    pub description: Option<String>,
    pub enabled: bool,
    pub installed_at: String,
    #[serde(default)]
    pub updated_at: Option<String>,
    pub install_path: String,
    #[serde(default)]
    pub source_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum AddonState {
    Installed,
    Enabled,
    Disabled,
    UpToDate,
    UpdateAvailable,
    NotInstalled,
}

impl AddonState {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Installed => "installed",
            Self::Enabled => "enabled",
            Self::Disabled => "disabled",
            Self::UpToDate => "up-to-date",
            Self::UpdateAvailable => "update-available",
            Self::NotInstalled => "not-installed",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddonManifest {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub addon_type: AddonType,
    pub version: String,
    pub author: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub min_game_hub_version: Option<String>,
    #[serde(default)]
    pub max_game_hub_version: Option<String>,
    #[serde(default)]
    pub entry: Option<String>,
    #[serde(default)]
    pub variables: Option<serde_json::Value>,
}
