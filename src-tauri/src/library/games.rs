use crate::core::db::get_db;
use rusqlite::params;
use super::models::{GameRow, GameUpdate};

pub fn get_all_games() -> rusqlite::Result<Vec<GameRow>> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    let mut stmt = conn.prepare(
        "SELECT id, title, platform, install_path, executable_path, cover_image,
                background_image, description, release_date, genre, developer, publisher,
                play_time, last_played, is_installed, is_favorite, platform_game_id,
                launch_command, drive_letter, icon, logo, trailer_path, trailer_source,
                created_at, updated_at
         FROM games ORDER BY title"
    )?;

    let games = stmt.query_map([], |row| {
        Ok(GameRow {
            id: row.get(0)?,
            title: row.get(1)?,
            platform: row.get(2)?,
            install_path: row.get(3)?,
            executable_path: row.get(4)?,
            cover_image: row.get(5)?,
            background_image: row.get(6)?,
            description: row.get(7)?,
            release_date: row.get(8)?,
            genre: row.get(9)?,
            developer: row.get(10)?,
            publisher: row.get(11)?,
            play_time: row.get(12)?,
            last_played: row.get(13)?,
            is_installed: row.get::<_, i64>(14)? != 0,
            is_favorite: row.get::<_, i64>(15)? != 0,
            platform_game_id: row.get(16)?,
            launch_command: row.get(17)?,
            drive_letter: row.get(18)?,
            icon: row.get(19)?,
            logo: row.get(20)?,
            trailer_path: row.get(21)?,
            trailer_source: row.get(22)?,
            created_at: row.get(23)?,
            updated_at: row.get(24)?,
        })
    })?.collect::<rusqlite::Result<Vec<_>>>()?;

    Ok(games)
}

pub fn insert_game(
    title: &str,
    platform: &str,
    install_path: Option<&str>,
    executable_path: Option<&str>,
    platform_game_id: Option<&str>,
    launch_command: Option<&str>,
    drive_letter: Option<&str>,
) -> rusqlite::Result<i64> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    conn.execute(
        "INSERT INTO games (title, platform, install_path, executable_path, platform_game_id, launch_command, drive_letter, is_installed)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1)",
        params![title, platform, install_path, executable_path, platform_game_id, launch_command, drive_letter],
    )?;

    Ok(conn.last_insert_rowid())
}

pub fn update_game(game_id: i64, update: &GameUpdate) -> rusqlite::Result<()> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    let mut sets = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut idx = 1;

    macro_rules! maybe_set {
        ($field:expr, $col:expr) => {
            if let Some(ref val) = $field {
                sets.push(format!("{} = ?{}", $col, idx));
                values.push(Box::new(val.clone()));
                idx += 1;
            }
        };
    }

    maybe_set!(update.title, "title");
    maybe_set!(update.description, "description");
    maybe_set!(update.genre, "genre");
    maybe_set!(update.developer, "developer");
    maybe_set!(update.publisher, "publisher");
    maybe_set!(update.release_date, "release_date");
    maybe_set!(update.cover_image, "cover_image");
    maybe_set!(update.background_image, "background_image");
    maybe_set!(update.icon, "icon");
    maybe_set!(update.logo, "logo");
    maybe_set!(update.trailer_path, "trailer_path");
    maybe_set!(update.trailer_source, "trailer_source");

    if sets.is_empty() {
        return Ok(());
    }

    sets.push(format!("updated_at = CURRENT_TIMESTAMP"));
    let sql = format!("UPDATE games SET {} WHERE id = ?{}", sets.join(", "), idx);
    values.push(Box::new(game_id));

    let params_ref: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    conn.execute(&sql, params_ref.as_slice())?;

    Ok(())
}

pub fn toggle_favorite(game_id: i64) -> rusqlite::Result<()> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    conn.execute(
        "UPDATE games SET is_favorite = NOT is_favorite, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
        params![game_id],
    )?;

    Ok(())
}

pub fn delete_game(game_id: i64) -> rusqlite::Result<()> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    conn.execute("DELETE FROM play_sessions WHERE game_id = ?1", params![game_id])?;
    conn.execute("DELETE FROM game_screenshots WHERE game_id = ?1", params![game_id])?;
    conn.execute("DELETE FROM rom_files WHERE game_id = ?1", params![game_id])?;
    conn.execute("DELETE FROM games WHERE id = ?1", params![game_id])?;
    Ok(())
}

pub fn game_exists(platform: &str, platform_game_id: &str) -> rusqlite::Result<bool> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    let mut stmt = conn.prepare(
        "SELECT COUNT(*) FROM games WHERE platform = ?1 AND platform_game_id = ?2"
    )?;

    let count: i64 = stmt.query_row(params![platform, platform_game_id], |row| row.get(0))?;
    Ok(count > 0)
}

pub fn update_game_executable(platform: &str, platform_game_id: &str, executable_path: Option<&str>) -> rusqlite::Result<()> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    if let Some(exe) = executable_path {
        conn.execute(
            "UPDATE games SET executable_path = ?1, launch_command = ?1 WHERE platform = ?2 AND platform_game_id = ?3 AND (executable_path IS NULL OR executable_path = '')",
            params![exe, platform, platform_game_id],
        )?;
    }
    Ok(())
}

pub fn update_game_playtime(game_id: i64, play_time: i64, last_played: &str) -> rusqlite::Result<()> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    conn.execute(
        "UPDATE games SET play_time = ?1, last_played = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?3",
        params![play_time, last_played, game_id],
    )?;

    Ok(())
}

pub fn set_game_emulator_override(game_id: i64, emulator_id: Option<i64>) -> rusqlite::Result<()> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    conn.execute(
        "UPDATE games SET override_emulator_id = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
        params![emulator_id, game_id],
    )?;

    Ok(())
}

pub fn set_game_trailer(game_id: i64, path: &str, source: &str) -> rusqlite::Result<()> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    conn.execute(
        "UPDATE games SET trailer_path = ?1, trailer_source = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?3",
        params![path, source, game_id],
    )?;

    Ok(())
}

pub fn clear_game_trailer(game_id: i64) -> rusqlite::Result<()> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    conn.execute(
        "UPDATE games SET trailer_path = NULL, trailer_source = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
        params![game_id],
    )?;

    Ok(())
}

pub fn get_game_trailer(game_id: i64) -> rusqlite::Result<Option<(Option<String>, Option<String>)>> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    let mut stmt = conn.prepare(
        "SELECT trailer_path, trailer_source FROM games WHERE id = ?1"
    )?;

    let result = stmt.query_row(params![game_id], |row| {
        Ok((row.get::<_, Option<String>>(0)?, row.get::<_, Option<String>>(1)?))
    });

    match result {
        Ok(tuple) => Ok(Some(tuple)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn get_game_rom_extension(game_id: i64) -> rusqlite::Result<Option<String>> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    let mut stmt = conn.prepare(
        "SELECT file_path FROM rom_files WHERE game_id = ?1 LIMIT 1"
    )?;

    let result = stmt.query_row(params![game_id], |row| {
        let path: String = row.get(0)?;
        Ok(path)
    });

    match result {
        Ok(path) => {
            let ext = std::path::Path::new(&path)
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| format!(".{}", e.to_lowercase()));
            Ok(ext)
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}
