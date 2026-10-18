#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmulatorRow {
    pub id: i64,
    pub name: String,
    pub executable_path: String,
    pub platform: String,
    pub command_template: Option<String>,
    pub supported_extensions: Option<String>,
    pub default_args: Option<String>,
    pub is_installed: bool,
    pub icon: Option<String>,
    pub core_path: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RomFileRow {
    pub id: i64,
    pub game_id: i64,
    pub emulator_id: Option<i64>,
    pub file_path: String,
    pub file_name: String,
    pub file_size: i64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RomScanFolderRow {
    pub id: i64,
    pub path: String,
    pub label: Option<String>,
    pub emulator_id: Option<i64>,
}
