//! Bing Images provider.
//!
//! Bing serves an image-search HTML fragment at `/images/async` that embeds each
//! result as an HTML-entity-encoded JSON object in an `m="..."` attribute
//! (`murl` = original, `turl` = thumbnail, `purl` = source page, `t` = title).
//!
//! This is a practical, key-free alternative to Google/DuckDuckGo, whose
//! server-side endpoints are frequently rate limited or protected by anti-bot
//! challenges that we deliberately do not attempt to bypass. The Bing fragment
//! does not include dimensions; those are probed separately when needed.

use async_trait::async_trait;
use once_cell::sync::Lazy;
use regex::Regex;
use serde_json::Value;

use super::{
    format_from_url, throttle, ImageSearchProvider, SearchError, SearchOptions, WebImageResult,
    WebImageSearchPage, BROWSER_UA,
};

/// Matches the `m="{...}"` attribute on each Bing result tile.
static M_ATTR_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r#"m="([^"]*murl[^"]*)"#).expect("valid bing attr regex"));

const SEARCH_URL: &str = "https://www.bing.com/images/async";
const RESULTS_PER_PAGE: u32 = 35;

pub struct BingProvider;

impl BingProvider {
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

    fn unescape(s: &str) -> String {
        s.replace("&quot;", "\"")
            .replace("&#39;", "'")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&amp;", "&")
    }

    fn parse_results(&self, body: &str, query: &str) -> Vec<WebImageResult> {
        let mut out = Vec::new();
        for caps in M_ATTR_RE.captures_iter(body) {
            let raw = match caps.get(1) {
                Some(m) => m.as_str(),
                None => continue,
            };
            let json: Value = match serde_json::from_str(&Self::unescape(raw)) {
                Ok(v) => v,
                Err(_) => continue,
            };

            let source_url = match json["murl"].as_str().filter(|s| !s.is_empty()) {
                Some(u) => u.to_string(),
                None => continue,
            };
            if source_url.starts_with("data:") {
                continue;
            }

            let thumbnail_url = json["turl"]
                .as_str()
                .filter(|s| !s.is_empty())
                .unwrap_or(&source_url)
                .to_string();

            out.push(WebImageResult {
                id: source_url.clone(),
                title: json["t"].as_str().unwrap_or("").to_string(),
                thumbnail_url,
                source_page: json["purl"].as_str().unwrap_or("").to_string(),
                format: format_from_url(&source_url),
                // The async fragment omits dimensions; filled in by the probe.
                width: 0,
                height: 0,
                source_url,
                engine: "bing".to_string(),
                query: query.to_string(),
            });
        }
        out
    }
}

impl Default for BingProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl ImageSearchProvider for BingProvider {
    fn id(&self) -> &str {
        "bing"
    }

    async fn search(
        &self,
        query: &str,
        opts: &SearchOptions,
    ) -> Result<WebImageSearchPage, SearchError> {
        let client = self.client()?;
        throttle("bing_images").await;

        let first = (opts.page.saturating_sub(1)) * RESULTS_PER_PAGE;
        let first_str = first.to_string();
        let count_str = RESULTS_PER_PAGE.to_string();
        let adlt = if opts.safe_search { "strict" } else { "off" };
        let qft = if opts.transparent {
            "+filterui:photo-transparent"
        } else {
            ""
        };

        let resp = client
            .get(SEARCH_URL)
            .query(&[
                ("q", query),
                ("first", first_str.as_str()),
                ("count", count_str.as_str()),
                ("mkt", "en-US"),
                ("adlt", adlt),
                ("qft", qft),
                ("mmasync", "1"),
            ])
            .header("User-Agent", BROWSER_UA)
            .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
            .header("Accept-Language", "en-US,en;q=0.9")
            .send()
            .await
            .map_err(|e| {
                if e.is_timeout() {
                    SearchError::Timeout("Bing request".to_string())
                } else {
                    SearchError::Network(e.to_string())
                }
            })?;

        let status = resp.status().as_u16();
        if status == 429 || status == 403 {
            return Err(SearchError::Blocked(
                "Bing is rate limiting requests. Wait a moment and try again.".to_string(),
            ));
        }
        if !(200..300).contains(&status) {
            return Err(SearchError::Http(status));
        }

        let body = resp.text().await.map_err(|e| SearchError::Network(e.to_string()))?;
        let results = self.parse_results(&body, query);

        if results.is_empty() {
            return Err(SearchError::Parse(
                "Bing returned no parseable image results.".to_string(),
            ));
        }

        let has_more = results.len() as u32 >= RESULTS_PER_PAGE;

        Ok(WebImageSearchPage {
            results,
            page: opts.page,
            has_more,
            engine: "bing".to_string(),
            note: Some(
                "Image dimensions are detected from the image itself and may appear after thumbnails load."
                    .to_string(),
            ),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn provider() -> BingProvider {
        BingProvider::new()
    }

    #[test]
    fn parses_murl_turl_and_page() {
        let body = r#"
            <a class="iusc" m="{&quot;murl&quot;:&quot;https://cdn.example.com/halo.jpg&quot;,&quot;turl&quot;:&quot;https://t.example.com/t?id=1&quot;,&quot;purl&quot;:&quot;https://example.com/page&quot;,&quot;t&quot;:&quot;Halo cover&quot;}">
        "#;
        let results = provider().parse_results(body, "halo");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].source_url, "https://cdn.example.com/halo.jpg");
        assert_eq!(results[0].thumbnail_url, "https://t.example.com/t?id=1");
        assert_eq!(results[0].source_page, "https://example.com/page");
        assert_eq!(results[0].title, "Halo cover");
        assert_eq!(results[0].format, "jpeg");
    }

    #[test]
    fn decodes_entities_with_ampersands_in_url() {
        let body = r#"<a m="{&quot;murl&quot;:&quot;https://cdn.example.com/a.png?x=1&amp;y=2&quot;,&quot;turl&quot;:&quot;https://t/b.png&quot;}">"#;
        let results = provider().parse_results(body, "q");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].source_url, "https://cdn.example.com/a.png?x=1&y=2");
    }

    #[test]
    fn ignores_entries_without_murl() {
        let body = r#"<a m="{&quot;t&quot;:&quot;no image&quot;}">"#;
        assert!(provider().parse_results(body, "q").is_empty());
    }

    #[tokio::test]
    #[ignore]
    async fn live_search_returns_results() {
        let p = BingProvider::new();
        let opts = SearchOptions {
            page: 1,
            safe_search: true,
            transparent: false,
            min_width: None,
            min_height: None,
        };
        match p.search("Halo game cover art", &opts).await {
            Ok(page) => {
                println!("Bing returned {} results", page.results.len());
                if let Some(r) = page.results.first() {
                    println!("first: {} -> {}", r.source_url, r.thumbnail_url);
                }
                assert!(!page.results.is_empty());
            }
            Err(e) => panic!("live Bing search failed: {}", e.message()),
        }
    }
}
