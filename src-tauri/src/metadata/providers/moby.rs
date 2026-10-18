use async_trait::async_trait;
use super::super::models::*;
use super::super::traits::*;
use super::super::settings;
use super::super::rate_limiter::ProviderRateLimiter;
use std::sync::Arc;

const BASE_URL: &str = "https://api.mobygames.com/v1";

pub struct MobyGamesProvider {
    limiter: Arc<ProviderRateLimiter>,
}

impl MobyGamesProvider {
    pub fn new() -> Self {
        let limiter = Arc::new(ProviderRateLimiter::new());
        // Hobbyist tier allows one request per second.
        limiter.configure("mobygames", 1.0, 1.0);
        Self { limiter }
    }

    fn api_key(&self) -> Option<String> {
        settings::get_api_key("mobygames", "api_key")
    }

    fn client(&self) -> Result<reqwest::Client, ProviderError> {
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .build()
            .map_err(|e| ProviderError::NetworkError(e.to_string()))
    }

    async fn get_json(&self, path: &str, extra_params: &[(&str, &str)]) -> Result<serde_json::Value, ProviderError> {
        let key = self.api_key().ok_or(ProviderError::NotConfigured)?;

        let wait = self.limiter.wait_for_token("mobygames");
        if !wait.is_zero() {
            tokio::time::sleep(wait).await;
        }

        let client = self.client()?;
        let url = format!("{}/{}", BASE_URL, path.trim_start_matches('/'));
        let mut req = client.get(&url).query(&[("api_key", key.as_str())]);

        for (k, v) in extra_params {
            req = req.query(&[(*k, *v)]);
        }

        let resp = req.send().await
            .map_err(|e| ProviderError::NetworkError(e.to_string()))?;

        let status = resp.status();
        if status.as_u16() == 429 {
            self.limiter.on_rate_limited("mobygames", Some(std::time::Duration::from_secs(10)));
            return Err(ProviderError::RateLimited);
        }
        if status.as_u16() == 401 {
            return Err(ProviderError::AuthenticationFailed("Invalid MobyGames API key".to_string()));
        }
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            let message = serde_json::from_str::<serde_json::Value>(&body).ok()
                .and_then(|v| v["message"].as_str().or_else(|| v["error"].as_str()).map(|s| s.to_string()))
                .unwrap_or(body);
            return Err(ProviderError::ApiError(status.as_u16(), message));
        }

        resp.json().await.map_err(|e| ProviderError::ParseError(e.to_string()))
    }
}

impl Default for MobyGamesProvider {
    fn default() -> Self {
        Self::new()
    }
}

fn year_from_date(date: &str) -> Option<u32> {
    date.get(0..4)?.parse::<u32>().ok()
}

fn earliest_platform_date(item: &serde_json::Value) -> Option<String> {
    item["platforms"].as_array()?
        .iter()
        .filter_map(|p| p["first_release_date"].as_str())
        .filter(|d| !d.is_empty())
        .min_by_key(|d| year_from_date(d).unwrap_or(u32::MAX))
        .map(|s| s.to_string())
}

fn platform_names(item: &serde_json::Value) -> Vec<String> {
    item["platforms"].as_array()
        .map(|arr| arr.iter()
            .filter_map(|p| p["platform_name"].as_str().map(|s| s.to_string()))
            .collect())
        .unwrap_or_default()
}

fn asset_filename(url: &str) -> String {
    url.rsplit('/').next().unwrap_or(url).to_string()
}

fn map_search_candidate(item: &serde_json::Value) -> SearchCandidate {
    SearchCandidate {
        provider: "mobygames".to_string(),
        provider_id: item["game_id"].as_i64().unwrap_or(0).to_string(),
        title: item["title"].as_str().unwrap_or("").to_string(),
        release_year: earliest_platform_date(item).as_deref().and_then(year_from_date),
        platforms: platform_names(item),
        confidence: 0.75,
        cover_url: item["sample_cover"]["image"].as_str().map(|s| s.to_string()),
    }
}

fn cover_candidate(provider_id: &str, item: &serde_json::Value, artwork_type_str: &str) -> Option<GameArtworkCandidate> {
    let cover = &item["sample_cover"];
    let url = cover["image"].as_str()?;
    if url.is_empty() {
        return None;
    }

    let _ = provider_id;
    Some(GameArtworkCandidate {
        id: 0,
        game_id: 0,
        artwork_type: artwork_type_str.to_string(),
        url: url.to_string(),
        thumbnail_url: cover["thumbnail_image"].as_str().map(|s| s.to_string()),
        width: cover["width"].as_i64().unwrap_or(0) as i32,
        height: cover["height"].as_i64().unwrap_or(0) as i32,
        provider: "mobygames".to_string(),
        provider_asset_id: Some(asset_filename(url)),
        score: 8.0,
        is_primary: false,
        selection_mode: "automatic".to_string(),
        cached_path: None,
        created_at: String::new(),
        updated_at: String::new(),
    })
}

fn screenshot_candidates(provider_id: &str, item: &serde_json::Value, artwork_type_str: &str) -> Vec<GameArtworkCandidate> {
    let _ = provider_id;
    item["sample_screenshots"].as_array()
        .map(|arr| {
            arr.iter()
                .take(10)
                .enumerate()
                .filter_map(|(i, ss)| {
                    let url = ss["image"].as_str()?;
                    if url.is_empty() {
                        return None;
                    }
                    Some(GameArtworkCandidate {
                        id: 0,
                        game_id: 0,
                        artwork_type: artwork_type_str.to_string(),
                        url: url.to_string(),
                        thumbnail_url: ss["thumbnail_image"].as_str().map(|s| s.to_string()),
                        width: ss["width"].as_i64().unwrap_or(0) as i32,
                        height: ss["height"].as_i64().unwrap_or(0) as i32,
                        provider: "mobygames".to_string(),
                        provider_asset_id: Some(asset_filename(url)),
                        score: 7.5 - (i as f64 * 0.1),
                        is_primary: false,
                        selection_mode: "automatic".to_string(),
                        cached_path: None,
                        created_at: String::new(),
                        updated_at: String::new(),
                    })
                })
                .collect()
        })
        .unwrap_or_default()
}

/// MobyGames descriptions are HTML. Turn them into plain text without pulling
/// in an HTML parser: drop tags, decode the common entities, collapse runs of
/// whitespace.
fn strip_html(input: &str) -> String {
    let mut without_tags = String::with_capacity(input.len());
    let mut in_tag = false;
    for ch in input.chars() {
        match ch {
            '<' => {
                in_tag = true;
                without_tags.push(' ');
            }
            '>' => {
                in_tag = false;
                without_tags.push(' ');
            }
            _ if in_tag => {}
            _ => without_tags.push(ch),
        }
    }

    decode_entities(&without_tags)
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn decode_entities(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();

    while let Some(c) = chars.next() {
        if c != '&' {
            out.push(c);
            continue;
        }

        let mut entity = String::new();
        let mut closed = false;
        while let Some(&next) = chars.peek() {
            if next == ';' {
                chars.next();
                closed = true;
                break;
            }
            if next.is_whitespace() || next == '&' {
                break;
            }
            entity.push(next);
            chars.next();
        }

        if closed {
            if entity.is_empty() {
                out.push('&');
                out.push(';');
            } else if let Some(decoded) = decode_entity(&entity) {
                out.push(decoded);
            } else {
                out.push('&');
                out.push_str(&entity);
                out.push(';');
            }
        } else {
            out.push('&');
            out.push_str(&entity);
        }
    }

    out
}

fn decode_entity(entity: &str) -> Option<char> {
    match entity {
        "amp" => Some('&'),
        "lt" => Some('<'),
        "gt" => Some('>'),
        "quot" => Some('"'),
        "apos" => Some('\''),
        "nbsp" => Some(' '),
        "ndash" | "mdash" => Some('-'),
        "hellip" => Some('\u{2026}'),
        _ => {
            if let Some(hex) = entity.strip_prefix("#x").or_else(|| entity.strip_prefix("#X")) {
                u32::from_str_radix(hex, 16).ok().and_then(char::from_u32)
            } else if let Some(dec) = entity.strip_prefix('#') {
                dec.parse::<u32>().ok().and_then(char::from_u32)
            } else {
                None
            }
        }
    }
}

#[async_trait]
impl MetadataProvider for MobyGamesProvider {
    fn id(&self) -> &str {
        "mobygames"
    }

    fn name(&self) -> &str {
        "MobyGames"
    }

    fn capabilities(&self) -> Vec<ProviderCapability> {
        vec![
            ProviderCapability::Search,
            ProviderCapability::Metadata,
            ProviderCapability::Cover,
            ProviderCapability::Screenshot,
        ]
    }

    fn is_configured(&self) -> bool {
        self.api_key().is_some()
    }

    async fn test_connection(&self) -> Result<String, ProviderError> {
        if self.api_key().is_none() {
            return Err(ProviderError::NotConfigured);
        }
        let _ = self.get_json("games", &[("limit", "1")]).await?;
        Ok("Connected to MobyGames successfully".to_string())
    }

    async fn search_games(&self, query: &str) -> Result<Vec<SearchCandidate>, ProviderError> {
        let json = self.get_json("games", &[
            ("title", query),
            ("format", "normal"),
            ("limit", "10"),
        ]).await?;

        let games = json["games"].as_array().cloned().unwrap_or_default();
        Ok(games.iter().map(map_search_candidate).collect())
    }

    async fn get_metadata(&self, provider_id: &str) -> Result<EnrichedMetadata, ProviderError> {
        let json = self.get_json(&format!("games/{}", provider_id), &[]).await?;

        let title = json["title"].as_str().map(|s| s.to_string());
        let description = json["description"].as_str()
            .map(strip_html)
            .filter(|s| !s.is_empty());

        let genres: Vec<String> = json["genres"].as_array()
            .map(|arr| arr.iter().filter_map(|g| g["genre_name"].as_str().map(|s| s.to_string())).collect())
            .unwrap_or_default();

        let release_date = earliest_platform_date(&json);
        let rating = json["moby_score"].as_f64();

        Ok(EnrichedMetadata {
            title,
            description,
            developer: None,
            publisher: None,
            release_date,
            genres,
            rating,
            steam_app_id: None,
            igdb_id: None,
            rawg_id: None,
            steamgriddb_id: None,
        })
    }

    async fn get_artwork(
        &self,
        provider_id: &str,
        artwork_type: ArtworkType,
    ) -> Result<Vec<GameArtworkCandidate>, ProviderError> {
        let artwork_type_str = artwork_type.as_str();

        match artwork_type {
            ArtworkType::Cover | ArtworkType::Capsule => {
                let json = self.get_json(&format!("games/{}", provider_id), &[]).await?;
                Ok(cover_candidate(provider_id, &json, artwork_type_str).into_iter().collect())
            }
            ArtworkType::Screenshot => {
                let json = self.get_json(&format!("games/{}", provider_id), &[]).await?;
                Ok(screenshot_candidates(provider_id, &json, artwork_type_str))
            }
            _ => Ok(vec![]),
        }
    }

    async fn get_screenshots(
        &self,
        provider_id: &str,
    ) -> Result<Vec<GameArtworkCandidate>, ProviderError> {
        self.get_artwork(provider_id, ArtworkType::Screenshot).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn strips_html_and_decodes_entities() {
        let html = "<p><em>Budokai Tenkaichi 3</em> is a 1vs1 fighting game &amp; more &ndash; ok.</p>\n<p>Second&#8217;s line</p>";
        let text = strip_html(html);
        assert!(text.contains("Budokai Tenkaichi 3"));
        assert!(text.contains("game & more"));
        assert!(!text.contains('<'));
        assert!(!text.contains("&amp;"));
        assert!(!text.contains("&#8217;"));
        assert!(!text.contains("  "));
    }

    #[test]
    fn maps_search_candidate_fields() {
        let item = json!({
            "game_id": 40017,
            "title": "Dragon Ball Z: Budokai Tenkaichi 3",
            "platforms": [
                {"platform_id": 7, "platform_name": "PlayStation 2", "first_release_date": "2007-10-04"},
                {"platform_id": 3, "platform_name": "Windows", "first_release_date": "2003"}
            ],
            "sample_cover": {
                "image": "https://cdn.mobygames.com/covers/5564015-x-playstation-2-front-cover.jpg",
                "thumbnail_image": "https://cdn.mobygames.com/abc.webp",
                "width": 565, "height": 800
            }
        });

        let candidate = map_search_candidate(&item);
        assert_eq!(candidate.provider, "mobygames");
        assert_eq!(candidate.provider_id, "40017");
        assert_eq!(candidate.release_year, Some(2003));
        assert_eq!(candidate.platforms, vec!["PlayStation 2".to_string(), "Windows".to_string()]);
        assert!(candidate.cover_url.unwrap().contains("5564015"));
    }

    #[test]
    fn builds_cover_and_screenshot_candidates() {
        let item = json!({
            "sample_cover": {
                "image": "https://cdn.mobygames.com/covers/5564015-x-front-cover.jpg",
                "thumbnail_image": "https://cdn.mobygames.com/abc.webp",
                "width": 565, "height": 800
            },
            "sample_screenshots": [
                {"image": "https://cdn.mobygames.com/screenshots/111-a.png", "thumbnail_image": "https://cdn.mobygames.com/t1.webp", "caption": "Title", "width": 320, "height": 240},
                {"image": "https://cdn.mobygames.com/screenshots/222-b.png", "thumbnail_image": "https://cdn.mobygames.com/t2.webp", "caption": "Play", "width": 640, "height": 480}
            ]
        });

        let cover = cover_candidate("40017", &item, "cover").unwrap();
        assert_eq!(cover.artwork_type, "cover");
        assert_eq!(cover.provider_asset_id.as_deref(), Some("5564015-x-front-cover.jpg"));
        assert_eq!(cover.width, 565);

        let screenshots = screenshot_candidates("40017", &item, "screenshot");
        assert_eq!(screenshots.len(), 2);
        assert_eq!(screenshots[0].artwork_type, "screenshot");
        assert_eq!(screenshots[0].provider_asset_id.as_deref(), Some("111-a.png"));
        assert!(screenshots[0].score > screenshots[1].score);
    }

    #[test]
    fn missing_media_yields_no_candidates() {
        let item = json!({ "sample_cover": null, "sample_screenshots": [] });
        assert!(cover_candidate("1", &item, "cover").is_none());
        assert!(screenshot_candidates("1", &item, "screenshot").is_empty());
    }
}
