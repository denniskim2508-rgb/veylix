use crate::core::db::get_db;
use rusqlite::params;
use std::collections::HashMap;

#[allow(dead_code)]
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DatEntry {
    pub id: i64,
    pub platform: String,
    pub game_name: String,
    pub description: Option<String>,
    pub rom_name: String,
    pub crc32: String,
    pub rom_size: i64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DatLookupResult {
    pub game_name: String,
    pub description: Option<String>,
    pub platform: String,
    pub rom_name: String,
}

pub fn store_dat_entries(entries: &[(String, String, Option<String>, String, String, i64)]) -> rusqlite::Result<usize> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    let mut inserted = 0;
    for (platform, game_name, description, rom_name, crc32, rom_size) in entries {
        conn.execute(
            "INSERT INTO rom_databases (platform, game_name, description, rom_name, crc32, rom_size)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![platform, game_name, description, rom_name, crc32, rom_size],
        )?;
        inserted += 1;
    }

    Ok(inserted)
}

pub fn lookup_by_crc32(crc32: &str) -> rusqlite::Result<Option<DatLookupResult>> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    let mut stmt = conn.prepare(
        "SELECT game_name, description, platform, rom_name FROM rom_databases WHERE crc32 = ?1 LIMIT 1"
    )?;

    let result = stmt.query_row(params![crc32.to_uppercase()], |row| {
        Ok(DatLookupResult {
            game_name: row.get(0)?,
            description: row.get(1)?,
            platform: row.get(2)?,
            rom_name: row.get(3)?,
        })
    });

    match result {
        Ok(r) => Ok(Some(r)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn lookup_by_rom_name(name: &str) -> rusqlite::Result<Option<DatLookupResult>> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    let mut stmt = conn.prepare(
        "SELECT game_name, description, platform, rom_name FROM rom_databases
         WHERE rom_name = ?1 OR game_name = ?1 LIMIT 1"
    )?;

    let result = stmt.query_row(params![name], |row| {
        Ok(DatLookupResult {
            game_name: row.get(0)?,
            description: row.get(1)?,
            platform: row.get(2)?,
            rom_name: row.get(3)?,
        })
    });

    match result {
        Ok(r) => Ok(Some(r)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

#[allow(dead_code)]
pub fn get_all_dat_entries() -> rusqlite::Result<Vec<DatEntry>> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    let mut stmt = conn.prepare(
        "SELECT id, platform, game_name, description, rom_name, crc32, rom_size
         FROM rom_databases ORDER BY platform, game_name"
    )?;

    let entries = stmt.query_map([], |row| {
        Ok(DatEntry {
            id: row.get(0)?,
            platform: row.get(1)?,
            game_name: row.get(2)?,
            description: row.get(3)?,
            rom_name: row.get(4)?,
            crc32: row.get(5)?,
            rom_size: row.get(6)?,
        })
    })?.collect::<rusqlite::Result<Vec<_>>>()?;

    Ok(entries)
}

pub fn get_dat_entry_count() -> rusqlite::Result<i64> {
    let db = get_db();
    let conn = db.as_ref().unwrap();
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM rom_databases", [], |row| row.get(0))?;
    Ok(count)
}

pub fn clear_dat_database() -> rusqlite::Result<()> {
    let db = get_db();
    let conn = db.as_ref().unwrap();
    conn.execute("DELETE FROM rom_databases", [])?;
    Ok(())
}

pub fn import_dat_file(path: &str) -> Result<usize, String> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| format!("Failed to read DAT file: {}", e))?;

    let database = super::dat_parser::parse_dat_file(&content);

    let entries: Vec<(String, String, Option<String>, String, String, i64)> = database.games.iter().map(|g| {
        (
            database.platform.clone(),
            g.name.clone(),
            if g.description.is_empty() { None } else { Some(g.description.clone()) },
            g.rom_name.clone(),
            g.crc32.clone(),
            g.size as i64,
        )
    }).collect();

    let count = store_dat_entries(&entries).map_err(|e| e.to_string())?;
    Ok(count)
}

/// Build an in-memory CRC32 index from the database for fast lookups
pub fn build_crc_index() -> rusqlite::Result<HashMap<String, DatLookupResult>> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    let mut stmt = conn.prepare(
        "SELECT game_name, description, platform, rom_name, crc32 FROM rom_databases"
    )?;

    let mut index = HashMap::new();
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(4)?,
            DatLookupResult {
                game_name: row.get(0)?,
                description: row.get(1)?,
                platform: row.get(2)?,
                rom_name: row.get(3)?,
            },
        ))
    })?;

    for row in rows.flatten() {
        index.insert(row.0.to_uppercase(), row.1);
    }

    Ok(index)
}
