#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameRow {
    pub id: i64,
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
    pub play_time: i64,
    pub last_played: Option<String>,
    pub is_installed: bool,
    pub is_favorite: bool,
    pub platform_game_id: Option<String>,
    pub launch_command: Option<String>,
    pub drive_letter: Option<String>,
    pub icon: Option<String>,
    pub logo: Option<String>,
    pub trailer_path: Option<String>,
    pub trailer_source: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameUpdate {
    pub title: Option<String>,
    pub description: Option<String>,
    pub genre: Option<String>,
    pub developer: Option<String>,
    pub publisher: Option<String>,
    pub release_date: Option<String>,
    pub cover_image: Option<String>,
    pub background_image: Option<String>,
    pub icon: Option<String>,
    pub logo: Option<String>,
    pub trailer_path: Option<String>,
    pub trailer_source: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaySessionRow {
    pub id: i64,
    pub game_id: i64,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub duration_minutes: i64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenshotRow {
    pub id: i64,
    pub game_id: i64,
    pub url: String,
    pub local_path: Option<String>,
    pub sort_order: i64,
}

#[allow(dead_code)]
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryRow {
    pub id: i64,
    pub name: String,
    pub icon: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtworkSearchResult {
    pub title: String,
    pub source_url: String,
    pub thumbnail_url: String,
    pub width: u32,
    pub height: u32,
    pub provider: String,
}
