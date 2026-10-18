//! Google Images provider (best-effort).
//!
//! Google does not offer an image-search API without a key, and its results page
//! is JavaScript-driven. This provider performs a server-side fetch of the
//! classic `tbm=isch` results page and extracts the image tuples Google embeds
//! in its `<script>` payloads (`["https://...jpg", height, width]`, plus
//! `encrypted-tbn*.gstatic.com` thumbnails).
//!
//! This is inherently fragile: Google may show a consent wall, a CAPTCHA or an
//! "unusual traffic" interstitial depending on region and traffic. Those cases
//! are reported as [`SearchError::Blocked`] so the UI can point the user at
//! DuckDuckGo. No anti-bot protection is bypassed.

use async_trait::async_trait;
use once_cell::sync::Lazy;
use regex::Regex;

use super::{
    format_from_url, throttle, ImageSearchProvider, SearchError, SearchOptions, WebImageResult,
    WebImageSearchPage, BROWSER_UA,
};

/// Result tuples embedded by Google: `["https://...", height, width]`.
static TUPLE_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"\["(https?://[^"\\]+?)",(\d{2,5}),(\d{2,5})\]"#).expect("valid tuple regex")
});

static IMAGE_EXT_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\.(jpe?g|png|gif|webp|bmp)(?:$|[?#])").expect("valid ext regex")
});

const SEARCH_URL: &str = "https://www.google.com/search";
const RESULTS_PER_PAGE: u32 = 100;

pub struct GoogleProvider;

impl GoogleProvider {
    pub fn new() -> Self {
        Self
    }

    fn client(&self) -> Result<reqwest::Client, SearchError> {
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(20))
            .redirect(reqwest::redirect::Policy::limited(5))
            .build()
            .map_err(|e| SearchError::Network(e.to_string()))
    }

    fn is_thumbnail(url: &str) -> bool {
        url.contains("gstatic.com") || url.contains("encrypted-tbn")
    }

    fn looks_like_image(url: &str) -> bool {
        IMAGE_EXT_RE.is_match(url) || url.contains("imgurl=")
    }

    /// Normalize the escapes Google uses inside its script payloads.
    fn unescape(body: &str) -> String {
        body.replace("\\/", "/")
            .replace("\\u003d", "=")
            .replace("\\u0026", "&")
            .replace("\\u0027", "'")
            .replace("&amp;", "&")
    }

    fn is_blocked_page(body: &str) -> bool {
        let lower = body.to_ascii_lowercase();
        lower.contains("our systems have detected unusual traffic")
            || lower.contains("/sorry/")
            || lower.contains("id=\"captcha")
            || lower.contains("unusual traffic from your computer network")
    }

    fn is_consent_page(final_url: &str, body: &str) -> bool {
        final_url.contains("consent.google.com")
            || final_url.contains("/consent")
            || body.contains("Before you continue to Google")
            || body.contains("consent.google.com")
    }

    fn parse_results(&self, body: &str, query: &str) -> Vec<WebImageResult> {
        let unescaped = Self::unescape(body);
        let mut pending_thumb: Option<(String, u32, u32)> = None;
        let mut out: Vec<WebImageResult> = Vec::new();

        for caps in TUPLE_RE.captures_iter(&unescaped) {
            let url = caps.get(1).map(|m| m.as_str()).unwrap_or("");
            let h = caps.get(2).and_then(|m| m.as_str().parse::<u32>().ok()).unwrap_or(0);
            let w = caps.get(3).and_then(|m| m.as_str().parse::<u32>().ok()).unwrap_or(0);

            if url.is_empty() {
                continue;
            }

            if Self::is_thumbnail(url) {
                pending_thumb = Some((url.to_string(), w, h));
                continue;
            }

            if !Self::looks_like_image(url) {
                continue;
            }

            let thumbnail_url = match pending_thumb.take() {
                Some((thumb, _, _)) => thumb,
                None => url.to_string(),
            };

            out.push(WebImageResult {
                id: url.to_string(),
                title: String::new(),
                thumbnail_url,
                source_url: url.to_string(),
                source_page: String::new(),
                width: w,
                height: h,
                format: format_from_url(url),
                engine: "google".to_string(),
                query: query.to_string(),
            });
        }

        out
    }
}

impl Default for GoogleProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl ImageSearchProvider for GoogleProvider {
    fn id(&self) -> &str {
        "google"
    }

    async fn search(
        &self,
        query: &str,
        opts: &SearchOptions,
    ) -> Result<WebImageSearchPage, SearchError> {
        let client = self.client()?;
        throttle("google_images").await;

        let start = (opts.page.saturating_sub(1)) * RESULTS_PER_PAGE;
        let start_str = start.to_string();
        let safe = if opts.safe_search { "active" } else { "off" };

        let resp = client
            .get(SEARCH_URL)
            .query(&[
                ("q", query),
                ("tbm", "isch"),
                ("hl", "en"),
                ("gl", "us"),
                ("safe", safe),
                ("start", start_str.as_str()),
            ])
            .header("User-Agent", BROWSER_UA)
            .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
            .header("Accept-Language", "en-US,en;q=0.9")
            .send()
            .await
            .map_err(|e| {
                if e.is_timeout() {
                    SearchError::Timeout("Google request".to_string())
                } else {
                    SearchError::Network(e.to_string())
                }
            })?;

        let status = resp.status().as_u16();
        let final_url = resp.url().as_str().to_string();

        if status == 429 {
            return Err(SearchError::Blocked(
                "Google is rate limiting requests. Wait a while or use DuckDuckGo.".to_string(),
            ));
        }
        if !(200..300).contains(&status) {
            return Err(SearchError::Http(status));
        }

        let body = resp.text().await.map_err(|e| SearchError::Network(e.to_string()))?;

        if Self::is_blocked_page(&body) {
            return Err(SearchError::Blocked(
                "Google served an anti-bot / CAPTCHA page. Use DuckDuckGo instead.".to_string(),
            ));
        }
        if Self::is_consent_page(&final_url, &body) {
            return Err(SearchError::Blocked(
                "Google requires a consent step it will not serve to this client. Use DuckDuckGo instead."
                    .to_string(),
            ));
        }

        let results = self.parse_results(&body, query);
        if results.is_empty() {
            return Err(SearchError::Blocked(
                "Google did not return parseable image results (its page format is JS-driven and unstable). Use DuckDuckGo instead."
                    .to_string(),
            ));
        }

        let has_more = results.len() >= 40;

        Ok(WebImageSearchPage {
            results,
            page: opts.page,
            has_more,
            engine: "google".to_string(),
            note: Some(
                "Google parsing is best-effort and may miss or duplicate results.".to_string(),
            ),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn provider() -> GoogleProvider {
        GoogleProvider::new()
    }

    #[test]
    fn parses_tuples_and_pairs_adjacent_thumbnails() {
        let body = r#"
            AF_initDataCallback({key:'ds:1', data:[
              ["https://encrypted-tbn0.gstatic.com/images?q=tbn:AAA",300,200],
              ["https://cdn.example.com/halo.png",1080,1920],
              ["https://encrypted-tbn0.gstatic.com/images?q=tbn:BBB",120,90],
              ["https://cdn.example.com/halo2.jpg",720,1280]
            ]});
        "#;
        let results = provider().parse_results(body, "halo");
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].source_url, "https://cdn.example.com/halo.png");
        assert_eq!(results[0].thumbnail_url, "https://encrypted-tbn0.gstatic.com/images?q=tbn:AAA");
        assert_eq!(results[0].width, 1920);
        assert_eq!(results[0].height, 1080);
        assert_eq!(results[1].thumbnail_url, "https://encrypted-tbn0.gstatic.com/images?q=tbn:BBB");
    }

    #[test]
    fn unescapes_slashes_and_entities() {
        let body = r#"[["https:\/\/cdn.example.com\/a.jpg",600,800]]"#;
        let results = provider().parse_results(body, "q");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].source_url, "https://cdn.example.com/a.jpg");
        assert_eq!(results[0].format, "jpeg");
    }

    #[test]
    fn ignores_non_image_urls() {
        let body = r#"[["https://example.com/page.html",600,800],
                       ["https://tracker.example.com/pixel",1,1],
                       ["https://cdn.example.com/real.webp",600,800]]"#;
        let results = provider().parse_results(body, "q");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].source_url, "https://cdn.example.com/real.webp");
    }

    #[test]
    fn detects_block_and_consent_pages() {
        assert!(GoogleProvider::is_blocked_page("Our systems have detected unusual traffic"));
        assert!(GoogleProvider::is_blocked_page("<form action=\"/sorry/index\">"));
        assert!(GoogleProvider::is_consent_page(
            "https://consent.google.com/m?continue",
            ""
        ));
        assert!(GoogleProvider::is_consent_page(
            "https://www.google.com/search",
            "Before you continue to Google"
        ));
        assert!(!GoogleProvider::is_blocked_page("normal results"));
    }

    #[tokio::test]
    #[ignore]
    async fn live_search_returns_results() {
        let p = GoogleProvider::new();
        let opts = SearchOptions {
            page: 1,
            safe_search: true,
            transparent: false,
            min_width: None,
            min_height: None,
        };
        match p.search("Halo game cover art", &opts).await {
            Ok(page) => {
                println!("Google returned {} results", page.results.len());
                for r in page.results.iter().take(3) {
                    println!("  {} {}x{} fmt={}", r.source_url, r.width, r.height, r.format);
                }
            }
            Err(e) => println!("Google search error: {}", e.message()),
        }
    }
}
