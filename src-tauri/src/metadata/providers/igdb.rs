use async_trait::async_trait;
use super::super::models::*;
use super::super::traits::*;
use super::super::rate_limiter::ProviderRateLimiter;
use std::sync::Arc;

pub struct IgdbMetadataProvider {
    limiter: Arc<ProviderRateLimiter>,
}

impl IgdbMetadataProvider {
    pub fn new() -> Self {
        let limiter = Arc::new(ProviderRateLimiter::new());
        limiter.configure("igdb", 8.0, 1.0);
        Self { limiter }
    }

    fn client_id(&self) -> Option<String> {
        super::super::settings::get_api_key("igdb", "client_id")
    }

    fn client_secret(&self) -> Option<String> {
        super::super::settings::get_api_key("igdb", "client_secret")
    }

    fn client(&self) -> Result<reqwest::Client, ProviderError> {
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .build()
            .map_err(|e| ProviderError::NetworkError(e.to_string()))
    }

    async fn authenticate(&self) -> Result<String, ProviderError> {
        let client_id = self.client_id().ok_or(ProviderError::NotConfigured)?;
        let client_secret = self.client_secret().ok_or(ProviderError::NotConfigured)?;

        let client = self.client()?;
        let resp = client.post("https://id.twitch.tv/oauth2/token")
            .form(&[
                ("client_id", client_id.as_str()),
                ("client_secret", client_secret.as_str()),
                ("grant_type", "client_credentials"),
            ])
            .send()
            .await
            .map_err(|e| ProviderError::NetworkError(e.to_string()))?;

        let status = resp.status();
        if status.as_u16() == 401 {
            return Err(ProviderError::AuthenticationFailed("Invalid IGDB credentials".to_string()));
        }
        if !status.is_success() {
            return Err(ProviderError::ApiError(status.as_u16(), format!("HTTP {}", status)));
        }

        let body: serde_json::Value = resp.json().await
            .map_err(|e| ProviderError::ParseError(e.to_string()))?;

        body["access_token"].as_str()
            .map(|s| s.to_string())
            .ok_or(ProviderError::ParseError("No access_token in response".to_string()))
    }

    async fn igdb_post(&self, endpoint: &str, body: &str) -> Result<serde_json::Value, ProviderError> {
        let client_id = self.client_id().ok_or(ProviderError::NotConfigured)?;
        let token = self.authenticate().await?;

        let wait = self.limiter.wait_for_token("igdb");
        if !wait.is_zero() {
            tokio::time::sleep(wait).await;
        }

        let client = self.client()?;
        let url = format!("https://api.igdb.com/v4/{}", endpoint);
        let resp = client.post(&url)
            .header("Client-ID", &client_id)
            .header("Authorization", format!("Bearer {}", token))
            .header("Content-Type", "text/plain")
            .body(body.to_string())
            .send()
            .await
            .map_err(|e| ProviderError::NetworkError(e.to_string()))?;

        let status = resp.status();
        if status.as_u16() == 429 {
            self.limiter.on_rate_limited("igdb", Some(std::time::Duration::from_secs(5)));
            return Err(ProviderError::RateLimited);
        }
        if status.as_u16() == 401 {
            return Err(ProviderError::AuthenticationFailed("IGDB session expired".to_string()));
        }
        if !status.is_success() {
            let body_text = resp.text().await.unwrap_or_default();
            return Err(ProviderError::ApiError(status.as_u16(), body_text));
        }

        resp.json().await.map_err(|e| ProviderError::ParseError(e.to_string()))
    }

    fn igdb_image_url(image_id: &str, size: &str) -> String {
        format!("https://images.igdb.com/igdb/image/upload/t_{}/{}.jpg", size, image_id)
    }
}

impl Default for IgdbMetadataProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl MetadataProvider for IgdbMetadataProvider {
    fn id(&self) -> &str {
        "igdb"
    }

    fn name(&self) -> &str {
        "IGDB"
    }

    fn capabilities(&self) -> Vec<ProviderCapability> {
        vec![
            ProviderCapability::Search,
            ProviderCapability::Metadata,
            ProviderCapability::Cover,
            ProviderCapability::Screenshot,
            ProviderCapability::Background,
            ProviderCapability::Hero,
        ]
    }

    fn is_configured(&self) -> bool {
        self.client_id().is_some() && self.client_secret().is_some()
    }

    async fn test_connection(&self) -> Result<String, ProviderError> {
        self.authenticate().await?;
        let _ = self.igdb_post("games", "fields name; limit 1;").await?;
        Ok("Connected to IGDB successfully".to_string())
    }

    async fn search_games(&self, query: &str) -> Result<Vec<SearchCandidate>, ProviderError> {
        let body = format!("search \"{}\"; fields name,first_release_date,platforms.name,cover.image_id,id; limit 10;", query);
        let json = self.igdb_post("games", &body).await?;

        let games = json.as_array().cloned().unwrap_or_default();
        let mut candidates = Vec::new();

        for game in games {
            let name = game["name"].as_str().unwrap_or("").to_string();
            let provider_id = game["id"].as_u64().unwrap_or(0).to_string();

            let release_year = game["first_release_date"].as_u64().and_then(|ts| {
                let dt = chrono::DateTime::from_timestamp(ts as i64, 0)?;
                Some(dt.format("%Y").to_string().parse::<u32>().ok())
            }).flatten();

            let platforms: Vec<String> = game["platforms"].as_array()
                .map(|arr| arr.iter().filter_map(|p| p["name"].as_str().map(|s| s.to_string())).collect())
                .unwrap_or_default();

            let cover_url = game["cover"]["image_id"].as_str()
                .map(|id| Self::igdb_image_url(id, "cover_small"));

            candidates.push(SearchCandidate {
                provider: "igdb".to_string(),
                provider_id,
                title: name,
                release_year,
                platforms,
                confidence: 0.8,
                cover_url,
            });
        }

        Ok(candidates)
    }

    async fn get_metadata(&self, provider_id: &str) -> Result<EnrichedMetadata, ProviderError> {
        let body = format!(
            "fields name,storyline,summary,developers.name,publishers.name,release_dates.human,genres.name,aggregated_rating,category; where id = {};",
            provider_id
        );
        let json = self.igdb_post("games", &body).await?;

        let game = json.as_array()
            .and_then(|arr| arr.first().cloned())
            .ok_or(ProviderError::NotFound)?;

        let title = game["name"].as_str().map(|s| s.to_string());
        let description = game["summary"].as_str()
            .or_else(|| game["storyline"].as_str())
            .map(|s| s.to_string());

        let developer = game["developers"].as_array()
            .and_then(|arr| arr.first())
            .and_then(|d| d["name"].as_str())
            .map(|s| s.to_string());

        let publisher = game["publishers"].as_array()
            .and_then(|arr| arr.first())
            .and_then(|p| p["name"].as_str())
            .map(|s| s.to_string());

        let release_date = game["release_dates"].as_array()
            .and_then(|arr| arr.iter().find(|r| r["human"].as_str().is_some()))
            .and_then(|r| r["human"].as_str())
            .map(|s| s.to_string());

        let genres: Vec<String> = game["genres"].as_array()
            .map(|arr| arr.iter().filter_map(|g| g["name"].as_str().map(|s| s.to_string())).collect())
            .unwrap_or_default();

        let rating = game["aggregated_rating"].as_f64()
            .map(|r| r / 20.0);

        Ok(EnrichedMetadata {
            title,
            description,
            developer,
            publisher,
            release_date,
            genres,
            rating,
            steam_app_id: None,
            igdb_id: Some(provider_id.to_string()),
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

        let (field, img_size) = match artwork_type {
            ArtworkType::Cover | ArtworkType::Capsule => ("cover.image_id", "cover_big"),
            ArtworkType::Hero | ArtworkType::Background => ("artworks.image_id,artworks.width,artworks.height", "1080p"),
            ArtworkType::Screenshot => ("screenshots.image_id,screenshots.width,screenshots.height", "screenshot_huge"),
            _ => return Ok(vec![]),
        };

        let body = format!("fields {}; where id = {};", field, provider_id);
        let json = self.igdb_post("games", &body).await?;

        let game = json.as_array()
            .and_then(|arr| arr.first().cloned())
            .ok_or(ProviderError::NotFound)?;

        let mut candidates = Vec::new();

        match artwork_type {
            ArtworkType::Cover | ArtworkType::Capsule => {
                if let Some(image_id) = game["cover"]["image_id"].as_str() {
                    let w = game["cover"]["width"].as_i64().unwrap_or(0) as i32;
                    let h = game["cover"]["height"].as_i64().unwrap_or(0) as i32;
                    candidates.push(GameArtworkCandidate {
                        id: 0, game_id: 0,
                        artwork_type: artwork_type_str.to_string(),
                        url: Self::igdb_image_url(image_id, img_size),
                        thumbnail_url: Some(Self::igdb_image_url(image_id, "cover_small")),
                        width: w, height: h,
                        provider: "igdb".to_string(),
                        provider_asset_id: Some(image_id.to_string()),
                        score: 9.0,
                        is_primary: false,
                        selection_mode: "automatic".to_string(),
                        cached_path: None,
                        created_at: String::new(),
                        updated_at: String::new(),
                    });
                }
            }
            ArtworkType::Hero | ArtworkType::Background => {
                if let Some(arr) = game["artworks"].as_array() {
                    for a in arr.iter().take(5) {
                        if let Some(image_id) = a["image_id"].as_str() {
                            let w = a["width"].as_i64().unwrap_or(0) as i32;
                            let h = a["height"].as_i64().unwrap_or(0) as i32;
                            candidates.push(GameArtworkCandidate {
                                id: 0, game_id: 0,
                                artwork_type: artwork_type_str.to_string(),
                                url: Self::igdb_image_url(image_id, img_size),
                                thumbnail_url: Some(Self::igdb_image_url(image_id, "720p")),
                                width: w, height: h,
                                provider: "igdb".to_string(),
                                provider_asset_id: Some(image_id.to_string()),
                                score: 9.0,
                                is_primary: false,
                                selection_mode: "automatic".to_string(),
                                cached_path: None,
                                created_at: String::new(),
                                updated_at: String::new(),
                            });
                        }
                    }
                }
            }
            ArtworkType::Screenshot => {
                if let Some(arr) = game["screenshots"].as_array() {
                    for s in arr.iter().take(10) {
                        if let Some(image_id) = s["image_id"].as_str() {
                            let w = s["width"].as_i64().unwrap_or(0) as i32;
                            let h = s["height"].as_i64().unwrap_or(0) as i32;
                            candidates.push(GameArtworkCandidate {
                                id: 0, game_id: 0,
                                artwork_type: artwork_type_str.to_string(),
                                url: Self::igdb_image_url(image_id, img_size),
                                thumbnail_url: Some(Self::igdb_image_url(image_id, "screenshot_med")),
                                width: w, height: h,
                                provider: "igdb".to_string(),
                                provider_asset_id: Some(image_id.to_string()),
                                score: 8.0,
                                is_primary: false,
                                selection_mode: "automatic".to_string(),
                                cached_path: None,
                                created_at: String::new(),
                                updated_at: String::new(),
                            });
                        }
                    }
                }
            }
            _ => {}
        }

        Ok(candidates)
    }

    async fn get_screenshots(
        &self,
        provider_id: &str,
    ) -> Result<Vec<GameArtworkCandidate>, ProviderError> {
        self.get_artwork(provider_id, ArtworkType::Screenshot).await
    }
}
