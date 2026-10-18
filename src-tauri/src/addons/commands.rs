use super::catalog;
use super::database;
use super::installer;
use super::models::{AddonCatalog, InstalledAddon};

#[tauri::command]
pub async fn fetch_addon_catalog(url: String) -> Result<AddonCatalog, String> {
    catalog::fetch_catalog(&url).await
}

#[tauri::command]
pub fn load_local_addon_catalog(path: String) -> Result<AddonCatalog, String> {
    catalog::load_local_catalog(&path)
}

#[tauri::command]
pub async fn get_installed_addons() -> Result<Vec<InstalledAddon>, String> {
    database::get_installed_addons()
}

#[tauri::command]
pub async fn install_addon(
    entry_json: String,
    version: String,
) -> Result<InstalledAddon, String> {
    let entry: super::models::AddonCatalogEntry =
        serde_json::from_str(&entry_json).map_err(|e| format!("Invalid addon entry: {}", e))?;

    let version_info = entry
        .versions
        .iter()
        .find(|v| v.version == version)
        .ok_or_else(|| format!("Version '{}' not found", version))?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;

    let bytes = if version_info.download_url.starts_with("file://") {
        let path = version_info.download_url.strip_prefix("file://").unwrap_or(&version_info.download_url);
        std::fs::read(path).map_err(|e| format!("Failed to read local file: {}", e))?
    } else {
        let response = client
            .get(&version_info.download_url)
            .header("User-Agent", "GameHub/0.1")
            .send()
            .await
            .map_err(|e| format!("Download failed: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("HTTP {}", response.status()));
        }

        response.bytes().await.map_err(|e| e.to_string())?.to_vec()
    };

    installer::install_addon(&entry, &version, &bytes)
}

#[tauri::command]
pub async fn uninstall_addon(addon_id: String) -> Result<(), String> {
    installer::uninstall_addon(&addon_id)
}

#[tauri::command]
pub async fn enable_addon(addon_id: String) -> Result<(), String> {
    installer::enable_addon(&addon_id)
}

#[tauri::command]
pub async fn disable_addon(addon_id: String) -> Result<(), String> {
    installer::disable_addon(&addon_id)
}

#[tauri::command]
pub async fn update_addon(
    addon_id: String,
    version: String,
    entry_json: String,
) -> Result<InstalledAddon, String> {
    let entry: super::models::AddonCatalogEntry =
        serde_json::from_str(&entry_json).map_err(|e| format!("Invalid addon entry: {}", e))?;

    let version_info = entry
        .versions
        .iter()
        .find(|v| v.version == version)
        .ok_or_else(|| format!("Version '{}' not found", version))?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;

    let bytes = if version_info.download_url.starts_with("file://") {
        let path = version_info.download_url.strip_prefix("file://").unwrap_or(&version_info.download_url);
        std::fs::read(path).map_err(|e| format!("Failed to read local file: {}", e))?
    } else {
        let response = client
            .get(&version_info.download_url)
            .header("User-Agent", "GameHub/0.1")
            .send()
            .await
            .map_err(|e| format!("Download failed: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("HTTP {}", response.status()));
        }

        response.bytes().await.map_err(|e| e.to_string())?.to_vec()
    };

    installer::update_addon(&addon_id, &version, &entry, &bytes)
}

#[tauri::command]
pub async fn get_addon_install_path(addon_id: String) -> Result<Option<String>, String> {
    database::get_addon_install_path(&addon_id)
}
