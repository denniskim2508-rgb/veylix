use std::io::Read;
use std::path::{Path, PathBuf};
use sha2::{Sha256, Digest};
use zip::ZipArchive;

use super::database;
use super::models::{AddonCatalogEntry, AddonManifest, InstalledAddon};

fn get_addons_dir() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("gamehub")
        .join("addons")
}

fn compute_sha256(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    format!("{:x}", hasher.finalize())
}

fn normalize_sha256(hash: &str) -> Result<String, String> {
    let trimmed = hash.trim().to_ascii_lowercase();
    if trimmed.len() != 64 {
        return Err(format!(
            "SHA-256 hash must be exactly 64 hex characters, got {}",
            trimmed.len()
        ));
    }
    if !trimmed.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("SHA-256 hash contains invalid hexadecimal characters".to_string());
    }
    Ok(trimmed)
}

fn validate_path(path: &str) -> bool {
    if path.contains("..") {
        return false;
    }
    if path.starts_with('/') || path.starts_with('\\') {
        return false;
    }
    if path.contains(':') {
        return false;
    }
    let normalized = path.replace('\\', "/");
    if normalized.starts_with('/') {
        return false;
    }
    true
}

fn validate_manifest(manifest: &AddonManifest, entry: &AddonCatalogEntry, version: &str) -> Result<(), String> {
    if manifest.id != entry.id {
        return Err(format!(
            "Manifest ID '{}' does not match catalog ID '{}'",
            manifest.id, entry.id
        ));
    }

    if manifest.version != version {
        return Err(format!(
            "Manifest version '{}' does not match requested version '{}'",
            manifest.version, version
        ));
    }

    if manifest.name.is_empty() {
        return Err("Manifest name is empty".to_string());
    }

    if manifest.author.is_empty() {
        return Err("Manifest author is empty".to_string());
    }

    Ok(())
}

fn validate_zip_paths(archive: &mut ZipArchive<std::io::Cursor<Vec<u8>>>) -> Result<(), String> {
    for i in 0..archive.len() {
        let entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = entry.name().to_string();
        if !validate_path(&name) {
            return Err(format!("Path traversal detected: {}", name));
        }
    }
    Ok(())
}

fn extract_to_staging(
    archive_data: &[u8],
    staging_dir: &Path,
) -> Result<(), String> {
    let cursor = std::io::Cursor::new(archive_data.to_vec());
    let mut archive = ZipArchive::new(cursor).map_err(|e| format!("Invalid ZIP: {}", e))?;

    validate_zip_paths(&mut archive)?;

    std::fs::create_dir_all(staging_dir).map_err(|e| e.to_string())?;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let outpath = staging_dir.join(entry.mangled_name());

        if entry.is_dir() {
            std::fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = outpath.parent() {
                std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let mut outfile = std::fs::File::create(&outpath).map_err(|e| e.to_string())?;
            std::io::copy(&mut entry, &mut outfile).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

fn read_manifest_from_zip(archive_data: &[u8]) -> Result<AddonManifest, String> {
    let cursor = std::io::Cursor::new(archive_data.to_vec());
    let mut archive = ZipArchive::new(cursor).map_err(|e| format!("Invalid ZIP: {}", e))?;

    let mut manifest_entry = archive
        .by_name("manifest.json")
        .map_err(|_| "manifest.json not found in archive".to_string())?;

    let mut manifest_content = String::new();
    manifest_entry
        .read_to_string(&mut manifest_content)
        .map_err(|e| e.to_string())?;

    let manifest: AddonManifest =
        serde_json::from_str(&manifest_content).map_err(|e| format!("Invalid manifest.json: {}", e))?;

    Ok(manifest)
}

pub fn install_addon(
    entry: &AddonCatalogEntry,
    version: &str,
    archive_data: &[u8],
) -> Result<InstalledAddon, String> {
    let version_info = entry
        .versions
        .iter()
        .find(|v| v.version == version)
        .ok_or_else(|| format!("Version '{}' not found in catalog entry", version))?;

    if let Some(ref expected_hash) = version_info.sha256 {
        let actual_hash = compute_sha256(archive_data);
        let normalized_expected = normalize_sha256(expected_hash)?;
        if actual_hash != normalized_expected {
            return Err(format!(
                "SHA-256 mismatch: expected '{}', got '{}'",
                normalized_expected, actual_hash
            ));
        }
    }

    let manifest = read_manifest_from_zip(archive_data)?;
    validate_manifest(&manifest, entry, version)?;

    let addons_dir = get_addons_dir();
    let addon_dir = addons_dir.join(&entry.id);
    let staging_dir = addon_dir.join("_staging");

    if staging_dir.exists() {
        std::fs::remove_dir_all(&staging_dir).map_err(|e| e.to_string())?;
    }

    extract_to_staging(archive_data, &staging_dir)?;

    let old_dir = addon_dir.join("_old");
    if addon_dir.exists() && !addon_dir.join("_staging").exists() {
        if old_dir.exists() {
            std::fs::remove_dir_all(&old_dir).map_err(|e| e.to_string())?;
        }
        std::fs::rename(&addon_dir, &old_dir).map_err(|e| e.to_string())?;
    }

    std::fs::rename(&staging_dir, &addon_dir).map_err(|e| {
        if old_dir.exists() {
            std::fs::rename(&old_dir, &addon_dir).ok();
        }
        e.to_string()
    })?;

    if old_dir.exists() {
        std::fs::remove_dir_all(&old_dir).map_err(|e| e.to_string())?;
    }

    let install_path = addon_dir.to_string_lossy().to_string();

    let installed = InstalledAddon {
        id: entry.id.clone(),
        name: entry.name.clone(),
        addon_type: entry.addon_type.clone(),
        version: version.to_string(),
        author: entry.author.clone(),
        description: Some(entry.description.clone()),
        enabled: true,
        installed_at: chrono::Utc::now().to_rfc3339(),
        updated_at: None,
        install_path,
        source_url: entry.source_repository.clone(),
    };

    database::insert_installed_addon(&installed)?;

    Ok(installed)
}

pub fn uninstall_addon(addon_id: &str) -> Result<(), String> {
    let path_opt = database::get_addon_install_path(addon_id)?;
    let install_path = path_opt.ok_or_else(|| format!("Addon '{}' not found in database", addon_id))?;

    let path = Path::new(&install_path);
    if path.exists() {
        std::fs::remove_dir_all(path).map_err(|e| e.to_string())?;
    }

    database::remove_installed_addon(addon_id)?;

    Ok(())
}

pub fn enable_addon(addon_id: &str) -> Result<(), String> {
    let addon = database::get_installed_addon_by_id(addon_id)?
        .ok_or_else(|| format!("Addon '{}' not found", addon_id))?;
    if addon.enabled {
        return Ok(());
    }
    database::set_addon_enabled(addon_id, true)
}

pub fn disable_addon(addon_id: &str) -> Result<(), String> {
    let addon = database::get_installed_addon_by_id(addon_id)?
        .ok_or_else(|| format!("Addon '{}' not found", addon_id))?;
    if !addon.enabled {
        return Ok(());
    }
    database::set_addon_enabled(addon_id, false)
}

pub fn update_addon(
    addon_id: &str,
    new_version: &str,
    entry: &AddonCatalogEntry,
    archive_data: &[u8],
) -> Result<InstalledAddon, String> {
    let current = database::get_installed_addon_by_id(addon_id)?
        .ok_or_else(|| format!("Addon '{}' not found", addon_id))?;

    let install_addon_result = install_addon(entry, new_version, archive_data);

    match install_addon_result {
        Ok(installed) => Ok(installed),
        Err(e) => {
            log::warn!("Addon update failed, preserving existing installation: {}", e);
            let _ = database::set_addon_enabled(addon_id, current.enabled);
            Err(e)
        }
    }
}
