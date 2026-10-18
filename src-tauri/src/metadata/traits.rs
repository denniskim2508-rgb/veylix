use super::models::*;
use async_trait::async_trait;
use std::fmt;

#[derive(Debug)]
pub enum ProviderError {
    NotConfigured,
    AuthenticationFailed(String),
    RateLimited,
    NetworkError(String),
    ApiError(u16, String),
    NotFound,
    ParseError(String),
}

impl fmt::Display for ProviderError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NotConfigured => write!(f, "Provider not configured"),
            Self::AuthenticationFailed(msg) => write!(f, "Authentication failed: {}", msg),
            Self::RateLimited => write!(f, "Rate limited"),
            Self::NetworkError(msg) => write!(f, "Network error: {}", msg),
            Self::ApiError(status, msg) => write!(f, "API error (HTTP {}): {}", status, msg),
            Self::NotFound => write!(f, "Not found"),
            Self::ParseError(msg) => write!(f, "Parse error: {}", msg),
        }
    }
}

impl std::error::Error for ProviderError {}

#[async_trait]
pub trait MetadataProvider: Send + Sync {
    fn id(&self) -> &str;
    fn name(&self) -> &str;
    fn capabilities(&self) -> Vec<ProviderCapability>;
    fn is_configured(&self) -> bool;
    async fn test_connection(&self) -> Result<String, ProviderError>;
    async fn search_games(&self, query: &str) -> Result<Vec<SearchCandidate>, ProviderError>;
    async fn get_metadata(&self, provider_id: &str) -> Result<EnrichedMetadata, ProviderError>;
    async fn get_artwork(
        &self,
        provider_id: &str,
        artwork_type: ArtworkType,
    ) -> Result<Vec<GameArtworkCandidate>, ProviderError>;
    async fn get_screenshots(
        &self,
        provider_id: &str,
    ) -> Result<Vec<GameArtworkCandidate>, ProviderError>;
}
