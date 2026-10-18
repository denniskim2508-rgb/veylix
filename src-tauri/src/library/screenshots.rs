use crate::core::db::get_db;
use rusqlite::params;
use super::models::ScreenshotRow;

pub fn get_game_screenshots(game_id: i64) -> rusqlite::Result<Vec<ScreenshotRow>> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    let mut stmt = conn.prepare(
        "SELECT id, game_id, url, local_path, sort_order
         FROM game_screenshots WHERE game_id = ?1 ORDER BY sort_order"
    )?;

    let screenshots = stmt.query_map(params![game_id], |row| {
        Ok(ScreenshotRow {
            id: row.get(0)?,
            game_id: row.get(1)?,
            url: row.get(2)?,
            local_path: row.get(3)?,
            sort_order: row.get(4)?,
        })
    })?.collect::<rusqlite::Result<Vec<_>>>()?;

    Ok(screenshots)
}

pub fn insert_screenshot(
    game_id: i64,
    url: &str,
    local_path: Option<&str>,
    sort_order: i64,
) -> rusqlite::Result<i64> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    conn.execute(
        "INSERT INTO game_screenshots (game_id, url, local_path, sort_order)
         VALUES (?1, ?2, ?3, ?4)",
        params![game_id, url, local_path, sort_order],
    )?;

    Ok(conn.last_insert_rowid())
}

pub fn delete_screenshot(screenshot_id: i64) -> rusqlite::Result<()> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    conn.execute(
        "DELETE FROM game_screenshots WHERE id = ?1",
        params![screenshot_id],
    )?;

    Ok(())
}

pub fn reorder_screenshots(game_id: i64, screenshot_ids: &[i64]) -> rusqlite::Result<()> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    for (idx, &id) in screenshot_ids.iter().enumerate() {
        conn.execute(
            "UPDATE game_screenshots SET sort_order = ?1 WHERE id = ?2 AND game_id = ?3",
            params![idx as i64, id, game_id],
        )?;
    }

    Ok(())
}

pub fn get_screenshot_count(game_id: i64) -> rusqlite::Result<i64> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM game_screenshots WHERE game_id = ?1",
        params![game_id],
        |row| row.get(0),
    )?;

    Ok(count)
}
