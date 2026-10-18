use crate::core::db;
use super::models::{InstalledAddon, AddonType};

pub fn insert_installed_addon(addon: &InstalledAddon) -> Result<(), String> {
    let db = db::get_db();
    let conn = db.as_ref().ok_or("Database not initialized")?;

    conn.execute(
        "INSERT OR REPLACE INTO installed_addons (id, name, type, version, author, description, enabled, installed_at, updated_at, install_path, source_url)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        rusqlite::params![
            addon.id,
            addon.name,
            addon.addon_type.as_str(),
            addon.version,
            addon.author,
            addon.description,
            addon.enabled as i32,
            addon.installed_at,
            addon.updated_at,
            addon.install_path,
            addon.source_url,
        ],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

pub fn get_installed_addons() -> Result<Vec<InstalledAddon>, String> {
    let db = db::get_db();
    let conn = db.as_ref().ok_or("Database not initialized")?;

    let mut stmt = conn
        .prepare(
            "SELECT id, name, type, version, author, description, enabled, installed_at, updated_at, install_path, source_url
             FROM installed_addons ORDER BY name",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let addon_type_str: String = row.get(2)?;
            let addon_type = AddonType::from_str(&addon_type_str)
                .unwrap_or(AddonType::Generic);
            let enabled_int: i32 = row.get(6)?;

            Ok(InstalledAddon {
                id: row.get(0)?,
                name: row.get(1)?,
                addon_type,
                version: row.get(3)?,
                author: row.get(4)?,
                description: row.get(5)?,
                enabled: enabled_int != 0,
                installed_at: row.get(7)?,
                updated_at: row.get(8)?,
                install_path: row.get(9)?,
                source_url: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for row in rows {
        if let Ok(addon) = row {
            results.push(addon);
        }
    }
    Ok(results)
}

pub fn get_installed_addon_by_id(addon_id: &str) -> Result<Option<InstalledAddon>, String> {
    let db = db::get_db();
    let conn = db.as_ref().ok_or("Database not initialized")?;

    let mut stmt = conn
        .prepare(
            "SELECT id, name, type, version, author, description, enabled, installed_at, updated_at, install_path, source_url
             FROM installed_addons WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let result = stmt.query_row(rusqlite::params![addon_id], |row| {
        let addon_type_str: String = row.get(2)?;
        let addon_type = AddonType::from_str(&addon_type_str)
            .unwrap_or(AddonType::Generic);
        let enabled_int: i32 = row.get(6)?;

        Ok(InstalledAddon {
            id: row.get(0)?,
            name: row.get(1)?,
            addon_type,
            version: row.get(3)?,
            author: row.get(4)?,
            description: row.get(5)?,
            enabled: enabled_int != 0,
            installed_at: row.get(7)?,
            updated_at: row.get(8)?,
            install_path: row.get(9)?,
            source_url: row.get(10)?,
        })
    });

    match result {
        Ok(addon) => Ok(Some(addon)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

pub fn update_addon_version(addon_id: &str, version: &str) -> Result<(), String> {
    let db = db::get_db();
    let conn = db.as_ref().ok_or("Database not initialized")?;

    conn.execute(
        "UPDATE installed_addons SET version = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
        rusqlite::params![version, addon_id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

pub fn set_addon_enabled(addon_id: &str, enabled: bool) -> Result<(), String> {
    let db = db::get_db();
    let conn = db.as_ref().ok_or("Database not initialized")?;

    conn.execute(
        "UPDATE installed_addons SET enabled = ?1 WHERE id = ?2",
        rusqlite::params![enabled as i32, addon_id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

pub fn remove_installed_addon(addon_id: &str) -> Result<(), String> {
    let db = db::get_db();
    let conn = db.as_ref().ok_or("Database not initialized")?;

    conn.execute(
        "DELETE FROM installed_addons WHERE id = ?1",
        rusqlite::params![addon_id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

pub fn get_addon_install_path(addon_id: &str) -> Result<Option<String>, String> {
    let db = db::get_db();
    let conn = db.as_ref().ok_or("Database not initialized")?;

    let result = conn.query_row(
        "SELECT install_path FROM installed_addons WHERE id = ?1",
        rusqlite::params![addon_id],
        |row| row.get::<_, String>(0),
    );

    match result {
        Ok(path) => Ok(Some(path)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}
