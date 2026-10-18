use std::path::PathBuf;

fn get_app_dir() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("gamehub")
}

fn safe_filename(url: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    url.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

fn ext_from_content_type(ct: &str) -> &str {
    if ct.contains("png") { "png" }
    else if ct.contains("gif") { "gif" }
    else if ct.contains("webp") { "webp" }
    else { "jpg" }
}

/// Sniff the real image format from magic bytes. Many image hosts answer with a
/// missing or generic (`application/octet-stream`) content type, so the bytes
/// are the more reliable signal.
fn ext_from_magic(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) {
        Some("png")
    } else if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some("jpg")
    } else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        Some("gif")
    } else if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        Some("webp")
    } else if bytes.starts_with(b"BM") {
        Some("bmp")
    } else {
        None
    }
}

pub async fn download_and_save_artwork(
    url: &str,
    game_id: i64,
    artwork_type: &str,
) -> Result<String, String> {
    // Clean up any existing artwork of this type first
    super::artwork::remove_artwork_file(game_id, artwork_type)?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client.get(url)
        .header("User-Agent", "GameHub/0.1")
        .send()
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }

    let content_type = response.headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    if bytes.len() > 20 * 1024 * 1024 {
        return Err("Image too large (max 20MB)".to_string());
    }
    if bytes.len() < 24 {
        return Err("Downloaded file is too small to be an image".to_string());
    }

    // Prefer what the bytes actually are; fall back to the (possibly generic)
    // content type. Reject responses that are clearly not images so the caller
    // can surface a retry instead of saving a broken file.
    let ext = match ext_from_magic(&bytes) {
        Some(ext) => ext,
        None if content_type.contains("image") => ext_from_content_type(&content_type),
        None => {
            return Err(format!(
                "The original image could not be downloaded (unexpected content: {})",
                if content_type.is_empty() { "unknown" } else { &content_type }
            ))
        }
    };
    let hash = safe_filename(url);
    let filename = format!("{}_{}.{}", artwork_type, hash, ext);

    let artwork_dir = get_app_dir().join("artwork").join(game_id.to_string());
    std::fs::create_dir_all(&artwork_dir).map_err(|e| e.to_string())?;

    let dest = artwork_dir.join(&filename);
    std::fs::write(&dest, &bytes).map_err(|e| e.to_string())?;

    Ok(format!("artwork/{}/{}", game_id, filename))
}

pub async fn download_screenshot(
    url: &str,
    game_id: i64,
    index: usize,
) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client.get(url)
        .header("User-Agent", "GameHub/0.1")
        .send()
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }

    let content_type = response.headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/jpeg")
        .to_string();

    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    if bytes.len() > 20 * 1024 * 1024 {
        return Err("Image too large (max 20MB)".to_string());
    }

    let ext = ext_from_content_type(&content_type);
    let filename = format!("screenshot_{}.{}", index, ext);

    let artwork_dir = get_app_dir().join("artwork").join(game_id.to_string());
    std::fs::create_dir_all(&artwork_dir).map_err(|e| e.to_string())?;

    let dest = artwork_dir.join(&filename);
    std::fs::write(&dest, &bytes).map_err(|e| e.to_string())?;

    Ok(format!("artwork/{}/{}", game_id, filename))
}
