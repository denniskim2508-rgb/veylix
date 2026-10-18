use crate::core::db::get_db;
use std::collections::HashMap;

pub fn get_setting(key: &str) -> Option<String> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    let result = conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        rusqlite::params![key],
        |row| row.get::<_, Option<String>>(0),
    );

    match result {
        Ok(Some(value)) => Some(value),
        _ => None,
    }
}

pub fn set_setting(key: &str, value: &str) {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        rusqlite::params![key, value],
    )
    .ok();
}

pub fn get_all_settings() -> HashMap<String, String> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    let mut stmt = match conn.prepare("SELECT key, value FROM settings") {
        Ok(s) => s,
        Err(_) => return HashMap::new(),
    };

    let rows = match stmt.query_map([], |row| {
        let key: String = row.get(0)?;
        let value: String = row.get(1)?;
        Ok((key, value))
    }) {
        Ok(rows) => rows,
        Err(_) => return HashMap::new(),
    };

    let mut result = HashMap::new();
    for row in rows.flatten() {
        result.insert(row.0, row.1);
    }
    result
}