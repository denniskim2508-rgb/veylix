use async_trait::async_trait;
use super::super::models::*;
use super::super::traits::*;
use super::super::rate_limiter::ProviderRateLimiter;
use std::sync::Arc;

const STORE_API: &str = "https://store.steampowered.com/api";
const CDN_BASE: &str = "https://cdn.akamai.steamstatic.com";

pub struct SteamProvider {
    limiter: Arc<ProviderRateLimiter>,
}

impl SteamProvider {
    pub fn new() -> Self {
        let limiter = Arc::new(ProviderRateLimiter::new());
        limiter.configure("steam", 20.0, 2.0);
        Self { limiter }
    }

    fn client(&self) -> Result<reqwest::Client, ProviderError> {
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .build()
            .map_err(|e| ProviderError::NetworkError(e.to_string()))
    }

    fn wait(&self) {
        let wait = self.limiter.wait_for_token("steam");
        if !wait.is_zero() {
            std::thread::sleep(wait);
        }
    }

    async fn app_details(&self, app_id: &str) -> Result<serde_json::Value, ProviderError> {
        self.wait();

        let client = self.client()?;
        let url = format!("{}/appdetails?appids={}", STORE_API, app_id);
        let resp = client.get(&url)
            .query(&[("cc", "us"), ("l", "english")])
            .send()
            .await
            .map_err(|e| ProviderError::NetworkError(e.to_string()))?;

        let status = resp.status();
        if status.as_u16() == 429 {
            self.limiter.on_rate_limited("steam", Some(std::time::Duration::from_secs(10)));
            return Err(ProviderError::RateLimited);
        }
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(ProviderError::ApiError(status.as_u16(), body));
        }

        let json: serde_json::Value = resp.json().await
            .map_err(|e| ProviderError::ParseError(e.to_string()))?;

        if let Some(app_data) = json.get(app_id) {
            if app_data["success"].as_bool() == Some(true) {
                if let Some(data) = app_data.get("data") {
                    return Ok(data.clone());
                }
            }
        }
        Err(ProviderError::NotFound)
    }
}

impl Default for SteamProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl MetadataProvider for SteamProvider {
    fn id(&self) -> &str {
        "steam"
    }

    fn name(&self) -> &str {
        "Steam"
    }

    fn capabilities(&self) -> Vec<ProviderCapability> {
        vec![
            ProviderCapability::Search,
            ProviderCapability::Metadata,
            ProviderCapability::Cover,
            ProviderCapability::Hero,
            ProviderCapability::Logo,
            ProviderCapability::Screenshot,
            ProviderCapability::Background,
            ProviderCapability::Header,
        ]
    }

    fn is_configured(&self) -> bool {
        true
    }

    async fn test_connection(&self) -> Result<String, ProviderError> {
        let client = self.client()?;
        let resp = client.get(format!("{}/appdetails?appids=730", STORE_API))
            .query(&[("cc", "us")])
            .send()
            .await
            .map_err(|e| ProviderError::NetworkError(e.to_string()))?;

        if resp.status().is_success() {
            Ok("Connected to Steam Store API".to_string())
        } else {
            Err(ProviderError::ApiError(resp.status().as_u16(), "Steam API unreachable".to_string()))
        }
    }

    async fn search_games(&self, query: &str) -> Result<Vec<SearchCandidate>, ProviderError> {
        self.wait();

        let client = self.client()?;
        let url = format!("https://store.steampowered.com/api/storesearch/?term={}&l=english&cc=us", urlencoding::encode(query));
        let resp = client.get(&url)
            .send()
            .await
            .map_err(|e| ProviderError::NetworkError(e.to_string()))?;

        let status = resp.status();
        if status.as_u16() == 429 {
            self.limiter.on_rate_limited("steam", Some(std::time::Duration::from_secs(5)));
            return Err(ProviderError::RateLimited);
        }
        if !status.is_success() {
            return Err(ProviderError::ApiError(status.as_u16(), format!("HTTP {}", status)));
        }

        let json: serde_json::Value = resp.json().await
            .map_err(|e| ProviderError::ParseError(e.to_string()))?;

        let items = json["items"].as_array().cloned().unwrap_or_default();
        let mut candidates = Vec::new();

        for item in items {
            let id = item["id"].as_u64().unwrap_or(0);
            let name = item["name"].as_str().unwrap_or("").to_string();

            let platforms: Vec<String> = item["platforms"].as_array()
                .map(|arr| arr.iter()
                    .filter_map(|p| {
                        if p["windows"].as_bool() == Some(true) {
                            Some("Windows".to_string())
                        } else {
                            None
                        }
                    })
                    .collect()
                )
                .unwrap_or_default();

            let cover_url = item["tiny_image"].as_str().map(|s| s.to_string());

            candidates.push(SearchCandidate {
                provider: "steam".to_string(),
                provider_id: id.to_string(),
                title: name,
                release_year: None,
                platforms,
                confidence: 0.75,
                cover_url,
            });
        }

        Ok(candidates)
    }

    async fn get_metadata(&self, provider_id: &str) -> Result<EnrichedMetadata, ProviderError> {
        let data = self.app_details(provider_id).await?;

        let title = data["name"].as_str().map(|s| s.to_string());
        let description = data["short_description"].as_str().map(|s| s.to_string());

        let developers: Vec<String> = data["developers"].as_array()
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
            .unwrap_or_default();
        let publishers: Vec<String> = data["publishers"].as_array()
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
            .unwrap_or_default();

        let release_date = data["release_date"]["date"].as_str().map(|s| s.to_string());

        let genres: Vec<String> = data["genres"].as_array()
            .map(|arr| arr.iter().filter_map(|g| g["description"].as_str().map(|s| s.to_string())).collect())
            .unwrap_or_default();

        let rating = data["metacritic"]["score"].as_f64()
            .map(|s| s / 20.0);

        Ok(EnrichedMetadata {
            title,
            description,
            developer: developers.first().cloned(),
            publisher: publishers.first().cloned(),
            release_date,
            genres,
            rating,
            steam_app_id: Some(provider_id.to_string()),
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
                let url = format!("{}/library_600x900.jpg", format!("{}/steam/apps/{}", CDN_BASE, provider_id));
                Ok(vec![GameArtworkCandidate {
                    id: 0, game_id: 0,
                    artwork_type: artwork_type_str.to_string(),
                    url,
                    thumbnail_url: None,
                    width: 600, height: 900,
                    provider: "steam".to_string(),
                    provider_asset_id: Some(format!("{}_cover", provider_id)),
                    score: 10.0,
                    is_primary: false,
                    selection_mode: "automatic".to_string(),
                    cached_path: None,
                    created_at: String::new(),
                    updated_at: String::new(),
                }])
            }
            ArtworkType::Hero | ArtworkType::Background => {
                let url = format!("{}/steam/apps/{}/library_hero.jpg", CDN_BASE, provider_id);
                Ok(vec![GameArtworkCandidate {
                    id: 0, game_id: 0,
                    artwork_type: artwork_type_str.to_string(),
                    url,
                    thumbnail_url: None,
                    width: 1920, height: 620,
                    provider: "steam".to_string(),
                    provider_asset_id: Some(format!("{}_hero", provider_id)),
                    score: 10.0,
                    is_primary: false,
                    selection_mode: "automatic".to_string(),
                    cached_path: None,
                    created_at: String::new(),
                    updated_at: String::new(),
                }])
            }
            ArtworkType::Header => {
                let url = format!("{}/steam/apps/{}/header.jpg", CDN_BASE, provider_id);
                Ok(vec![GameArtworkCandidate {
                    id: 0, game_id: 0,
                    artwork_type: artwork_type_str.to_string(),
                    url,
                    thumbnail_url: None,
                    width: 460, height: 215,
                    provider: "steam".to_string(),
                    provider_asset_id: Some(format!("{}_header", provider_id)),
                    score: 10.0,
                    is_primary: false,
                    selection_mode: "automatic".to_string(),
                    cached_path: None,
                    created_at: String::new(),
                    updated_at: String::new(),
                }])
            }
            ArtworkType::Logo => {
                let url = format!("{}/steam/apps/{}/logo.png", CDN_BASE, provider_id);
                Ok(vec![GameArtworkCandidate {
                    id: 0, game_id: 0,
                    artwork_type: artwork_type_str.to_string(),
                    url,
                    thumbnail_url: None,
                    width: 0, height: 0,
                    provider: "steam".to_string(),
                    provider_asset_id: Some(format!("{}_logo", provider_id)),
                    score: 10.0,
                    is_primary: false,
                    selection_mode: "automatic".to_string(),
                    cached_path: None,
                    created_at: String::new(),
                    updated_at: String::new(),
                }])
            }
            _ => Ok(vec![]),
        }
    }

    async fn get_screenshots(
        &self,
        provider_id: &str,
    ) -> Result<Vec<GameArtworkCandidate>, ProviderError> {
        let data = self.app_details(provider_id).await?;

        let screenshots = data["screenshots"].as_array().cloned().unwrap_or_default();
        let mut candidates = Vec::new();

        for (i, ss) in screenshots.into_iter().take(10).enumerate() {
            let url = ss["path_full"].as_str().unwrap_or("").to_string();
            if url.is_empty() { continue; }

            let thumb = ss["path_thumbnail"].as_str().unwrap_or("").to_string();

            candidates.push(GameArtworkCandidate {
                id: 0, game_id: 0,
                artwork_type: "screenshot".to_string(),
                url,
                thumbnail_url: if thumb.is_empty() { None } else { Some(thumb) },
                width: ss["width"].as_i64().unwrap_or(0) as i32,
                height: ss["height"].as_i64().unwrap_or(0) as i32,
                provider: "steam".to_string(),
                provider_asset_id: Some(format!("{}_ss_{}", provider_id, i)),
                score: 8.0 - (i as f64 * 0.1),
                is_primary: false,
                selection_mode: "automatic".to_string(),
                cached_path: None,
                created_at: String::new(),
                updated_at: String::new(),
            });
        }

        Ok(candidates)
    }
}
