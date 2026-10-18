#![allow(dead_code)]

use crate::core::db;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginSettings {
    pub plugin_id: String,
    pub settings: HashMap<String, serde_json::Value>,
}

pub fn load_plugin_settings(plugin_id: &str) -> HashMap<String, serde_json::Value> {
    let db = db::get_db();
    let conn = db.as_ref().unwrap();

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS plugin_settings (
            plugin_id TEXT PRIMARY KEY,
            settings_json TEXT NOT NULL
        );"
    ).ok();

    let mut stmt = conn
        .prepare("SELECT settings_json FROM plugin_settings WHERE plugin_id = ?1")
        .unwrap();

    let result = stmt.query_row(rusqlite::params![plugin_id], |row| {
        let json: String = row.get(0)?;
        Ok(json)
    });

    match result {
        Ok(json) => serde_json::from_str(&json).unwrap_or_default(),
        Err(_) => HashMap::new(),
    }
}

pub fn save_plugin_settings(plugin_id: &str, settings: &HashMap<String, serde_json::Value>) {
    let db = db::get_db();
    let conn = db.as_ref().unwrap();

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS plugin_settings (
            plugin_id TEXT PRIMARY KEY,
            settings_json TEXT NOT NULL
        );"
    ).ok();

    let json = serde_json::to_string(settings).unwrap_or_default();

    conn.execute(
        "INSERT OR REPLACE INTO plugin_settings (plugin_id, settings_json) VALUES (?1, ?2)",
        rusqlite::params![plugin_id, json],
    ).ok();
}

pub fn get_all_plugin_settings() -> Vec<PluginSettings> {
    let db = db::get_db();
    let conn = db.as_ref().unwrap();

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS plugin_settings (
            plugin_id TEXT PRIMARY KEY,
            settings_json TEXT NOT NULL
        );"
    ).ok();

    let mut stmt = conn
        .prepare("SELECT plugin_id, settings_json FROM plugin_settings")
        .unwrap();

    let rows = stmt
        .query_map([], |row| {
            let plugin_id: String = row.get(0)?;
            let json: String = row.get(1)?;
            Ok((plugin_id, json))
        })
        .unwrap();

    let mut results = Vec::new();
    for row in rows {
        if let Ok((plugin_id, json)) = row {
            let settings: HashMap<String, serde_json::Value> =
                serde_json::from_str(&json).unwrap_or_default();
            results.push(PluginSettings {
                plugin_id,
                settings,
            });
        }
    }

    results
}

pub fn delete_plugin_settings(plugin_id: &str) {
    let db = db::get_db();
    let conn = db.as_ref().unwrap();

    conn.execute(
        "DELETE FROM plugin_settings WHERE plugin_id = ?1",
        rusqlite::params![plugin_id],
    ).ok();
}
