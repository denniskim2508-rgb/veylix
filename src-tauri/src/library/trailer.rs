use std::path::Path;

pub const SUPPORTED_TRAILER_EXTENSIONS: &[&str] = &["mp4", "webm", "mkv", "mov", "avi", "m4v", "ogv"];

pub const SUPPORTED_WALLPAPER_IMAGE_EXTENSIONS: &[&str] =
    &["png", "jpg", "jpeg", "webp", "bmp", "gif"];

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrailerProbe {
    pub valid: bool,
    pub exists: bool,
    pub path: String,
    pub file_name: String,
    pub size_bytes: u64,
    pub extension: String,
    pub error: Option<String>,
}

pub fn normalize_extension(path: &str) -> String {
    Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default()
}

pub fn probe_trailer(path: &str) -> TrailerProbe {
    let path_str = path.to_string();
    let exists = Path::new(path).is_file();
    let file_name = Path::new(path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();
    let extension = normalize_extension(path);

    if !exists {
        return TrailerProbe {
            valid: false,
            exists: false,
            path: path_str,
            file_name,
            size_bytes: 0,
            extension: extension.clone(),
            error: Some(format!("File not found: {}", path)),
        };
    }

    if extension.is_empty()
        || !SUPPORTED_TRAILER_EXTENSIONS.contains(&extension.as_str())
    {
        return TrailerProbe {
            valid: false,
            exists: true,
            path: path_str,
            file_name,
            size_bytes: 0,
            extension: extension.clone(),
            error: Some(format!(
                "Unsupported video format '.{}'. Supported formats: MP4, WebM, MKV, MOV, AVI, M4V, OGV",
                extension
            )),
        };
    }

    let size_bytes = std::fs::metadata(path)
        .map(|m| m.len())
        .unwrap_or(0);

    TrailerProbe {
        valid: true,
        exists: true,
        path: path_str,
        file_name,
        size_bytes,
        extension,
        error: None,
    }
}

/// Validate a global Console wallpaper file (image or video). Reuses the
/// `TrailerProbe` shape so the frontend can share its status/preview UI. Files
/// are only referenced by path, never copied, so external drives work.
pub fn probe_wallpaper(path: &str) -> TrailerProbe {
    let path_str = path.to_string();
    let exists = Path::new(path).is_file();
    let file_name = Path::new(path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();
    let extension = normalize_extension(path);

    if !exists {
        return TrailerProbe {
            valid: false,
            exists: false,
            path: path_str,
            file_name,
            size_bytes: 0,
            extension,
            error: Some(format!("File not found: {}", path)),
        };
    }

    let is_image = SUPPORTED_WALLPAPER_IMAGE_EXTENSIONS.contains(&extension.as_str());
    let is_video = SUPPORTED_TRAILER_EXTENSIONS.contains(&extension.as_str());

    if extension.is_empty() || (!is_image && !is_video) {
        return TrailerProbe {
            valid: false,
            exists: true,
            path: path_str,
            file_name,
            size_bytes: 0,
            extension: extension.clone(),
            error: Some(format!(
                "Unsupported format '.{}'. Images: PNG, JPG, JPEG, WebP, BMP, GIF. Video: MP4, WebM, MKV, MOV, AVI, M4V, OGV",
                extension
            )),
        };
    }

    let size_bytes = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);

    TrailerProbe {
        valid: true,
        exists: true,
        path: path_str,
        file_name,
        size_bytes,
        extension,
        error: None,
    }
}

pub fn is_media_url_video(url: &str) -> bool {
    let lower = url.to_ascii_lowercase();
    SUPPORTED_TRAILER_EXTENSIONS
        .iter()
        .any(|ext| lower.ends_with(&format!(".{}", ext)))
}

/// Attempt to discover a trailer for a game from existing metadata/artwork
/// records that point directly at a playable video file. This intentionally
/// avoids embedding third-party players (e.g. YouTube) and instead only
/// returns direct sources.
pub fn find_auto_trailer(game_id: i64) -> Option<String> {
    let db = crate::core::db::get_db();
    let conn = db.as_ref().unwrap();

    let mut stmt = conn
        .prepare(
            "SELECT url, cached_path FROM game_artwork
             WHERE game_id = ?1
               AND (artwork_type IN ('video', 'trailer') OR lower(url) LIKE '%.mp4' OR lower(url) LIKE '%.webm' OR lower(url) LIKE '%.mkv' OR lower(url) LIKE '%.mov' OR lower(url) LIKE '%.m4v')
             ORDER BY is_primary DESC, score DESC LIMIT 5",
        )
        .ok()?;

    let rows = stmt
        .query_map(rusqlite::params![game_id], |row| {
            let url: String = row.get(0)?;
            let cached_path: Option<String> = row.get(1)?;
            Ok((url, cached_path))
        })
        .ok()?;

    for row in rows.flatten() {
        if let Some(cached) = &row.1 {
            if Path::new(cached).is_file() {
                return Some(cached.clone());
            }
        }
        if is_media_url_video(&row.0) {
            let url = row.0.to_ascii_lowercase();
            if url.starts_with("file://") {
                let local = url.trim_start_matches("file://");
                let local = local.strip_prefix("localhost").unwrap_or(local);
                if Path::new(local).is_file() {
                    return Some(local.to_string());
                }
            } else if url.starts_with("http://") || url.starts_with("https://") {
                return Some(row.0.clone());
            }
        }
    }

    None
}