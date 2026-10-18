use super::traits::MetadataProvider;
use super::database;
use std::sync::Arc;

pub struct ProviderRegistry {
    providers: Vec<Arc<dyn MetadataProvider>>,
}

impl ProviderRegistry {
    pub fn new() -> Self {
        Self {
            providers: Vec::new(),
        }
    }

    pub fn register(&mut self, provider: Arc<dyn MetadataProvider>) {
        log::info!("[Metadata] Registered provider: {} ({})", provider.name(), provider.id());
        self.providers.push(provider);
    }

    pub fn get(&self, id: &str) -> Option<Arc<dyn MetadataProvider>> {
        self.providers.iter().find(|p| p.id() == id).cloned()
    }

    pub fn all(&self) -> &[Arc<dyn MetadataProvider>] {
        &self.providers
    }

    pub fn configured(&self) -> Vec<Arc<dyn MetadataProvider>> {
        self.providers.iter().filter(|p| p.is_configured()).cloned().collect()
    }

    pub fn for_capability(&self, cap: super::models::ProviderCapability) -> Vec<Arc<dyn MetadataProvider>> {
        self.providers
            .iter()
            .filter(|p| p.is_configured() && p.capabilities().contains(&cap))
            .cloned()
            .collect()
    }

    pub fn for_artwork_type(&self, artwork_type: super::models::ArtworkType) -> Vec<Arc<dyn MetadataProvider>> {
        let cap = match artwork_type {
            super::models::ArtworkType::Cover | super::models::ArtworkType::Capsule => super::models::ProviderCapability::Cover,
            super::models::ArtworkType::Hero => super::models::ProviderCapability::Hero,
            super::models::ArtworkType::Logo => super::models::ProviderCapability::Logo,
            super::models::ArtworkType::Background => super::models::ProviderCapability::Background,
            super::models::ArtworkType::Icon => super::models::ProviderCapability::Icon,
            super::models::ArtworkType::Screenshot => super::models::ProviderCapability::Screenshot,
            super::models::ArtworkType::Header => super::models::ProviderCapability::Header,
        };

        let category = artwork_type.as_str();
        let priorities = database::get_provider_priorities(category).unwrap_or_default();
        let enabled: Vec<String> = priorities
            .iter()
            .filter(|p| p.is_enabled)
            .map(|p| p.provider.clone())
            .collect();

        if enabled.is_empty() {
            return self.for_capability(cap);
        }

        self.providers
            .iter()
            .filter(|p| p.is_configured() && enabled.contains(&p.id().to_string()) && p.capabilities().contains(&cap))
            .cloned()
            .collect()
    }
}

impl Default for ProviderRegistry {
    fn default() -> Self {
        Self::new()
    }
}
