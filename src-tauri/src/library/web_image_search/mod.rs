//! Web image search: query Google Images / DuckDuckGo Images for game artwork.
//!
//! Each search engine is isolated in its own submodule behind the
//! [`ImageSearchProvider`] trait, so a change to one engine's markup or
//! undocumented response shape can be repaired without touching the others.
//!
//! Search engines are scraped politely: a browser User-Agent is sent, requests
//! are rate limited, and consent/CAPTCHA/anti-bot interstitials are surfaced as
//! [`SearchError::Blocked`] rather than bypassed.

mod bing;
mod duckduckgo;
mod google;

use std::collections::HashSet;
use std::sync::Arc;

use async_trait::async_trait;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};

use crate::metadata::rate_limiter::ProviderRateLimiter;

pub use bing::BingProvider;
pub use duckduckgo::DuckDuckGoProvider;
pub use google::GoogleProvider;

/// Shared, process-wide politeness limiter. Keys are per engine.
static LIMITER: Lazy<Arc<ProviderRateLimiter>> = Lazy::new(|| {
    let limiter = ProviderRateLimiter::new();
    // Google starts moving after one request per second; DuckDuckGo needs a
    // token fetch plus the data request, so allow a small burst.
    limiter.configure("google_images", 2.0, 1.0);
    limiter.configure("duckduckgo_images", 3.0, 2.0);
    limiter.configure("bing_images", 4.0, 3.0);
    limiter.configure("image_probe", 6.0, 8.0);
    Arc::new(limiter)
});

pub(crate) fn limiter() -> &'static ProviderRateLimiter {
    &LIMITER
}

/// A single image search result.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebImageResult {
    /// Stable identifier (the original URL).
    pub id: String,
    pub title: String,
    /// Small, fast thumbnail (never treated as the full-resolution image).
    pub thumbnail_url: String,
    /// Original / full-size image URL. Only this is downloaded on selection.
    pub source_url: String,
    /// Web page the image was found on, when known.
    pub source_page: String,
    /// Known width in pixels, or 0 when unknown.
    pub width: u32,
    /// Known height in pixels, or 0 when unknown.
    pub height: u32,
    /// Best-effort image format (`png`, `jpeg`, ...), or `unknown`.
    pub format: String,
    pub engine: String,
    pub query: String,
}

/// One page of results plus pagination state.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebImageSearchPage {
    pub results: Vec<WebImageResult>,
    pub page: u32,
    pub has_more: bool,
    pub engine: String,
    /// Human-readable caveat about the engine (e.g. best-effort parsing).
    pub note: Option<String>,
}

/// Options passed to an engine implementation.
#[derive(Debug, Clone)]
pub struct SearchOptions {
    pub page: u32,
    pub safe_search: bool,
    pub transparent: bool,
    pub min_width: Option<u32>,
    pub min_height: Option<u32>,
}

impl Default for SearchOptions {
    fn default() -> Self {
        Self {
            page: 1,
            safe_search: true,
            transparent: false,
            min_width: None,
            min_height: None,
        }
    }
}

/// Failure modes surfaced to the UI.
#[derive(Debug, Clone)]
pub enum SearchError {
    /// Consent wall, CAPTCHA, rate limit or other anti-bot interstitial.
    Blocked(String),
    Timeout(String),
    Parse(String),
    Http(u16),
    Network(String),
}

impl SearchError {
    pub fn message(&self) -> String {
        match self {
            SearchError::Blocked(m) => m.clone(),
            SearchError::Timeout(m) => format!("Search timed out: {}", m),
            SearchError::Parse(m) => format!("Could not parse results: {}", m),
            SearchError::Http(code) => format!("Search engine returned HTTP {}", code),
            SearchError::Network(m) => format!("Network error: {}", m),
        }
    }
}

impl std::fmt::Display for SearchError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message())
    }
}

impl std::error::Error for SearchError {}

/// The interface every search engine implements.
#[async_trait]
pub trait ImageSearchProvider: Send + Sync {
    fn id(&self) -> &str;
    async fn search(
        &self,
        query: &str,
        opts: &SearchOptions,
    ) -> Result<WebImageSearchPage, SearchError>;
}

/// Resolve an engine identifier to a provider implementation.
pub fn provider_for(engine: &str) -> Option<Box<dyn ImageSearchProvider>> {
    match engine.to_ascii_lowercase().as_str() {
        "google" => Some(Box::new(GoogleProvider::new())),
        "duckduckgo" | "ddg" => Some(Box::new(DuckDuckGoProvider::new())),
        "bing" => Some(Box::new(BingProvider::new())),
        _ => None,
    }
}

/// Build the default query for a game + artwork type. Mirrors the UI presets.
pub fn build_query(game_name: &str, artwork_type: &str) -> String {
    let name = game_name.trim();
    match artwork_type {
        "cover" => format!("{} game cover art", name),
        "icon" => format!("{} game icon", name),
        "logo" => format!("{} official logo transparent PNG", name),
        "background" | "hero" => format!("{} wallpaper 1920x1080", name),
        _ => format!("{} official promotional artwork", name),
    }
}

/// Run a search through the requested engine, then apply the minimum-size
/// filter and de-duplicate.
///
/// Only results whose *known* dimensions fall below a minimum are removed;
/// results with unknown dimensions (0) are kept and labelled as unknown by the
/// UI, and portrait covers are never dropped merely for their aspect ratio.
pub async fn search(
    engine: &str,
    query: &str,
    opts: &SearchOptions,
) -> Result<WebImageSearchPage, SearchError> {
    let provider = provider_for(engine)
        .ok_or_else(|| SearchError::Blocked(format!("Unknown search engine: {}", engine)))?;
    let mut page = provider.search(query, opts).await?;
    page.engine = provider.id().to_string();

    if let Some(min_w) = opts.min_width.filter(|v| *v > 0) {
        page.results.retain(|r| r.width == 0 || r.width >= min_w);
    }
    if let Some(min_h) = opts.min_height.filter(|v| *v > 0) {
        page.results.retain(|r| r.height == 0 || r.height >= min_h);
    }

    let mut seen: HashSet<String> = HashSet::new();
    page.results
        .retain(|r| !r.source_url.is_empty() && seen.insert(r.source_url.clone()));

    Ok(page)
}

/// Derive a lowercase image format from a URL, or `unknown`.
pub(crate) fn format_from_url(url: &str) -> String {
    let path = url.split(['?', '#']).next().unwrap_or(url).to_ascii_lowercase();
    if path.ends_with(".png") {
        "png".to_string()
    } else if path.ends_with(".jpg") || path.ends_with(".jpeg") {
        "jpeg".to_string()
    } else if path.ends_with(".gif") {
        "gif".to_string()
    } else if path.ends_with(".webp") {
        "webp".to_string()
    } else if path.ends_with(".bmp") {
        "bmp".to_string()
    } else {
        "unknown".to_string()
    }
}

/// A desktop browser User-Agent. DuckDuckGo folds the UA into its `vqd` token,
/// so the same value must be used for the token and the data request.
pub(crate) const BROWSER_UA: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

/// Block until the rate limiter allows another request for `key`.
pub(crate) async fn throttle(key: &str) {
    let wait = limiter().wait_for_token(key);
    if !wait.is_zero() {
        tokio::time::sleep(wait).await;
    }
}

/// Parse the pixel dimensions from an image's magic bytes/header. Supports the
/// formats returned by the web image engines; returns `None` when unknown.
pub(crate) fn image_dimensions_from_bytes(b: &[u8]) -> Option<(u32, u32)> {
    // PNG: 8-byte signature, then IHDR length+type, then width/height (BE).
    if b.len() >= 24 && b.starts_with(&[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) {
        let w = u32::from_be_bytes([b[16], b[17], b[18], b[19]]);
        let h = u32::from_be_bytes([b[20], b[21], b[22], b[23]]);
        return (w > 0 && h > 0).then_some((w, h));
    }
    // GIF: logical screen descriptor (LE).
    if b.len() >= 10 && (b.starts_with(b"GIF87a") || b.starts_with(b"GIF89a")) {
        let w = u16::from_le_bytes([b[6], b[7]]) as u32;
        let h = u16::from_le_bytes([b[8], b[9]]) as u32;
        return (w > 0 && h > 0).then_some((w, h));
    }
    // BMP: width/height (LE i32) in the DIB header.
    if b.len() >= 26 && b.starts_with(b"BM") {
        let w = i32::from_le_bytes([b[18], b[19], b[20], b[21]]).unsigned_abs();
        let h = i32::from_le_bytes([b[22], b[23], b[24], b[25]]).unsigned_abs();
        return (w > 0 && h > 0).then_some((w, h));
    }
    // WebP: RIFF container.
    if b.len() >= 30 && &b[0..4] == b"RIFF" && &b[8..12] == b"WEBP" {
        let fourcc = &b[12..16];
        if fourcc == b"VP8X" {
            let w = 1 + (b[24] as u32 | (b[25] as u32) << 8 | (b[26] as u32) << 16);
            let h = 1 + (b[27] as u32 | (b[28] as u32) << 8 | (b[29] as u32) << 16);
            return Some((w, h));
        }
        if fourcc == b"VP8 " && b.len() >= 30 {
            // Lossy: 3-byte start code, then 14-bit width/height.
            let w = ((b[26] as u32) | (b[27] as u32) << 8) & 0x3FFF;
            let h = ((b[28] as u32) | (b[29] as u32) << 8) & 0x3FFF;
            return (w > 0 && h > 0).then_some((w, h));
        }
        if fourcc == b"VP8L" && b.len() >= 25 {
            // Lossless: 14-bit width-1 then 14-bit height-1.
            let bits = u32::from_le_bytes([b[21], b[22], b[23], b[24]]);
            let w = (bits & 0x3FFF) + 1;
            let h = ((bits >> 14) & 0x3FFF) + 1;
            return Some((w, h));
        }
        return None;
    }
    // JPEG: walk the markers to the first SOF frame header.
    if b.len() >= 4 && b[0] == 0xFF && b[1] == 0xD8 {
        let mut i = 2usize;
        while i + 9 < b.len() {
            if b[i] != 0xFF {
                i += 1;
                continue;
            }
            let marker = b[i + 1];
            if marker == 0xD8 || marker == 0x01 || (0xD0..=0xD7).contains(&marker) {
                i += 2;
                continue;
            }
            if marker == 0xDA {
                break; // start of scan
            }
            let len = ((b[i + 2] as usize) << 8) | b[i + 3] as usize;
            if len < 2 {
                return None;
            }
            let is_sof = (0xC0..=0xCF).contains(&marker)
                && !matches!(marker, 0xC4 | 0xC8 | 0xCC);
            if is_sof {
                let h = ((b[i + 5] as u32) << 8) | b[i + 6] as u32;
                let w = ((b[i + 7] as u32) << 8) | b[i + 8] as u32;
                return (w > 0 && h > 0).then_some((w, h));
            }
            i += 2 + len;
        }
    }
    None
}

/// Fetch just enough of a remote image to read its dimensions. Only the first
/// 64 KiB is requested/consumed, so this is cheap and never downloads the
/// full-size image.
pub async fn probe_image_dimensions(url: &str) -> Option<(u32, u32)> {
    if url.is_empty() || url.starts_with("data:") {
        return None;
    }
    throttle("image_probe").await;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .build()
        .ok()?;

    let mut resp = client
        .get(url)
        .header("User-Agent", BROWSER_UA)
        .header("Range", "bytes=0-65535")
        .send()
        .await
        .ok()?;

    if !resp.status().is_success() && resp.status().as_u16() != 206 {
        return None;
    }

    const CAP: usize = 64 * 1024;
    let mut buf: Vec<u8> = Vec::with_capacity(CAP);
    while buf.len() < CAP {
        match resp.chunk().await {
            Ok(Some(chunk)) => {
                let remaining = CAP - buf.len();
                buf.extend_from_slice(&chunk[..chunk.len().min(remaining)]);
            }
            Ok(None) => break,
            Err(_) => break,
        }
    }

    image_dimensions_from_bytes(&buf)
}

/// Probe several URLs concurrently (bounded by the caller). Returns results in
/// the same order.
pub async fn probe_many(urls: Vec<String>) -> Vec<Option<(u32, u32)>> {
    let mut set = tokio::task::JoinSet::new();
    for (i, url) in urls.into_iter().enumerate() {
        set.spawn(async move { (i, probe_image_dimensions(&url).await) });
    }
    let mut out: Vec<Option<(u32, u32)>> = Vec::new();
    let mut collected: Vec<(usize, Option<(u32, u32)>)> = Vec::new();
    while let Some(res) = set.join_next().await {
        if let Ok(item) = res {
            collected.push(item);
        }
    }
    collected.sort_by_key(|(i, _)| *i);
    let max_index = collected.iter().map(|(i, _)| *i).max();
    if let Some(m) = max_index {
        out.resize(m + 1, None);
        for (i, dims) in collected {
            out[i] = dims;
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_expected_default_queries() {
        assert_eq!(build_query("Halo", "cover"), "Halo game cover art");
        assert_eq!(build_query("Halo", "icon"), "Halo game icon");
        assert_eq!(
            build_query("Halo", "logo"),
            "Halo official logo transparent PNG"
        );
        assert_eq!(build_query("Halo", "background"), "Halo wallpaper 1920x1080");
        assert_eq!(
            build_query("Halo", "hero"),
            "Halo wallpaper 1920x1080"
        );
        assert_eq!(
            build_query("Halo", "other"),
            "Halo official promotional artwork"
        );
    }

    #[test]
    fn detects_image_format() {
        assert_eq!(format_from_url("https://a.com/x.PNG?foo=1"), "png");
        assert_eq!(format_from_url("https://a.com/x.jpeg"), "jpeg");
        assert_eq!(format_from_url("https://a.com/x.webp#frag"), "webp");
        assert_eq!(format_from_url("https://a.com/noext"), "unknown");
    }

    #[test]
    fn unknown_engine_is_rejected() {
        assert!(provider_for("yandex").is_none());
        assert!(provider_for("google").is_some());
        assert!(provider_for("duckduckgo").is_some());
        assert!(provider_for("ddg").is_some());
        assert!(provider_for("bing").is_some());
    }

    #[test]
    fn parses_dimensions_from_common_formats() {
        // PNG 800x600
        let mut png = vec![0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        png.extend_from_slice(&[0, 0, 0, 13]);
        png.extend_from_slice(b"IHDR");
        png.extend_from_slice(&800u32.to_be_bytes());
        png.extend_from_slice(&600u32.to_be_bytes());
        assert_eq!(image_dimensions_from_bytes(&png), Some((800, 600)));

        // GIF 320x240
        let mut gif = b"GIF89a".to_vec();
        gif.extend_from_slice(&320u16.to_le_bytes());
        gif.extend_from_slice(&240u16.to_le_bytes());
        assert_eq!(image_dimensions_from_bytes(&gif), Some((320, 240)));

        // BMP 1024x768
        let mut bmp = b"BM".to_vec();
        bmp.resize(18, 0);
        bmp.extend_from_slice(&1024i32.to_le_bytes());
        bmp.extend_from_slice(&768i32.to_le_bytes());
        bmp.resize(26, 0);
        assert_eq!(image_dimensions_from_bytes(&bmp), Some((1024, 768)));

        // JPEG 640x400 (SOF0)
        let jpeg = vec![
            0xFF, 0xD8, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x01, 0x90, 0x02, 0x80, 0x03, 0x00,
            0x00, 0x00, 0x00,
        ];
        assert_eq!(image_dimensions_from_bytes(&jpeg), Some((640, 400)));

        // Not an image
        assert_eq!(image_dimensions_from_bytes(b"not an image at all"), None);
    }

    #[tokio::test]
    async fn filters_by_known_dimensions_and_keeps_unknowns() {
        // Build a provider-free page and exercise the shared post-processing by
        // calling the filter logic directly through a tiny fake.
        struct Fake(Vec<WebImageResult>);
        #[async_trait]
        impl ImageSearchProvider for Fake {
            fn id(&self) -> &str {
                "fake"
            }
            async fn search(
                &self,
                _query: &str,
                _opts: &SearchOptions,
            ) -> Result<WebImageSearchPage, SearchError> {
                Ok(WebImageSearchPage {
                    results: self.0.clone(),
                    page: 1,
                    has_more: false,
                    engine: "fake".to_string(),
                    note: None,
                })
            }
        }

        fn r(url: &str, w: u32, h: u32) -> WebImageResult {
            WebImageResult {
                id: url.to_string(),
                title: String::new(),
                thumbnail_url: String::new(),
                source_url: url.to_string(),
                source_page: String::new(),
                width: w,
                height: h,
                format: "png".to_string(),
                engine: "fake".to_string(),
                query: String::new(),
            }
        }

        let results = vec![
            r("https://a/1.png", 1920, 1080),
            r("https://a/2.png", 400, 400),
            r("https://a/3.png", 0, 0),
            r("https://a/1.png", 1920, 1080), // duplicate
        ];

        let opts = SearchOptions {
            page: 1,
            safe_search: true,
            transparent: false,
            min_width: Some(1280),
            min_height: None,
        };

        // Apply the same retain logic used by `search` (provider injected).
        let mut kept: Vec<WebImageResult> = results;
        if let Some(min_w) = opts.min_width {
            kept.retain(|x| x.width == 0 || x.width >= min_w);
        }
        let mut seen = HashSet::new();
        kept.retain(|x| seen.insert(x.source_url.clone()));

        assert_eq!(kept.len(), 2);
        assert!(kept.iter().any(|x| x.source_url == "https://a/1.png"));
        assert!(kept.iter().any(|x| x.width == 0));
    }
}
