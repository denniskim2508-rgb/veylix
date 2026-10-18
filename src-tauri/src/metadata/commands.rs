use super::models::*;
use super::database;
use super::resolver::{MetadataResolver, ArtworkResolver};
use crate::library::ArtworkSearchResult;
use std::sync::Arc;

pub async fn resolve_game_metadata_cmd(
    game_id: i64,
    registry: Arc<super::provider_registry::ProviderRegistry>,
) -> Result<EnrichedMetadata, String> {
    let resolver = MetadataResolver::new(registry);
    resolver.resolve_metadata(game_id).await
}

pub async fn resolve_game_artwork_cmd(
    game_id: i64,
    artwork_type: String,
    registry: Arc<super::provider_registry::ProviderRegistry>,
) -> Result<Vec<GameArtworkCandidate>, String> {
    let art_type = ArtworkType::from_str(&artwork_type)
        .ok_or_else(|| format!("Invalid artwork type: {}", artwork_type))?;
    let resolver = ArtworkResolver::new(registry);
    resolver.resolve_artwork(game_id, art_type).await
}

pub async fn resolve_all_artwork_cmd(
    game_id: i64,
    registry: Arc<super::provider_registry::ProviderRegistry>,
) -> Result<(), String> {
    let resolver = ArtworkResolver::new(registry);
    for art_type in &[ArtworkType::Cover, ArtworkType::Hero, ArtworkType::Logo, ArtworkType::Background] {
        if let Err(e) = resolver.resolve_artwork(game_id, *art_type).await {
            log::warn!("Failed to resolve {:?} for game {}: {}", art_type, game_id, e);
        }
    }
    Ok(())
}

pub async fn resolve_screenshots_cmd(
    game_id: i64,
    registry: Arc<super::provider_registry::ProviderRegistry>,
) -> Result<Vec<GameArtworkCandidate>, String> {
    let resolver = ArtworkResolver::new(registry);
    resolver.resolve_screenshots(game_id).await
}

pub fn get_artwork_candidates_cmd(
    game_id: i64,
    artwork_type: String,
) -> Result<Vec<GameArtworkCandidate>, String> {
    database::get_artwork_candidates(game_id, &artwork_type)
        .map_err(|e| e.to_string())
}

pub fn set_primary_artwork_cmd(
    artwork_id: i64,
    game_id: i64,
    artwork_type: String,
) -> Result<(), String> {
    database::set_primary_artwork(artwork_id, game_id, &artwork_type)
        .map_err(|e| e.to_string())?;

    let candidates = database::get_artwork_candidates(game_id, &artwork_type).unwrap_or_default();
    if let Some(primary) = candidates.iter().find(|c| c.is_primary) {
        let update = match artwork_type.as_str() {
            "cover" | "capsule" => crate::library::GameUpdate { cover_image: Some(primary.url.clone()), ..Default::default() },
            "hero" | "background" => crate::library::GameUpdate { background_image: Some(primary.url.clone()), ..Default::default() },
            "logo" => crate::library::GameUpdate { logo: Some(primary.url.clone()), ..Default::default() },
            "icon" => crate::library::GameUpdate { icon: Some(primary.url.clone()), ..Default::default() },
            _ => crate::library::GameUpdate::default(),
        };
        crate::library::update_game(game_id, &update).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn reset_artwork_to_automatic_cmd(
    game_id: i64,
    artwork_type: String,
) -> Result<(), String> {
    database::reset_artwork_to_automatic(game_id, &artwork_type)
        .map_err(|e| e.to_string())
}

pub fn get_provider_priorities_cmd(category: String) -> Result<Vec<ProviderPriority>, String> {
    database::get_provider_priorities(&category).map_err(|e| e.to_string())
}

pub fn set_provider_priorities_cmd(
    category: String,
    priorities: Vec<PriorityEngineEntry>,
) -> Result<(), String> {
    let entries: Vec<(String, i32, bool)> = priorities
        .into_iter()
        .map(|p| (p.provider, p.priority_order, p.is_enabled))
        .collect();
    database::set_provider_priorities(&category, &entries).map_err(|e| e.to_string())
}

pub async fn search_artwork_multi_provider_cmd(
    game_name: String,
    artwork_type: String,
    registry: Arc<super::provider_registry::ProviderRegistry>,
) -> Result<Vec<ArtworkSearchResult>, String> {
    let art_type = ArtworkType::from_str(&artwork_type)
        .ok_or_else(|| format!("Invalid artwork type: {}", artwork_type))?;

    let cap = match art_type {
        ArtworkType::Screenshot => ProviderCapability::Screenshot,
        _ => ProviderCapability::Cover,
    };

    let providers = registry.for_capability(cap);
    let mut results = Vec::new();

    for provider in &providers {
        match provider.search_games(&game_name).await {
            Ok(candidates) => {
                for candidate in candidates.into_iter().take(3) {
                    match provider.get_artwork(&candidate.provider_id, art_type).await {
                        Ok(artworks) => {
                            for art in artworks.into_iter().take(5) {
                                let full_url = art.url;
                                let thumbnail = art.thumbnail_url.unwrap_or_default();
                                results.push(ArtworkSearchResult {
                                    title: candidate.title.clone(),
                                    source_url: full_url.clone(),
                                    thumbnail_url: if thumbnail.is_empty() { full_url } else { thumbnail },
                                    width: art.width as u32,
                                    height: art.height as u32,
                                    provider: provider.name().to_string(),
                                });
                            }
                        }
                        Err(_) => {}
                    }
                }
            }
            Err(_) => {}
        }
    }

    Ok(results)
}

#[derive(serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PriorityEngineEntry {
    pub provider: String,
    pub priority_order: i32,
    pub is_enabled: bool,
}
