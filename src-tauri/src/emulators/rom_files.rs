use crate::core::db::get_db;
use rusqlite::params;
use super::models::{RomFileRow, RomScanFolderRow};

pub fn rom_file_exists(file_path: &str) -> rusqlite::Result<bool> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    let mut stmt = conn.prepare(
        "SELECT COUNT(*) FROM rom_files WHERE file_path = ?1"
    )?;

    let count: i64 = stmt.query_row(params![file_path], |row| row.get(0))?;
    Ok(count > 0)
}

pub fn insert_rom_file(game_id: i64, emulator_id: Option<i64>, file_path: &str, file_name: &str, file_size: i64) -> rusqlite::Result<i64> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    conn.execute(
        "INSERT INTO rom_files (game_id, emulator_id, file_path, file_name, file_size)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![game_id, emulator_id, file_path, file_name, file_size],
    )?;

    Ok(conn.last_insert_rowid())
}

#[allow(dead_code)]
pub fn get_rom_file_for_game(game_id: i64) -> rusqlite::Result<Option<RomFileRow>> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    let mut stmt = conn.prepare(
        "SELECT id, game_id, emulator_id, file_path, file_name, file_size
         FROM rom_files WHERE game_id = ?1 LIMIT 1"
    )?;

    let result = stmt.query_row(params![game_id], |row| {
        Ok(RomFileRow {
            id: row.get(0)?,
            game_id: row.get(1)?,
            emulator_id: row.get(2)?,
            file_path: row.get(3)?,
            file_name: row.get(4)?,
            file_size: row.get(5)?,
        })
    });

    match result {
        Ok(row) => Ok(Some(row)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn get_rom_scan_folders() -> rusqlite::Result<Vec<RomScanFolderRow>> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    let mut stmt = conn.prepare(
        "SELECT id, path, label, emulator_id FROM rom_scan_folders ORDER BY path"
    )?;

    let folders = stmt.query_map([], |row| {
        Ok(RomScanFolderRow {
            id: row.get(0)?,
            path: row.get(1)?,
            label: row.get(2)?,
            emulator_id: row.get(3)?,
        })
    })?.collect::<rusqlite::Result<Vec<_>>>()?;

    Ok(folders)
}

pub fn add_rom_scan_folder(path: &str, label: Option<&str>, emulator_id: Option<i64>) -> rusqlite::Result<i64> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    conn.execute(
        "INSERT OR IGNORE INTO rom_scan_folders (path, label, emulator_id) VALUES (?1, ?2, ?3)",
        params![path, label, emulator_id],
    )?;

    Ok(conn.last_insert_rowid())
}

pub fn remove_rom_scan_folder(id: i64) -> rusqlite::Result<()> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    conn.execute("DELETE FROM rom_scan_folders WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn get_rom_scan_folder_paths() -> rusqlite::Result<Vec<String>> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    let mut stmt = conn.prepare("SELECT path FROM rom_scan_folders")?;
    let paths = stmt.query_map([], |row| row.get(0))?.collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(paths)
}
