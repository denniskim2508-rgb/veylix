use crate::plugins::settings as plugin_settings;
use std::collections::HashMap;

pub fn get_provider_config(provider_id: &str) -> HashMap<String, serde_json::Value> {
    plugin_settings::load_plugin_settings(provider_id)
}

pub fn save_provider_config(provider_id: &str, config: &HashMap<String, serde_json::Value>) {
    plugin_settings::save_plugin_settings(provider_id, config);
}

pub fn delete_provider_config(provider_id: &str) {
    plugin_settings::delete_plugin_settings(provider_id);
}

pub fn get_api_key(provider_id: &str, key_name: &str) -> Option<String> {
    let config = get_provider_config(provider_id);
    config
        .get(key_name)
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
}

pub fn is_provider_configured(provider_id: &str, required_keys: &[&str]) -> bool {
    let config = get_provider_config(provider_id);
    required_keys.iter().all(|key| {
        config
            .get(*key)
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .is_some()
    })
}
