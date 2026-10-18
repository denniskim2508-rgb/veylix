#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanFolderRow {
    pub id: i64,
    pub path: String,
    pub label: Option<String>,
}
