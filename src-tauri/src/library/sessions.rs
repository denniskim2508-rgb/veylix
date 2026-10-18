use crate::core::db::get_db;
use rusqlite::params;
use super::models::PlaySessionRow;

pub fn insert_play_session(game_id: i64, started_at: &str) -> rusqlite::Result<i64> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    conn.execute(
        "INSERT INTO play_sessions (game_id, started_at) VALUES (?1, ?2)",
        params![game_id, started_at],
    )?;

    Ok(conn.last_insert_rowid())
}

pub fn end_play_session(session_id: i64, ended_at: &str, duration_minutes: i64) -> rusqlite::Result<()> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    conn.execute(
        "UPDATE play_sessions SET ended_at = ?1, duration_minutes = ?2 WHERE id = ?3",
        params![ended_at, duration_minutes, session_id],
    )?;

    Ok(())
}

pub fn get_play_sessions(game_id: i64) -> rusqlite::Result<Vec<PlaySessionRow>> {
    let db = get_db();
    let conn = db.as_ref().unwrap();

    let mut stmt = conn.prepare(
        "SELECT id, game_id, started_at, ended_at, duration_minutes
         FROM play_sessions WHERE game_id = ?1 ORDER BY started_at DESC"
    )?;

    let sessions = stmt.query_map(params![game_id], |row| {
        Ok(PlaySessionRow {
            id: row.get(0)?,
            game_id: row.get(1)?,
            started_at: row.get(2)?,
            ended_at: row.get(3)?,
            duration_minutes: row.get(4)?,
        })
    })?.collect::<rusqlite::Result<Vec<_>>>()?;

    Ok(sessions)
}
