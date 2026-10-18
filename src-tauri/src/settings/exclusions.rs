use crate::core::db::get_db;
use rusqlite::params;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanExclusion {
    pub id: i64,
    pub pattern: String,
    pub exclusion_type: String,
    pub is_regex: bool,
}

pub fn get_scan_exclusions() -> rusqlite::Result<Vec<ScanExclusion>> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    let mut stmt = conn.prepare(
        "SELECT id, pattern, exclusion_type, is_regex FROM scan_exclusions ORDER BY pattern"
    )?;

    let exclusions = stmt.query_map([], |row| {
        Ok(ScanExclusion {
            id: row.get(0)?,
            pattern: row.get(1)?,
            exclusion_type: row.get(2)?,
            is_regex: row.get::<_, i64>(3)? != 0,
        })
    })?.collect::<rusqlite::Result<Vec<_>>>()?;

    Ok(exclusions)
}

pub fn add_scan_exclusion(pattern: &str, exclusion_type: &str, is_regex: bool) -> rusqlite::Result<i64> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    conn.execute(
        "INSERT INTO scan_exclusions (pattern, exclusion_type, is_regex) VALUES (?1, ?2, ?3)",
        params![pattern, exclusion_type, is_regex as i64],
    )?;

    Ok(conn.last_insert_rowid())
}

pub fn remove_scan_exclusion(id: i64) -> rusqlite::Result<()> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    conn.execute("DELETE FROM scan_exclusions WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn is_path_excluded(path_str: &str, exclusions: &[ScanExclusion]) -> bool {
    let path_lower = path_str.to_lowercase();

    for exc in exclusions {
        match exc.exclusion_type.as_str() {
            "path" => {
                // Exact path match (case-insensitive)
                if path_lower == exc.pattern.to_lowercase() {
                    return true;
                }
                // Also check if path contains the pattern
                if path_lower.contains(&exc.pattern.to_lowercase()) {
                    return true;
                }
            }
            "extension" => {
                if let Some(ext) = std::path::Path::new(path_str)
                    .extension()
                    .and_then(|e| e.to_str())
                {
                    let ext_with_dot = format!(".{}", ext.to_lowercase());
                    if ext_with_dot == exc.pattern.to_lowercase() {
                        return true;
                    }
                }
            }
            "contains" => {
                if path_lower.contains(&exc.pattern.to_lowercase()) {
                    return true;
                }
            }
            _ => {}
        }
    }
    false
}
