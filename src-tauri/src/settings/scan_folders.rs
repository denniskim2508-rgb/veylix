use crate::core::db::get_db;
use rusqlite::params;
use super::models::ScanFolderRow;

pub fn get_scan_folders() -> rusqlite::Result<Vec<ScanFolderRow>> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS scan_folders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT NOT NULL UNIQUE,
            label TEXT
        );"
    )?;

    let mut stmt = conn.prepare(
        "SELECT id, path, label FROM scan_folders ORDER BY path"
    )?;

    let folders = stmt.query_map([], |row| {
        Ok(ScanFolderRow {
            id: row.get(0)?,
            path: row.get(1)?,
            label: row.get(2)?,
        })
    })?.collect::<rusqlite::Result<Vec<_>>>()?;

    Ok(folders)
}

pub fn add_scan_folder(path: &str, label: Option<&str>) -> rusqlite::Result<i64> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS scan_folders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT NOT NULL UNIQUE,
            label TEXT
        );"
    )?;

    conn.execute(
        "INSERT OR IGNORE INTO scan_folders (path, label) VALUES (?1, ?2)",
        params![path, label],
    )?;

    Ok(conn.last_insert_rowid())
}

pub fn remove_scan_folder(id: i64) -> rusqlite::Result<()> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    conn.execute("DELETE FROM scan_folders WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn get_scan_folder_paths() -> rusqlite::Result<Vec<String>> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS scan_folders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT NOT NULL UNIQUE,
            label TEXT
        );"
    )?;

    let mut stmt = conn.prepare("SELECT path FROM scan_folders")?;
    let paths = stmt.query_map([], |row| row.get(0))?.collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(paths)
}
