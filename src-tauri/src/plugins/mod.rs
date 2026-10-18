pub mod traits;
pub mod manifest;
pub mod settings;
pub mod builtin;

use traits::{Plugin, PluginType, PluginManifest};
use crate::core::events::EventBus;
use std::sync::Arc;

pub struct PluginManager {
    plugins: Vec<Box<dyn Plugin>>,
    library_plugins: Vec<usize>,
    metadata_plugins: Vec<usize>,
    generic_plugins: Vec<usize>,
    #[allow(dead_code)]
    event_bus: Arc<EventBus>,
    manifests: Vec<PluginManifest>,
}

impl PluginManager {
    pub fn new(event_bus: Arc<EventBus>) -> Self {
        Self {
            plugins: Vec::new(),
            library_plugins: Vec::new(),
            metadata_plugins: Vec::new(),
            generic_plugins: Vec::new(),
            event_bus,
            manifests: Vec::new(),
        }
    }

    pub fn register_plugin(&mut self, mut plugin: Box<dyn Plugin>) {
        let plugin_type = plugin.plugin_type();
        let idx = self.plugins.len();
        let manifest = manifest::create_builtin_manifest(
            plugin.id(),
            plugin.name(),
            plugin.version(),
            plugin.description(),
            plugin.author(),
            plugin_type.clone(),
        );

        plugin.on_load();

        match plugin_type {
            PluginType::Library => self.library_plugins.push(idx),
            PluginType::Metadata => self.metadata_plugins.push(idx),
            PluginType::Generic => self.generic_plugins.push(idx),
        }

        self.manifests.push(manifest);
        self.plugins.push(plugin);
    }

    #[allow(dead_code)]
    pub fn get_plugin(&self, id: &str) -> Option<&dyn Plugin> {
        self.plugins.iter().find(|p| p.id() == id).map(|p| p.as_ref())
    }

    #[allow(dead_code)]
    pub fn get_plugin_ids(&self) -> Vec<String> {
        self.plugins.iter().map(|p| p.id().to_string()).collect()
    }

    #[allow(dead_code)]
    pub fn get_library_plugin_ids(&self) -> Vec<String> {
        self.library_plugins
            .iter()
            .map(|&idx| self.plugins[idx].id().to_string())
            .collect()
    }

    #[allow(dead_code)]
    pub fn get_metadata_plugin_ids(&self) -> Vec<String> {
        self.metadata_plugins
            .iter()
            .map(|&idx| self.plugins[idx].id().to_string())
            .collect()
    }

    pub fn get_plugin_manifests(&self) -> Vec<PluginManifest> {
        self.manifests.clone()
    }

    #[allow(dead_code)]
    pub fn emit_event(&self, event: &crate::core::events::PluginEvent) {
        self.event_bus.emit(event);
    }

    #[allow(dead_code)]
    pub fn plugin_count(&self) -> usize {
        self.plugins.len()
    }

    #[allow(dead_code)]
    pub fn library_plugin_count(&self) -> usize {
        self.library_plugins.len()
    }

    #[allow(dead_code)]
    pub fn metadata_plugin_count(&self) -> usize {
        self.metadata_plugins.len()
    }
}

impl Default for PluginManager {
    fn default() -> Self {
        Self::new(Arc::new(EventBus::new()))
    }
}
