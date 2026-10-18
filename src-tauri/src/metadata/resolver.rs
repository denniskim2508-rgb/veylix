use super::models::*;
use super::traits::*;
use super::database;
use super::provider_registry::ProviderRegistry;
use std::collections::HashSet;
use std::sync::Arc;

static PROBE_CLIENT: once_cell::sync::Lazy<reqwest::Client> = once_cell::sync::Lazy::new(|| {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .user_agent("GameHub/1.0")
        .build()
        .unwrap_or_default()
});

/// Cap on how much of a remote image we are willing to download for a probe.
const MAX_PROBE_BYTES: usize = 8 * 1024 * 1024;

/// True when a candidate's image location can be trusted without a network
/// check. Steam fabricates dimensions for assets that frequently 404, so its
/// candidates are always probed.
fn candidate_is_trusted(c: &GameArtworkCandidate) -> bool {
    c.width > 0 && c.height > 0 && c.provider != "steam"
}

/// True when a PNG decodes to an essentially uniform image (a blank/solid
/// placeholder, which Steam ships as the "logo" for games without real one).
/// Only color types 2 (RGB), 4 (greyscale+alpha) and 6 (RGBA) are inspected;
/// anything else — or anything we fail to decode — is not treated as a
/// placeholder. The scanlines are unfiltered with the four standard filters.
fn png_is_placeholder(bytes: &[u8]) -> bool {
    const PNG_SIG: [u8; 8] = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    if bytes.len() < 33 || bytes[..8] != PNG_SIG {
        return false;
    }

    let w = u32::from_be_bytes([bytes[16], bytes[17], bytes[18], bytes[19]]) as usize;
    let h = u32::from_be_bytes([bytes[20], bytes[21], bytes[22], bytes[23]]) as usize;
    let bit_depth = bytes[24];
    let color_type = bytes[25];
    let interlace = bytes[28];

    // Only interlaced-off, 8/16-bit truecolor or greyscale+alpha images.
    if interlace != 0 {
        return false;
    }
    if bit_depth != 8 && bit_depth != 16 {
        return false;
    }
    let channels = match color_type {
        2 => 3usize,
        4 => 2usize,
        6 => 4usize,
        _ => return false,
    };
    if w == 0 || h == 0 || (w as u64) * (h as u64) > 64_000_000 {
        return false;
    }

    // Assemble the IDAT chunks.
    let mut idat = Vec::new();
    let mut offset = 8usize;
    while offset + 12 <= bytes.len() {
        let len = u32::from_be_bytes([bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]]) as usize;
        let kind = &bytes[offset + 4..offset + 8];
        let data = &bytes[offset + 8..offset + 8 + len];
        if kind == b"IEND" {
            break;
        }
        if kind == b"IDAT" {
            idat.extend_from_slice(data);
        }
        offset += 12 + len; // len + kind + data + crc
    }
    if idat.is_empty() {
        return false;
    }

    // Inflate the scanlines. flate2 is added as a direct dependency but was
    // already in the dependency tree, so no new crate is compiled.
    use std::io::Read;
    let mut decoder = flate2::read::ZlibDecoder::new(&idat[..]);
    let mut raw = Vec::with_capacity(idat.len().saturating_mul(4));
    if decoder.read_to_end(&mut raw).is_err() {
        return false;
    }

    // SamplesPerPixel: 8-bit depth → one byte per channel, 16-bit → two.
    let bpp = channels * (bit_depth as usize / 8);
    let stride = w * bpp;
    let expected = h as u64 * (1 + stride as u64);
    if raw.len() as u64 != expected {
        return false;
    }

    let mut prev = vec![0u8; stride];
    let mut distinct = std::collections::HashSet::new();
    let mut pos = 0usize;
    let mut pixels = 0u64;

    for _ in 0..h {
        let filter = raw[pos];
        pos += 1;
        let mut line = raw[pos..pos + stride].to_vec();
        pos += stride;
        match filter {
            0 => {}
            1 => {
                for x in bpp..stride {
                    line[x] = line[x].wrapping_add(line[x - bpp]);
                }
            }
            2 => {
                for x in 0..stride {
                    line[x] = line[x].wrapping_add(prev[x]);
                }
            }
            3 => {
                for x in 0..stride {
                    let left = if x >= bpp { line[x - bpp] } else { 0 };
                    line[x] = line[x].wrapping_add(((left as u16 + prev[x] as u16) >> 1) as u8);
                }
            }
            4 => {
                for x in 0..stride {
                    let left = if x >= bpp { line[x - bpp] } else { 0 };
                    let up = prev[x];
                    let up_left = if x >= bpp { prev[x - bpp] } else { 0 };
                    let p = (left as i32 + up as i32 - up_left as i32) as i16;
                    let pa = (p - left as i16).abs();
                    let pb = (p - up as i16).abs();
                    let pc = (p - up_left as i16).abs();
                    let pred = if pa <= pb && pa <= pc {
                        left as i16
                    } else if pb <= pc {
                        up as i16
                    } else {
                        up_left as i16
                    };
                    line[x] = line[x].wrapping_add(pred as u8);
                }
            }
            _ => return false,
        }

        // Sample each channel's most significant byte per pixel.
        for x in (0..stride / bpp).map(|i| i * bpp) {
            let mut key = 0u32;
            for ch in 0..channels {
                key |= (line[x + ch * (bpp / channels)] as u32) << (ch * 8);
            }
            distinct.insert(key);
            pixels += 1;
        }
        prev = line;
    }

    if pixels < 256 {
        return false;
    }
    // A genuine wordmark/emblem has far more than 64 distinct values across
    // the image; blanks and solid placeholders encode a handful.
    distinct.len() < 64
}

/// Reachability check: the URL must return an actual image body. When
/// `check_placeholder` is set (logo resolution), near-blank images such as
/// Steam's placeholder `logo.png` are rejected too so they are never cached
/// as primary artwork.
async fn fetch_image_probe(url: &str, check_placeholder: bool) -> bool {
    if url.is_empty() {
        return false;
    }

    let resp = PROBE_CLIENT
        .get(url)
        .header("Range", "bytes=0-524287")
        .send()
        .await;
    let Ok(resp) = resp else { return false; };

    let status = resp.status().as_u16();
    if status != 200 && status != 206 {
        return false;
    }

    let content_type = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_ascii_lowercase();

    let bytes = resp.bytes().await.unwrap_or_default();
    if bytes.len() < 24 {
        return false;
    }

    let is_image_magic = bytes.starts_with(&[0x89, 0x50, 0x4E, 0x47])
        || (bytes[0] == 0xFF && bytes[1] == 0xD8)
        || bytes.starts_with(b"GIF8")
        || (bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP");

    let is_image = content_type.starts_with("image/") || is_image_magic;
    if !is_image {
        return false;
    }

    if check_placeholder {
        let body = &bytes[..bytes.len().min(MAX_PROBE_BYTES)];
        if png_is_placeholder(body) {
            return false;
        }
    }

    true
}

/// Packaging/marketing words that get in the way of matching store titles
/// ("remake", "definitive edition", plus common misspellings).
const TITLE_NOISE: &[&str] = &[
    "remake", "remaster", "remastered", "remastared", "remasterd",
    "edition", "definitive", "deluxe", "complete", "goty",
    "collection", "hd", "reforged", "reloaded",
];

fn is_noise(token: &str) -> bool {
    TITLE_NOISE.contains(&token)
}

fn tokenize(value: &str) -> Vec<String> {
    value
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .map(|t| t.to_string())
        .collect()
}

/// Meaningful tokens for similarity scoring (noise words removed).
fn normalized_tokens(value: &str) -> HashSet<String> {
    tokenize(value).into_iter().filter(|t| !is_noise(t)).collect()
}

/// Token-overlap similarity used to reject obviously unrelated provider
/// matches (e.g. "Tekken 6" matching a "TEKKEN 7" DLC entry) while tolerating
/// marketing suffixes and misspelled ones.
fn title_similarity(query: &str, candidate: &str) -> f64 {
    let a = normalized_tokens(query);
    let b = normalized_tokens(candidate);
    if a.is_empty() || b.is_empty() {
        return 0.0;
    }
    let intersection = a.intersection(&b).count() as f64;
    let union = a.union(&b).count() as f64;
    if union == 0.0 { 0.0 } else { intersection / union }
}

fn to_roman(n: u32) -> Option<&'static str> {
    Some(match n {
        1 => "i", 2 => "ii", 3 => "iii", 4 => "iv", 5 => "v", 6 => "vi",
        7 => "vii", 8 => "viii", 9 => "ix", 10 => "x", 11 => "xi", 12 => "xii",
        _ => return None,
    })
}

/// Search strings to try, in order: the raw title, one with marketing noise
/// removed, then one with a trailing number written as a roman numeral (Steam
/// indexes "The Last of Us Part I", not "...Part 1"). Store searches are
/// exact-ish, so several phrasings are needed to find these.
fn search_query_variants(title: &str) -> Vec<String> {
    let tokens = tokenize(title);
    let cleaned: Vec<String> = tokens.iter().filter(|t| !is_noise(t)).cloned().collect();

    let mut variants = vec![title.trim().to_string()];
    let cleaned_str = cleaned.join(" ");
    if !cleaned_str.is_empty() {
        variants.push(cleaned_str.clone());
    }

    if let Some(last) = cleaned.last() {
        if let Ok(n) = last.parse::<u32>() {
            if let Some(roman) = to_roman(n) {
                let mut roman_tokens = cleaned.clone();
                *roman_tokens.last_mut().unwrap() = roman.to_string();
                variants.push(roman_tokens.join(" "));
            }
        }
    }

    variants.retain(|v| !v.is_empty());
    variants.dedup();
    variants
}

pub struct MetadataResolver {
    registry: Arc<ProviderRegistry>,
}

impl MetadataResolver {
    pub fn new(registry: Arc<ProviderRegistry>) -> Self {
        Self { registry }
    }

    pub async fn resolve_metadata(&self, game_id: i64) -> Result<EnrichedMetadata, String> {
        let game = crate::library::get_all_games()
            .map_err(|e| e.to_string())?
            .into_iter()
            .find(|g| g.id == game_id)
            .ok_or("Game not found")?;

        let external_ids = database::get_external_ids(game_id).unwrap_or_default();
        let has_description = game.description.is_some() && !game.description.as_ref().unwrap().is_empty();

        log::info!("[Metadata] Resolving metadata: {}", game.title);

        let metadata_providers = self.registry.for_capability(ProviderCapability::Metadata);

        let mut result = EnrichedMetadata {
            title: None,
            description: None,
            developer: game.developer.clone(),
            publisher: game.publisher.clone(),
            release_date: game.release_date.clone(),
            genres: vec![],
            rating: None,
            steam_app_id: external_ids.iter()
                .find(|e| e.provider == "steam")
                .map(|e| e.external_id.clone()),
            igdb_id: external_ids.iter()
                .find(|e| e.provider == "igdb")
                .map(|e| e.external_id.clone()),
            rawg_id: external_ids.iter()
                .find(|e| e.provider == "rawg")
                .map(|e| e.external_id.clone()),
            steamgriddb_id: external_ids.iter()
                .find(|e| e.provider == "steamgriddb")
                .map(|e| e.external_id.clone()),
        };

        for provider in &metadata_providers {
            if let Some(ref sgdb_id) = result.steamgriddb_id {
                if provider.id() == "steamgriddb" {
                    match provider.get_metadata(sgdb_id).await {
                        Ok(meta) => merge_metadata(&mut result, &meta),
                        Err(e) => log::warn!("[Metadata] SteamGridDB metadata failed: {}", e),
                    }
                    continue;
                }
            }

            if result.title.is_none() || (!has_description && result.description.is_none()) {
                match provider.search_games(&game.title).await {
                    Ok(candidates) => {
                        if let Some(best) = candidates.into_iter().next() {
                            if best.confidence > 0.6 {
                                log::info!(
                                    "[Metadata] {} match: {} confidence={:.2}",
                                    provider.name(), best.title, best.confidence
                                );
                                if provider.id() == "steamgriddb" {
                                    database::upsert_external_id(game_id, "steamgriddb", &best.provider_id).ok();
                                    result.steamgriddb_id = Some(best.provider_id.clone());
                                }
                                match provider.get_metadata(&best.provider_id).await {
                                    Ok(meta) => merge_metadata(&mut result, &meta),
                                    Err(e) => log::warn!("[Metadata] {} enrichment failed: {}", provider.name(), e),
                                }
                            }
                        }
                    }
                    Err(e) => log::warn!("[Metadata] {} search failed: {}", provider.name(), e),
                }
            }
        }

        let mut updates = crate::library::GameUpdate::default();
        if result.description.is_some() && game.description.is_none() {
            updates.description = result.description.clone();
        }
        if result.developer.is_some() && game.developer.is_none() {
            updates.developer = result.developer.clone();
        }
        if result.publisher.is_some() && game.publisher.is_none() {
            updates.publisher = result.publisher.clone();
        }
        if result.release_date.is_some() && game.release_date.is_none() {
            updates.release_date = result.release_date.clone();
        }
        if !result.genres.is_empty() && game.genre.is_none() {
            updates.genre = Some(result.genres.join(", "));
        }

        if updates.description.is_some() || updates.developer.is_some() || updates.publisher.is_some() || updates.release_date.is_some() || updates.genre.is_some() {
            crate::library::update_game(game_id, &updates).map_err(|e| e.to_string())?;
        }

        Ok(result)
    }
}

fn merge_metadata(target: &mut EnrichedMetadata, source: &EnrichedMetadata) {
    if target.title.is_none() { target.title = source.title.clone(); }
    if target.description.is_none() { target.description = source.description.clone(); }
    if target.developer.is_none() { target.developer = source.developer.clone(); }
    if target.publisher.is_none() { target.publisher = source.publisher.clone(); }
    if target.release_date.is_none() { target.release_date = source.release_date.clone(); }
    if target.rating.is_none() { target.rating = source.rating; }
    if target.steam_app_id.is_none() { target.steam_app_id = source.steam_app_id.clone(); }
    if target.igdb_id.is_none() { target.igdb_id = source.igdb_id.clone(); }
    if target.rawg_id.is_none() { target.rawg_id = source.rawg_id.clone(); }
    if target.steamgriddb_id.is_none() { target.steamgriddb_id = source.steamgriddb_id.clone(); }
    for g in &source.genres {
        if !target.genres.contains(g) {
            target.genres.push(g.clone());
        }
    }
}

pub struct ArtworkResolver {
    registry: Arc<ProviderRegistry>,
}

impl ArtworkResolver {
    pub fn new(registry: Arc<ProviderRegistry>) -> Self {
        Self { registry }
    }

    pub async fn resolve_artwork(
        &self,
        game_id: i64,
        artwork_type: ArtworkType,
    ) -> Result<Vec<GameArtworkCandidate>, String> {
        if database::has_manual_artwork(game_id, artwork_type.as_str()).unwrap_or(false) {
            log::info!("[Artwork] Game {} has manual {} selection, skipping auto-resolve", game_id, artwork_type.as_str());
            return database::get_artwork_candidates(game_id, artwork_type.as_str())
                .map_err(|e| e.to_string());
        }

        let game = crate::library::get_all_games()
            .map_err(|e| e.to_string())?
            .into_iter()
            .find(|g| g.id == game_id)
            .ok_or("Game not found")?;

        // Never overwrite a deliberate local artwork file (uploaded or
        // downloaded): those set a "artwork/..." path on the game row.
        let current = match artwork_type {
            ArtworkType::Cover | ArtworkType::Capsule => game.cover_image.as_deref(),
            ArtworkType::Hero | ArtworkType::Background => game.background_image.as_deref(),
            ArtworkType::Logo => game.logo.as_deref(),
            ArtworkType::Icon => game.icon.as_deref(),
            _ => None,
        };
        if current.is_some_and(|p| p.starts_with("artwork/")) {
            log::info!(
                "[Artwork] Game {} has a local {} file; skipping auto-resolve",
                game_id, artwork_type.as_str()
            );
            return database::get_artwork_candidates(game_id, artwork_type.as_str())
                .map_err(|e| e.to_string());
        }

        let existing = database::get_artwork_candidates(game_id, artwork_type.as_str()).unwrap_or_default();
        if !existing.is_empty() {
            let primary = existing.iter().find(|c| c.is_primary).or_else(|| existing.first());
            let primary_ok = match primary {
                Some(p) => candidate_is_trusted(p) || fetch_image_probe(&p.url, artwork_type == ArtworkType::Logo).await,
                None => false,
            };

            if primary_ok {
                return Ok(existing);
            }

            log::info!(
                "[Artwork] Cached {} for game {} is unreachable; re-resolving",
                artwork_type.as_str(), game_id
            );
            database::delete_auto_artwork(game_id, artwork_type.as_str()).ok();
        }

        let external_ids = database::get_external_ids(game_id).unwrap_or_default();
        let providers = self.registry.for_artwork_type(artwork_type);

        log::info!(
            "[Artwork] Resolving {} for '{}' with {} providers",
            artwork_type.as_str(), game.title, providers.len()
        );

        let mut all_candidates = Vec::new();

        for provider in &providers {
            let provider_id = resolve_provider_id(
                provider.as_ref(),
                &game.title,
                &external_ids,
            ).await;

            let pid = match provider_id {
                Some(id) => id,
                None => continue,
            };

            match provider.get_artwork(&pid, artwork_type).await {
                Ok(candidates) => {
                    log::info!(
                        "[Artwork] {}: {} candidates",
                        provider.name(), candidates.len()
                    );
                    all_candidates.extend(candidates);
                }
                Err(e) => log::warn!("[Artwork] {} failed: {}", provider.name(), e),
            }
        }

        score_and_select(&mut all_candidates);

        // Choose the highest-scored candidate whose image actually resolves so
        // we never cache a primary that points at a 404/placeholder asset.
        let mut chosen: Option<usize> = None;
        for (i, candidate) in all_candidates.iter().enumerate() {
            if candidate_is_trusted(candidate) || fetch_image_probe(&candidate.url, artwork_type == ArtworkType::Logo).await {
                chosen = Some(i);
                break;
            }
        }

        let Some(chosen) = chosen else {
            log::warn!(
                "[Artwork] No reachable {} candidates for game {}",
                artwork_type.as_str(), game_id
            );
            database::delete_auto_artwork(game_id, artwork_type.as_str()).ok();
            return Ok(vec![]);
        };

        for (i, candidate) in all_candidates.iter_mut().enumerate() {
            candidate.is_primary = i == chosen;
        }

        for candidate in &all_candidates {
            database::insert_artwork_candidate(
                game_id,
                candidate.artwork_type.as_str(),
                &candidate.url,
                candidate.thumbnail_url.as_deref(),
                candidate.width,
                candidate.height,
                &candidate.provider,
                candidate.provider_asset_id.as_deref(),
                candidate.score,
                candidate.is_primary,
            ).ok();
        }

        let primary = &all_candidates[chosen];
        let update = match artwork_type {
            ArtworkType::Cover | ArtworkType::Capsule => {
                crate::library::GameUpdate { cover_image: Some(primary.url.clone()), ..Default::default() }
            }
            ArtworkType::Hero | ArtworkType::Background => {
                crate::library::GameUpdate { background_image: Some(primary.url.clone()), ..Default::default() }
            }
            ArtworkType::Logo => {
                crate::library::GameUpdate { logo: Some(primary.url.clone()), ..Default::default() }
            }
            ArtworkType::Icon => {
                crate::library::GameUpdate { icon: Some(primary.url.clone()), ..Default::default() }
            }
            _ => crate::library::GameUpdate::default(),
        };
        crate::library::update_game(game_id, &update).ok();

        Ok(all_candidates)
    }

    pub async fn resolve_screenshots(&self, game_id: i64) -> Result<Vec<GameArtworkCandidate>, String> {
        if database::has_manual_artwork(game_id, "screenshot").unwrap_or(false) {
            return database::get_artwork_candidates(game_id, "screenshot")
                .map_err(|e| e.to_string());
        }

        let existing = database::get_artwork_candidates(game_id, "screenshot").unwrap_or_default();
        if !existing.is_empty() {
            return Ok(existing);
        }

        let game = crate::library::get_all_games()
            .map_err(|e| e.to_string())?
            .into_iter()
            .find(|g| g.id == game_id)
            .ok_or("Game not found")?;

        let external_ids = database::get_external_ids(game_id).unwrap_or_default();
        let providers = self.registry.for_capability(ProviderCapability::Screenshot);

        let mut all_screenshots = Vec::new();

        for provider in &providers {
            let provider_id = resolve_provider_id(
                provider.as_ref(),
                &game.title,
                &external_ids,
            ).await;

            let pid = match provider_id {
                Some(id) => id,
                None => continue,
            };

            match provider.get_screenshots(&pid).await {
                Ok(ss) => {
                    log::info!("[Artwork] {} screenshots: {}", provider.name(), ss.len());
                    all_screenshots.extend(ss);
                }
                Err(e) => log::warn!("[Artwork] {} screenshots failed: {}", provider.name(), e),
            }
        }

        deduplicate_screenshots(&mut all_screenshots);

        for (_i, ss) in all_screenshots.iter().enumerate() {
            database::insert_artwork_candidate(
                game_id,
                "screenshot",
                &ss.url,
                ss.thumbnail_url.as_deref(),
                ss.width,
                ss.height,
                &ss.provider,
                ss.provider_asset_id.as_deref(),
                ss.score,
                ss.is_primary,
            ).ok();
        }

        Ok(all_screenshots)
    }
}

async fn resolve_provider_id(
    provider: &dyn MetadataProvider,
    game_title: &str,
    external_ids: &[ExternalId],
) -> Option<String> {
    let provider_id = provider.id();

    if let Some(eid) = external_ids.iter().find(|e| e.provider == provider_id) {
        return Some(eid.external_id.clone());
    }

    let mut seen: HashSet<String> = HashSet::new();
    let mut best: Option<(f64, String)> = None;

    for query in search_query_variants(game_title) {
        let Ok(candidates) = provider.search_games(&query).await else { continue };
        for candidate in candidates {
            if candidate.confidence <= 0.6 || !seen.insert(candidate.provider_id.clone()) {
                continue;
            }
            let score = title_similarity(game_title, &candidate.title);
            if score >= 0.4 && best.as_ref().is_none_or(|(b, _)| score > *b) {
                best = Some((score, candidate.provider_id));
            }
        }
        // A near-exact match cannot be beaten by another phrasing.
        if best.as_ref().is_some_and(|(b, _)| *b >= 0.9) {
            break;
        }
    }

    best.map(|(_, id)| id)
}

fn score_and_select(candidates: &mut [GameArtworkCandidate]) {
    candidates.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
}

fn deduplicate_screenshots(screenshots: &mut Vec<GameArtworkCandidate>) {
    screenshots.sort_by(|a, b| {
        a.provider_asset_id.cmp(&b.provider_asset_id)
    });
    screenshots.dedup_by(|a, b| {
        a.provider_asset_id.is_some()
            && a.provider_asset_id == b.provider_asset_id
            && a.provider == b.provider
    });
}

#[cfg(test)]
mod tests {
    use super::png_is_placeholder;
    use std::io::Write;

    /// Builds a minimal non-interlaced PNG (8-bit color type, all rows use
    /// filter 0 / None). `pixel` returns the sample bytes for (x, y); the
    /// number of samples must match the color type (2 bytes for grey+alpha,
    /// 4 for RGBA).
    fn build_png<F: Fn(usize, usize) -> Vec<u8>>(
        w: usize,
        h: usize,
        color_type: u8,
        channels: usize,
        pixel: F,
    ) -> Vec<u8> {
        let mut ihdr = Vec::new();
        ihdr.extend_from_slice(&(w as u32).to_be_bytes());
        ihdr.extend_from_slice(&(h as u32).to_be_bytes());
        ihdr.extend_from_slice(&[8u8, color_type, 0, 0, 0]);

        let mut raw = Vec::with_capacity(h * (1 + w * channels));
        for y in 0..h {
            raw.push(0); // filter: none
            for x in 0..w {
                raw.extend_from_slice(&pixel(x, y));
            }
        }

        let mut encoder = flate2::write::ZlibEncoder::new(Vec::new(), flate2::Compression::default());
        encoder.write_all(&raw).unwrap();
        let idat = encoder.finish().unwrap();

        let chunk = |kind: &[u8; 4], data: &[u8]| -> Vec<u8> {
            let mut c = Vec::new();
            c.extend_from_slice(&(data.len() as u32).to_be_bytes());
            c.extend_from_slice(kind);
            c.extend_from_slice(data);
            let crc = crc32fast::hash(&c[4..]);
            c.extend_from_slice(&crc.to_be_bytes());
            c
        };

        let mut png = vec![0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        png.extend_from_slice(&chunk(b"IHDR", &ihdr));
        png.extend_from_slice(&chunk(b"IDAT", &idat));
        png.extend_from_slice(&chunk(b"IEND", &[]));
        png
    }

    #[test]
    fn solid_greyscale_alpha_png_is_placeholder() {
        // Mirrors Steam's placeholder logo.png: greyscale+alpha, near-uniform.
        let png = build_png(64, 64, 4, 2, |_, _| vec![0x8F, 0x0A]);
        assert!(png_is_placeholder(&png));
    }

    #[test]
    fn solid_rgba_png_is_placeholder() {
        let png = build_png(64, 64, 6, 4, |_, _| vec![0x33, 0x33, 0x33, 0xFF]);
        assert!(png_is_placeholder(&png));
    }

    #[test]
    fn gradient_png_is_not_placeholder() {
        let png = build_png(64, 64, 6, 4, |x, _| vec![x as u8, 0x00, 0x00, 0xFF]);
        assert!(!png_is_placeholder(&png));
    }

    #[test]
    fn varied_wordmark_png_is_not_placeholder() {
        // Anti-aliased logo text produces a large spread of alpha levels,
        // unlike Steam's blank placeholder.
        let png = build_png(64, 64, 4, 2, |x, y| {
            if (32..56).contains(&x) && (16..40).contains(&y) {
                vec![0xE6, ((x * 7 + y * 13) % 256) as u8]
            } else {
                vec![0x00, 0x00]
            }
        });
        assert!(!png_is_placeholder(&png));
    }
}
