use async_trait::async_trait;
use super::super::models::*;
use super::super::traits::*;
use super::super::settings;
use super::super::rate_limiter::ProviderRateLimiter;
use std::sync::Arc;

const BASE_URL: &str = "https://api.rawg.io/api";

pub struct RawgProvider {
    limiter: Arc<ProviderRateLimiter>,
}

impl RawgProvider {
    pub fn new() -> Self {
        let limiter = Arc::new(ProviderRateLimiter::new());
        limiter.configure("rawg", 10.0, 2.0);
        Self { limiter }
    }

    fn api_key(&self) -> Option<String> {
        settings::get_api_key("rawg", "api_key")
    }

    fn client(&self) -> Result<reqwest::Client, ProviderError> {
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .build()
            .map_err(|e| ProviderError::NetworkError(e.to_string()))
    }

    async fn get_json(&self, path: &str, extra_params: &[(&str, &str)]) -> Result<serde_json::Value, ProviderError> {
        let wait = self.limiter.wait_for_token("rawg");
        if !wait.is_zero() {
            tokio::time::sleep(wait).await;
        }

        let client = self.client()?;
        let url = format!("{}/{}", BASE_URL, path.trim_start_matches('/'));
        let mut req = client.get(&url);

        if let Some(key) = self.api_key() {
            req = req.query(&[("key", key.as_str())]);
        }

        for (k, v) in extra_params {
            req = req.query(&[(*k, *v)]);
        }

        let resp = req.send().await
            .map_err(|e| ProviderError::NetworkError(e.to_string()))?;

        let status = resp.status();
        if status.as_u16() == 429 {
            self.limiter.on_rate_limited("rawg", Some(std::time::Duration::from_secs(10)));
            return Err(ProviderError::RateLimited);
        }
        if status.as_u16() == 401 {
            return Err(ProviderError::AuthenticationFailed("Invalid RAWG API key".to_string()));
        }
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(ProviderError::ApiError(status.as_u16(), body));
        }

        resp.json().await.map_err(|e| ProviderError::ParseError(e.to_string()))
    }
}

impl Default for RawgProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl MetadataProvider for RawgProvider {
    fn id(&self) -> &str {
        "rawg"
    }

    fn name(&self) -> &str {
        "RAWG"
    }

    fn capabilities(&self) -> Vec<ProviderCapability> {
        vec![
            ProviderCapability::Search,
            ProviderCapability::Metadata,
            ProviderCapability::Cover,
            ProviderCapability::Screenshot,
            ProviderCapability::Background,
        ]
    }

    fn is_configured(&self) -> bool {
        self.api_key().is_some()
    }

    async fn test_connection(&self) -> Result<String, ProviderError> {
        if self.api_key().is_none() {
            return Err(ProviderError::NotConfigured);
        }
        let _ = self.get_json("games", &[("page_size", "1")]).await?;
        Ok("Connected to RAWG successfully".to_string())
    }

    async fn search_games(&self, query: &str) -> Result<Vec<SearchCandidate>, ProviderError> {
        let json = self.get_json("games", &[
            ("search", query),
            ("page_size", "10"),
        ]).await?;

        let results = json["results"].as_array().cloned().unwrap_or_default();
        let mut candidates = Vec::new();

        for item in results {
            let slug = item["slug"].as_str().unwrap_or("").to_string();
            let name = item["name"].as_str().unwrap_or("").to_string();
            let released = item["released"].as_str().and_then(|s| {
                s.split('-').next()?.parse::<u32>().ok()
            });

            let platforms: Vec<String> = item["platforms"].as_array()
                .map(|arr| arr.iter()
                    .filter_map(|p| p["platform"]["name"].as_str().map(|s| s.to_string()))
                    .collect()
                )
                .unwrap_or_default();

            let cover_url = item["background_image"].as_str().map(|s| s.to_string());

            candidates.push(SearchCandidate {
                provider: "rawg".to_string(),
                provider_id: slug,
                title: name,
                release_year: released,
                platforms,
                confidence: 0.7,
                cover_url,
            });
        }

        Ok(candidates)
    }

    async fn get_metadata(&self, provider_id: &str) -> Result<EnrichedMetadata, ProviderError> {
        let json = self.get_json(&format!("games/{}", provider_id), &[]).await?;

        let title = json["name"].as_str().map(|s| s.to_string());
        let description = json["description_raw"].as_str()
            .or_else(|| json["description"].as_str())
            .map(|s| s.to_string());

        let developers: Vec<String> = json["developers"].as_array()
            .map(|arr| arr.iter().filter_map(|d| d["name"].as_str().map(|s| s.to_string())).collect())
            .unwrap_or_default();
        let publishers: Vec<String> = json["publishers"].as_array()
            .map(|arr| arr.iter().filter_map(|p| p["name"].as_str().map(|s| s.to_string())).collect())
            .unwrap_or_default();

        let release_date = json["released"].as_str().map(|s| s.to_string());

        let genres: Vec<String> = json["genres"].as_array()
            .map(|arr| arr.iter().filter_map(|g| g["name"].as_str().map(|s| s.to_string())).collect())
            .unwrap_or_default();

        let rating = json["rating"].as_f64()
            .map(|r| r * 2.0);

        let steam_app_id = json["stores"].as_array()
            .and_then(|stores| {
                stores.iter().find(|s| s["store"]["id"].as_i64() == Some(1))
            })
            .and_then(|s| s["url"].as_str())
            .and_then(|url| {
                url.split("app/").nth(1)?
                    .split('/').next()?
                    .parse::<u64>().ok()
            })
            .map(|id| id.to_string());

        Ok(EnrichedMetadata {
            title,
            description,
            developer: developers.first().cloned(),
            publisher: publishers.first().cloned(),
            release_date,
            genres,
            rating,
            steam_app_id,
            igdb_id: None,
            rawg_id: Some(provider_id.to_string()),
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
                let json = self.get_json(&format!("games/{}", provider_id), &[("screenshots", "true")]).await?;
                let url = json["background_image"].as_str().unwrap_or("").to_string();
                if url.is_empty() { return Ok(vec![]); }

                Ok(vec![GameArtworkCandidate {
                    id: 0, game_id: 0,
                    artwork_type: artwork_type_str.to_string(),
                    url,
                    thumbnail_url: None,
                    width: 0, height: 0,
                    provider: "rawg".to_string(),
                    provider_asset_id: Some(format!("{}_cover", provider_id)),
                    score: 7.0,
                    is_primary: false,
                    selection_mode: "automatic".to_string(),
                    cached_path: None,
                    created_at: String::new(),
                    updated_at: String::new(),
                }])
            }
            ArtworkType::Screenshot => {
                let json = self.get_json(
                    &format!("games/{}/screenshots", provider_id),
                    &[("page_size", "20")],
                ).await?;

                let results = json["results"].as_array().cloned().unwrap_or_default();
                let mut candidates = Vec::new();

                for (i, ss) in results.into_iter().take(10).enumerate() {
                    let url = ss["image"].as_str().unwrap_or("").to_string();
                    if url.is_empty() { continue; }
                    let thumb = ss["image_preview"].as_str().unwrap_or("").to_string();

                    candidates.push(GameArtworkCandidate {
                        id: 0, game_id: 0,
                        artwork_type: artwork_type_str.to_string(),
                        url,
                        thumbnail_url: if thumb.is_empty() { None } else { Some(thumb) },
                        width: 0, height: 0,
                        provider: "rawg".to_string(),
                        provider_asset_id: Some(format!("{}_ss_{}", provider_id, i)),
                        score: 7.0 - (i as f64 * 0.1),
                        is_primary: false,
                        selection_mode: "automatic".to_string(),
                        cached_path: None,
                        created_at: String::new(),
                        updated_at: String::new(),
                    });
                }

                Ok(candidates)
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
