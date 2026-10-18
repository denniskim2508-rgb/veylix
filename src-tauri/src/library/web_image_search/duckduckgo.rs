//! DuckDuckGo Images provider.
//!
//! DuckDuckGo exposes image search as an internal JSON endpoint (`i.js`) that is
//! gated behind a per-query `vqd` token. The flow is:
//!
//! 1. GET `https://duckduckgo.com/?q=...&iax=images&ia=images` and scrape `vqd`.
//! 2. GET `https://duckduckgo.com/i.js?...&vqd=...` with a matching Referer.
//!
//! This is undocumented and can change or rate-limit at any time, so all parsing
//! lives here and failures are reported rather than faked.

use async_trait::async_trait;
use once_cell::sync::Lazy;
use regex::Regex;
use serde_json::Value;

use super::{
    format_from_url, throttle, ImageSearchProvider, SearchError, SearchOptions, WebImageResult,
    WebImageSearchPage, BROWSER_UA,
};

// The token appears either as `vqd=...` (query string) or `vqd:"..."` (script
// object literal), optionally quoted.
static VQD_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r#"vqd[=:]\s*["']?([0-9][0-9-]+)"#).expect("valid vqd regex"));

const TOKEN_URL: &str = "https://duckduckgo.com/";
const IMAGES_URL: &str = "https://duckduckgo.com/i.js";
const RESULTS_PER_PAGE: u32 = 100;

pub struct DuckDuckGoProvider;

impl DuckDuckGoProvider {
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

    /// Fetch the `vqd` token required to query `i.js`.
    async fn fetch_vqd(&self, client: &reqwest::Client, query: &str) -> Result<String, SearchError> {
        throttle("duckduckgo_images").await;

        let resp = client
            .get(TOKEN_URL)
            .query(&[
                ("q", query),
                ("iax", "images"),
                ("iar", "images"),
                ("ia", "images"),
            ])
            .header("User-Agent", BROWSER_UA)
            .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
            .header("Accept-Language", "en-US,en;q=0.9")
            .send()
            .await
            .map_err(|e| {
                if e.is_timeout() {
                    SearchError::Timeout("token request".to_string())
                } else {
                    SearchError::Network(e.to_string())
                }
            })?;

        let status = resp.status().as_u16();
        if status == 429 || status == 403 {
            return Err(SearchError::Blocked(
                "DuckDuckGo is rate limiting requests. Wait a moment and try again.".to_string(),
            ));
        }
        if !(200..300).contains(&status) {
            return Err(SearchError::Http(status));
        }

        let body = resp.text().await.map_err(|e| SearchError::Network(e.to_string()))?;

        VQD_RE
            .captures(&body)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().to_string())
            .ok_or_else(|| {
                SearchError::Blocked(
                    "DuckDuckGo did not return a search token (its page structure may have changed)."
                        .to_string(),
                )
            })
    }

    fn safe_search_param(safe_search: bool) -> &'static str {
        if safe_search {
            "1"
        } else {
            "-1"
        }
    }

    /// The `f` filter string: time, size, color, type, layout, license.
    fn filter_param(transparent: bool) -> String {
        if transparent {
            // type_image = transparent
            ",,transparent,,,".to_string()
        } else {
            ",,,,,".to_string()
        }
    }

    fn parse_results(&self, json: &Value, query: &str) -> (Vec<WebImageResult>, bool) {
        let results = json["results"].as_array().cloned().unwrap_or_default();

        let mapped: Vec<WebImageResult> = results
            .iter()
            .filter_map(|item| {
                let source_url = item["image"]
                    .as_str()
                    .filter(|s| !s.is_empty())
                    .or_else(|| item["thumbnail"].as_str())
                    .map(|s| s.to_string())?;

                if source_url.starts_with("data:") {
                    return None;
                }

                let thumbnail_url = item["thumbnail"]
                    .as_str()
                    .filter(|s| !s.is_empty())
                    .unwrap_or(&source_url)
                    .to_string();

                Some(WebImageResult {
                    id: source_url.clone(),
                    title: item["title"].as_str().unwrap_or("").to_string(),
                    thumbnail_url,
                    source_page: item["url"].as_str().unwrap_or("").to_string(),
                    format: format_from_url(&source_url),
                    width: item["width"].as_u64().unwrap_or(0) as u32,
                    height: item["height"].as_u64().unwrap_or(0) as u32,
                    source_url: source_url.clone(),
                    engine: "duckduckgo".to_string(),
                    query: query.to_string(),
                })
            })
            .collect();

        let has_more = json.get("next").map(|v| !v.is_null()).unwrap_or(false)
            && !mapped.is_empty();

        (mapped, has_more)
    }
}

impl Default for DuckDuckGoProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl ImageSearchProvider for DuckDuckGoProvider {
    fn id(&self) -> &str {
        "duckduckgo"
    }

    async fn search(
        &self,
        query: &str,
        opts: &SearchOptions,
    ) -> Result<WebImageSearchPage, SearchError> {
        let client = self.client()?;
        let vqd = self.fetch_vqd(&client, query).await?;

        throttle("duckduckgo_images").await;

        let offset = (opts.page.saturating_sub(1)) * RESULTS_PER_PAGE;
        let filter = Self::filter_param(opts.transparent);
        let safe = Self::safe_search_param(opts.safe_search);
        let offset_str = offset.to_string();

        let resp = client
            .get(IMAGES_URL)
            .query(&[
                ("l", "us-en"),
                ("o", "json"),
                ("q", query),
                ("vqd", vqd.as_str()),
                ("f", filter.as_str()),
                ("p", safe),
                ("s", offset_str.as_str()),
                ("ct", "AT"),
            ])
            .header("User-Agent", BROWSER_UA)
            .header("Accept", "application/json, text/javascript, */*; q=0.01")
            .header("Accept-Language", "en-US,en;q=0.9")
            .header("Referer", "https://duckduckgo.com/")
            .header("X-Requested-With", "XMLHttpRequest")
            .send()
            .await
            .map_err(|e| {
                if e.is_timeout() {
                    SearchError::Timeout("image request".to_string())
                } else {
                    SearchError::Network(e.to_string())
                }
            })?;

        let status = resp.status().as_u16();
        if status == 429 || status == 403 {
            return Err(SearchError::Blocked(
                "DuckDuckGo is rate limiting requests. Wait a moment and try again.".to_string(),
            ));
        }
        if !(200..300).contains(&status) {
            return Err(SearchError::Http(status));
        }

        let body = resp.text().await.map_err(|e| SearchError::Network(e.to_string()))?;
        let json: Value = serde_json::from_str(&body).map_err(|e| {
            SearchError::Blocked(format!(
                "DuckDuckGo returned a non-JSON response (possibly an anti-bot page): {}",
                e
            ))
        })?;

        let (results, has_more) = self.parse_results(&json, query);

        Ok(WebImageSearchPage {
            results,
            page: opts.page,
            has_more,
            engine: "duckduckgo".to_string(),
            note: None,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn provider() -> DuckDuckGoProvider {
        DuckDuckGoProvider::new()
    }

    #[test]
    fn extracts_vqd_from_various_shapes() {
        assert_eq!(
            VQD_RE.captures(r#"var x = {vqd:"4-1234567890"}"#).unwrap().get(1).unwrap().as_str(),
            "4-1234567890"
        );
        assert_eq!(
            VQD_RE.captures(r#"vqd='3-99'"#).unwrap().get(1).unwrap().as_str(),
            "3-99"
        );
        assert_eq!(
            VQD_RE.captures(r#"https://duckduckgo.com/i.js?vqd=4-20240101&o=json"#)
                .unwrap().get(1).unwrap().as_str(),
            "4-20240101"
        );
        assert!(VQD_RE.captures("no token here").is_none());
    }

    #[test]
    fn maps_results_and_pagination() {
        let json = json!({
            "results": [
                {
                    "title": "Halo",
                    "image": "https://cdn.example.com/halo.png",
                    "thumbnail": "https://t.example.com/halo.jpg",
                    "url": "https://example.com/page",
                    "width": 1920,
                    "height": 1080
                },
                {
                    "title": "dupe",
                    "image": "https://cdn.example.com/halo.png",
                    "thumbnail": "https://t.example.com/halo.jpg",
                    "width": 1920,
                    "height": 1080
                },
                { "title": "no image" }
            ],
            "next": "https://duckduckgo.com/i.js?next"
        });

        let (results, has_more) = provider().parse_results(&json, "halo");
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].source_url, "https://cdn.example.com/halo.png");
        assert_eq!(results[0].format, "png");
        assert_eq!(results[0].width, 1920);
        assert_eq!(results[0].source_page, "https://example.com/page");
        assert!(has_more);
    }

    #[test]
    fn decodes_data_uris_are_skipped() {
        let json = json!({
            "results": [
                { "image": "data:image/png;base64,AAAA", "thumbnail": "data:x" }
            ]
        });
        let (results, has_more) = provider().parse_results(&json, "q");
        assert!(results.is_empty());
        assert!(!has_more);
    }

    #[test]
    fn filter_param_marks_transparent() {
        assert_eq!(DuckDuckGoProvider::filter_param(false), ",,,,,");
        assert_eq!(DuckDuckGoProvider::filter_param(true), ",,transparent,,,");
    }

    #[tokio::test]
    #[ignore]
    async fn live_search_returns_results() {
        let p = DuckDuckGoProvider::new();
        let opts = SearchOptions {
            page: 1,
            safe_search: true,
            transparent: false,
            min_width: None,
            min_height: None,
        };
        match p.search("Halo game cover art", &opts).await {
            Ok(page) => {
                println!("DDG returned {} results", page.results.len());
                assert!(!page.results.is_empty());
            }
            Err(e) => println!("live DDG search failed (expected on some networks): {}", e.message()),
        }
    }
}
