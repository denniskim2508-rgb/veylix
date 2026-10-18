use crate::core::db::get_db;
use rusqlite::params;
use super::models::*;

pub fn upsert_external_id(game_id: i64, provider: &str, external_id: &str) -> rusqlite::Result<()> {
    let db = get_db();
    let conn = db.as_ref().unwrap();
    conn.execute(
        "INSERT INTO game_external_ids (game_id, provider, external_id) VALUES (?1, ?2, ?3)
         ON CONFLICT(game_id, provider) DO UPDATE SET external_id = excluded.external_id",
        params![game_id, provider, external_id],
    )?;
    Ok(())
}

pub fn get_external_ids(game_id: i64) -> rusqlite::Result<Vec<ExternalId>> {
    let db = get_db();
    let conn = db.as_ref().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, game_id, provider, external_id FROM game_external_ids WHERE game_id = ?1"
    )?;
    let rows = stmt.query_map(params![game_id], |row| {
        Ok(ExternalId {
            id: row.get(0)?,
            game_id: row.get(1)?,
            provider: row.get(2)?,
            external_id: row.get(3)?,
        })
    })?;
    rows.collect()
}

pub fn find_game_by_external_id(provider: &str, external_id: &str) -> rusqlite::Result<Option<i64>> {
    let db = get_db();
    let conn = db.as_ref().unwrap();
    let mut stmt = conn.prepare(
        "SELECT game_id FROM game_external_ids WHERE provider = ?1 AND external_id = ?2 LIMIT 1"
    )?;
    let result = stmt.query_row(params![provider, external_id], |row| row.get(0));
    match result {
        Ok(id) => Ok(Some(id)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn insert_artwork_candidate(
    game_id: i64,
    artwork_type: &str,
    url: &str,
    thumbnail_url: Option<&str>,
    width: i32,
    height: i32,
    provider: &str,
    provider_asset_id: Option<&str>,
    score: f64,
    is_primary: bool,
) -> rusqlite::Result<i64> {
    let db = get_db();
    let conn = db.as_ref().unwrap();
    conn.execute(
        "INSERT INTO game_artwork (game_id, artwork_type, url, thumbnail_url, width, height, provider, provider_asset_id, score, is_primary)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
         ON CONFLICT(provider, provider_asset_id) DO UPDATE SET
            url = excluded.url,
            thumbnail_url = excluded.thumbnail_url,
            width = excluded.width,
            height = excluded.height,
            score = excluded.score,
            is_primary = excluded.is_primary,
            updated_at = CURRENT_TIMESTAMP",
        params![game_id, artwork_type, url, thumbnail_url, width, height, provider, provider_asset_id, score, is_primary as i64],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get_artwork_candidates(game_id: i64, artwork_type: &str) -> rusqlite::Result<Vec<GameArtworkCandidate>> {
    let db = get_db();
    let conn = db.as_ref().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, game_id, artwork_type, url, thumbnail_url, width, height, provider, provider_asset_id,
                score, is_primary, selection_mode, cached_path, created_at, updated_at
         FROM game_artwork WHERE game_id = ?1 AND artwork_type = ?2
         ORDER BY score DESC, is_primary DESC"
    )?;
    let rows = stmt.query_map(params![game_id, artwork_type], |row| {
        Ok(GameArtworkCandidate {
            id: row.get(0)?,
            game_id: row.get(1)?,
            artwork_type: row.get(2)?,
            url: row.get(3)?,
            thumbnail_url: row.get(4)?,
            width: row.get(5)?,
            height: row.get(6)?,
            provider: row.get(7)?,
            provider_asset_id: row.get(8)?,
            score: row.get(9)?,
            is_primary: row.get::<_, i64>(10)? != 0,
            selection_mode: row.get(11)?,
            cached_path: row.get(12)?,
            created_at: row.get(13)?,
            updated_at: row.get(14)?,
        })
    })?;
    rows.collect()
}

pub fn get_primary_artwork(game_id: i64, artwork_type: &str) -> rusqlite::Result<Option<GameArtworkCandidate>> {
    let db = get_db();
    let conn = db.as_ref().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, game_id, artwork_type, url, thumbnail_url, width, height, provider, provider_asset_id,
                score, is_primary, selection_mode, cached_path, created_at, updated_at
         FROM game_artwork WHERE game_id = ?1 AND artwork_type = ?2 AND is_primary = 1
         LIMIT 1"
    )?;
    let result = stmt.query_row(params![game_id, artwork_type], |row| {
        Ok(GameArtworkCandidate {
            id: row.get(0)?,
            game_id: row.get(1)?,
            artwork_type: row.get(2)?,
            url: row.get(3)?,
            thumbnail_url: row.get(4)?,
            width: row.get(5)?,
            height: row.get(6)?,
            provider: row.get(7)?,
            provider_asset_id: row.get(8)?,
            score: row.get(9)?,
            is_primary: row.get::<_, i64>(10)? != 0,
            selection_mode: row.get(11)?,
            cached_path: row.get(12)?,
            created_at: row.get(13)?,
            updated_at: row.get(14)?,
        })
    });
    match result {
        Ok(c) => Ok(Some(c)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn set_primary_artwork(artwork_id: i64, game_id: i64, artwork_type: &str) -> rusqlite::Result<()> {
    let db = get_db();
    let conn = db.as_ref().unwrap();
    conn.execute(
        "UPDATE game_artwork SET is_primary = 0 WHERE game_id = ?1 AND artwork_type = ?2",
        params![game_id, artwork_type],
    )?;
    conn.execute(
        "UPDATE game_artwork SET is_primary = 1, selection_mode = 'manual', updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
        params![artwork_id],
    )?;
    Ok(())
}

pub fn reset_artwork_to_automatic(game_id: i64, artwork_type: &str) -> rusqlite::Result<()> {
    let db = get_db();
    let conn = db.as_ref().unwrap();
    conn.execute(
        "UPDATE game_artwork SET selection_mode = 'automatic', is_primary = 0
         WHERE game_id = ?1 AND artwork_type = ?2 AND selection_mode = 'manual'",
        params![game_id, artwork_type],
    )?;
    Ok(())
}

pub fn delete_artwork_for_game(game_id: i64) -> rusqlite::Result<()> {
    let db = get_db();
    let conn = db.as_ref().unwrap();
    conn.execute("DELETE FROM game_artwork WHERE game_id = ?1", params![game_id])?;
    Ok(())
}

pub fn delete_auto_artwork(game_id: i64, artwork_type: &str) -> rusqlite::Result<()> {
    let db = get_db();
    let conn = db.as_ref().unwrap();
    conn.execute(
        "DELETE FROM game_artwork WHERE game_id = ?1 AND artwork_type = ?2 AND selection_mode != 'manual'",
        params![game_id, artwork_type],
    )?;
    Ok(())
}

pub fn has_manual_artwork(game_id: i64, artwork_type: &str) -> rusqlite::Result<bool> {
    let db = get_db();
    let conn = db.as_ref().unwrap();
    let mut stmt = conn.prepare(
        "SELECT COUNT(*) FROM game_artwork WHERE game_id = ?1 AND artwork_type = ?2 AND selection_mode = 'manual' AND is_primary = 1"
    )?;
    let count: i64 = stmt.query_row(params![game_id, artwork_type], |row| row.get(0))?;
    Ok(count > 0)
}

pub fn get_provider_priorities(category: &str) -> rusqlite::Result<Vec<ProviderPriority>> {
    let db = get_db();
    let conn = db.as_ref().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, category, provider, priority_order, is_enabled FROM provider_priorities
         WHERE category = ?1 ORDER BY priority_order ASC"
    )?;
    let rows = stmt.query_map(params![category], |row| {
        Ok(ProviderPriority {
            id: row.get(0)?,
            category: row.get(1)?,
            provider: row.get(2)?,
            priority_order: row.get(3)?,
            is_enabled: row.get::<_, i64>(4)? != 0,
        })
    })?;
    rows.collect()
}

pub fn set_provider_priorities(category: &str, priorities: &[(String, i32, bool)]) -> rusqlite::Result<()> {
    let db = get_db();
    let conn = db.as_ref().unwrap();
    conn.execute("DELETE FROM provider_priorities WHERE category = ?1", params![category])?;
    for (provider, order, enabled) in priorities {
        conn.execute(
            "INSERT INTO provider_priorities (category, provider, priority_order, is_enabled) VALUES (?1, ?2, ?3, ?4)",
            params![category, provider, order, *enabled as i64],
        )?;
    }
    Ok(())
}

pub fn init_default_priorities() {
    let categories = [
        ("artwork", vec!["steamgriddb", "steam", "igdb", "rawg", "mobygames"]),
        ("metadata", vec!["igdb", "steam", "rawg", "mobygames"]),
        ("cover", vec!["steamgriddb", "steam", "igdb", "rawg", "mobygames"]),
        ("hero", vec!["steamgriddb", "steam", "rawg", "igdb"]),
        ("logo", vec!["steamgriddb", "steam", "igdb", "rawg"]),
        ("background", vec!["steamgriddb", "steam", "rawg", "igdb"]),
        ("screenshot", vec!["igdb", "rawg", "steam", "mobygames"]),
    ];

    let db = get_db();
    let conn = db.as_ref().unwrap();

    // Seed defaults on first run, and top up any providers added since the
    // priorities were last seeded (INSERT OR IGNORE leaves existing rows and
    // user-defined ordering untouched).
    for (category, providers) in &categories {
        for (i, provider) in providers.iter().enumerate() {
            conn.execute(
                "INSERT OR IGNORE INTO provider_priorities (category, provider, priority_order, is_enabled) VALUES (?1, ?2, ?3, 1)",
                params![category, provider, (i + 1) as i32],
            ).ok();
        }
    }
}

pub fn get_cached_response(cache_key: &str) -> rusqlite::Result<Option<(String, String)>> {
    let db = get_db();
    let conn = db.as_ref().unwrap();
    let mut stmt = conn.prepare(
        "SELECT response_json, provider FROM metadata_cache WHERE cache_key = ?1 AND expires_at > datetime('now')"
    )?;
    let result = stmt.query_row(params![cache_key], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    });
    match result {
        Ok(v) => Ok(Some(v)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn save_cached_response(cache_key: &str, provider: &str, response_json: &str, ttl_secs: i64) -> rusqlite::Result<()> {
    let db = get_db();
    let conn = db.as_ref().unwrap();
    conn.execute(
        "INSERT OR REPLACE INTO metadata_cache (cache_key, response_json, provider, expires_at)
         VALUES (?1, ?2, ?3, datetime('now', ?4 || ' seconds'))",
        params![cache_key, provider, response_json, ttl_secs],
    )?;
    Ok(())
}

pub fn cleanup_expired_cache() -> rusqlite::Result<usize> {
    let db = get_db();
    let conn = db.as_ref().unwrap();
    let affected = conn.execute("DELETE FROM metadata_cache WHERE expires_at <= datetime('now')", [])?;
    Ok(affected)
}
