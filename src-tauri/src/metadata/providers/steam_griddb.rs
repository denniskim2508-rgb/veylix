use async_trait::async_trait;
use super::super::models::*;
use super::super::traits::*;
use super::super::settings;
use super::super::rate_limiter::ProviderRateLimiter;
use std::sync::Arc;

const BASE_URL: &str = "https://www.steamgriddb.com/api/v2";

pub struct SteamGridDbProvider {
    limiter: Arc<ProviderRateLimiter>,
}

impl SteamGridDbProvider {
    pub fn new() -> Self {
        let limiter = Arc::new(ProviderRateLimiter::new());
        limiter.configure("steamgriddb", 5.0, 1.0);
        Self { limiter }
    }

    fn api_key(&self) -> Option<String> {
        settings::get_api_key("steamgriddb", "api_key")
    }

    fn client(&self) -> Result<reqwest::Client, ProviderError> {
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .build()
            .map_err(|e| ProviderError::NetworkError(e.to_string()))
    }

    async fn get_json<T: serde::de::DeserializeOwned>(&self, path: &str) -> Result<T, ProviderError> {
        let api_key = self.api_key().ok_or(ProviderError::NotConfigured)?;
        let wait = self.limiter.wait_for_token("steamgriddb");
        if !wait.is_zero() {
            tokio::time::sleep(wait).await;
        }

        let client = self.client()?;
        let url = format!("{}/{}", BASE_URL, path.trim_start_matches('/'));
        let resp = client
            .get(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .send()
            .await
            .map_err(|e| ProviderError::NetworkError(e.to_string()))?;

        let status = resp.status();
        if status.as_u16() == 429 {
            self.limiter.on_rate_limited("steamgriddb", Some(std::time::Duration::from_secs(5)));
            return Err(ProviderError::RateLimited);
        }
        if status.as_u16() == 401 {
            return Err(ProviderError::AuthenticationFailed("Invalid API key".to_string()));
        }
        if status.as_u16() == 404 {
            return Err(ProviderError::NotFound);
        }
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(ProviderError::ApiError(status.as_u16(), body));
        }

        resp.json().await.map_err(|e| ProviderError::ParseError(e.to_string()))
    }
}

#[derive(serde::Deserialize)]
struct SgdbResponse<T> {
    success: bool,
    data: Option<T>,
    errors: Option<Vec<String>>,
}

#[derive(serde::Deserialize)]
struct SgdbGame {
    id: u64,
    name: String,
    #[serde(default)]
    types: Vec<String>,
    #[serde(default)]
    verified: bool,
}

#[derive(serde::Deserialize)]
struct SgdbImage {
    id: u64,
    #[serde(default)]
    score: f64,
    #[serde(default)]
    #[allow(dead_code)]
    style: String,
    url: String,
    #[serde(default)]
    thumb: String,
    #[serde(default)]
    width: Option<u32>,
    #[serde(default)]
    height: Option<u32>,
    #[serde(default)]
    #[allow(dead_code)]
    author: Option<SgdbAuthor>,
}

#[derive(serde::Deserialize)]
struct SgdbAuthor {
    #[serde(default)]
    #[allow(dead_code)]
    name: String,
}

impl Default for SteamGridDbProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl MetadataProvider for SteamGridDbProvider {
    fn id(&self) -> &str {
        "steamgriddb"
    }

    fn name(&self) -> &str {
        "SteamGridDB"
    }

    fn capabilities(&self) -> Vec<ProviderCapability> {
        vec![
            ProviderCapability::Search,
            ProviderCapability::Cover,
            ProviderCapability::Hero,
            ProviderCapability::Logo,
            ProviderCapability::Icon,
        ]
    }

    fn is_configured(&self) -> bool {
        self.api_key().is_some()
    }

    async fn test_connection(&self) -> Result<String, ProviderError> {
        let _ = self.api_key().ok_or(ProviderError::NotConfigured)?;
        #[derive(serde::Deserialize)]
        struct SearchResp { #[allow(dead_code)] success: bool }

        let _wait = self.limiter.wait_for_token("steamgriddb");
        let client = self.client()?;
        let api_key = self.api_key().unwrap();
        let resp = client
            .get(format!("{}/search/autocomplete/half-life", BASE_URL))
            .header("Authorization", format!("Bearer {}", api_key))
            .send()
            .await
            .map_err(|e| ProviderError::NetworkError(e.to_string()))?;

        let status = resp.status();
        if status.as_u16() == 401 {
            return Err(ProviderError::AuthenticationFailed("Invalid SteamGridDB API key".to_string()));
        }
        if !status.is_success() {
            return Err(ProviderError::ApiError(status.as_u16(), format!("HTTP {}", status)));
        }

        Ok("Connected to SteamGridDB successfully".to_string())
    }

    async fn search_games(&self, query: &str) -> Result<Vec<SearchCandidate>, ProviderError> {
        let resp: SgdbResponse<Vec<SgdbGame>> = self.get_json(&format!(
            "search/autocomplete/{}", urlencoding::encode(query)
        )).await?;

        if !resp.success {
            let errors = resp.errors.unwrap_or_default();
            return Err(ProviderError::ApiError(400, errors.join(", ")));
        }

        let games = resp.data.unwrap_or_default();
        let candidates = games.into_iter().map(|g| SearchCandidate {
            provider: "steamgriddb".to_string(),
            provider_id: g.id.to_string(),
            title: g.name,
            release_year: None,
            platforms: g.types,
            confidence: if g.verified { 0.9 } else { 0.7 },
            cover_url: None,
        }).collect();

        Ok(candidates)
    }

    async fn get_metadata(&self, provider_id: &str) -> Result<EnrichedMetadata, ProviderError> {
        let _resp: SgdbResponse<SgdbGame> = self.get_json(&format!("games/{}", provider_id)).await?;
        Ok(EnrichedMetadata {
            title: None,
            description: None,
            developer: None,
            publisher: None,
            release_date: None,
            genres: vec![],
            rating: None,
            steam_app_id: None,
            igdb_id: None,
            rawg_id: None,
            steamgriddb_id: Some(provider_id.to_string()),
        })
    }

    async fn get_artwork(
        &self,
        provider_id: &str,
        artwork_type: ArtworkType,
    ) -> Result<Vec<GameArtworkCandidate>, ProviderError> {
        let path = match artwork_type {
            ArtworkType::Cover | ArtworkType::Capsule => {
                format!("grids/game/{}", provider_id)
            }
            ArtworkType::Hero => {
                format!("heroes/game/{}", provider_id)
            }
            ArtworkType::Logo => {
                format!("logos/game/{}", provider_id)
            }
            ArtworkType::Icon => {
                format!("icons/game/{}", provider_id)
            }
            _ => return Ok(vec![]),
        };

        let resp: SgdbResponse<Vec<SgdbImage>> = self.get_json(&path).await?;

        if !resp.success {
            return Ok(vec![]);
        }

        let images = resp.data.unwrap_or_default();
        let artwork_type_str = artwork_type.as_str();

        let candidates = images.into_iter().map(|img| {
            let w = img.width.unwrap_or(0) as i32;
            let h = img.height.unwrap_or(0) as i32;
            let asset_id = img.id.to_string();

            let mut score = img.score;
            score += dimension_bonus(artwork_type, w, h);

            GameArtworkCandidate {
                id: 0,
                game_id: 0,
                artwork_type: artwork_type_str.to_string(),
                url: img.url,
                thumbnail_url: if img.thumb.is_empty() { None } else { Some(img.thumb) },
                width: w,
                height: h,
                provider: "steamgriddb".to_string(),
                provider_asset_id: Some(asset_id),
                score,
                is_primary: false,
                selection_mode: "automatic".to_string(),
                cached_path: None,
                created_at: String::new(),
                updated_at: String::new(),
            }
        }).collect();

        Ok(candidates)
    }

    async fn get_screenshots(
        &self,
        _provider_id: &str,
    ) -> Result<Vec<GameArtworkCandidate>, ProviderError> {
        Ok(vec![])
    }
}

fn dimension_bonus(artwork_type: ArtworkType, w: i32, h: i32) -> f64 {
    if w == 0 || h == 0 {
        return 0.0;
    }
    let ratio = w as f64 / h as f64;
    match artwork_type {
        ArtworkType::Cover | ArtworkType::Capsule => {
            if (0.6..0.75).contains(&ratio) { 2.0 }
            else if (0.4..0.9).contains(&ratio) { 1.0 }
            else { -1.0 }
        }
        ArtworkType::Hero => {
            if ratio > 2.5 { 2.0 }
            else if ratio > 1.5 { 1.0 }
            else { -1.0 }
        }
        ArtworkType::Logo => {
            if ratio > 1.0 && ratio < 4.0 { 1.0 }
            else { 0.0 }
        }
        _ => 0.0,
    }
}
