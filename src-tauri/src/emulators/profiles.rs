use crate::core::db::get_db;
use rusqlite::params;
use super::models::EmulatorRow;

pub fn get_all_emulators() -> rusqlite::Result<Vec<EmulatorRow>> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    let mut stmt = conn.prepare(
        "SELECT id, name, executable_path, platform, command_template,
                supported_extensions, default_args, is_installed, icon, core_path
         FROM emulators ORDER BY name"
    )?;

    let emulators = stmt.query_map([], |row| {
        Ok(EmulatorRow {
            id: row.get(0)?,
            name: row.get(1)?,
            executable_path: row.get(2)?,
            platform: row.get(3)?,
            command_template: row.get(4)?,
            supported_extensions: row.get(5)?,
            default_args: row.get(6)?,
            is_installed: row.get::<_, i64>(7)? != 0,
            icon: row.get(8)?,
            core_path: row.get(9)?,
        })
    })?.collect::<rusqlite::Result<Vec<_>>>()?;

    Ok(emulators)
}

pub fn insert_emulator(
    name: &str,
    executable_path: &str,
    platform: &str,
    command_template: Option<&str>,
    supported_extensions: Option<&str>,
    default_args: Option<&str>,
    is_installed: bool,
    icon: Option<&str>,
    core_path: Option<&str>,
) -> rusqlite::Result<i64> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    conn.execute(
        "INSERT INTO emulators (name, executable_path, platform, command_template, supported_extensions, default_args, is_installed, icon, core_path)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![name, executable_path, platform, command_template, supported_extensions, default_args, is_installed as i64, icon, core_path],
    )?;

    Ok(conn.last_insert_rowid())
}

pub fn update_emulator(
    id: i64,
    name: &str,
    executable_path: &str,
    platform: &str,
    command_template: Option<&str>,
    supported_extensions: Option<&str>,
    default_args: Option<&str>,
    is_installed: bool,
    icon: Option<&str>,
    core_path: Option<&str>,
) -> rusqlite::Result<()> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    conn.execute(
        "UPDATE emulators SET name = ?1, executable_path = ?2, platform = ?3, command_template = ?4,
         supported_extensions = ?5, default_args = ?6, is_installed = ?7, icon = ?8, core_path = ?9 WHERE id = ?10",
        params![name, executable_path, platform, command_template, supported_extensions, default_args, is_installed as i64, icon, core_path, id],
    )?;

    Ok(())
}

pub fn delete_emulator(id: i64) -> rusqlite::Result<()> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    conn.execute("UPDATE rom_files SET emulator_id = NULL WHERE emulator_id = ?1", params![id])?;
    conn.execute("DELETE FROM emulators WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn get_emulators_for_extension(ext: &str) -> rusqlite::Result<Vec<EmulatorRow>> {
    let all = get_all_emulators()?;
    let ext_lower = ext.to_lowercase();

    let matching: Vec<EmulatorRow> = all.into_iter().filter(|e| {
        e.supported_extensions
            .as_ref()
            .map(|exts| exts.split(',').any(|e| e.trim().eq_ignore_ascii_case(&ext_lower)))
            .unwrap_or(false)
    }).collect();

    Ok(matching)
}
