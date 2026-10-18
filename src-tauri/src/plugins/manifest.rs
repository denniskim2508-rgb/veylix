#![allow(dead_code)]

use crate::plugins::traits::{PluginManifest, PluginType, SettingDefinition};
use std::collections::HashMap;

pub fn parse_manifest(json: &str) -> Result<PluginManifest, String> {
    let manifest: serde_json::Value = serde_json::from_str(json)
        .map_err(|e| format!("Failed to parse manifest JSON: {}", e))?;

    let id = manifest["id"]
        .as_str()
        .ok_or("Missing 'id' field in manifest")?
        .to_string();

    let name = manifest["name"]
        .as_str()
        .ok_or("Missing 'name' field in manifest")?
        .to_string();

    let version = manifest["version"]
        .as_str()
        .ok_or("Missing 'version' field in manifest")?
        .to_string();

    let description = manifest["description"]
        .as_str()
        .unwrap_or("")
        .to_string();

    let author = manifest["author"]
        .as_str()
        .unwrap_or("Unknown")
        .to_string();

    let plugin_type = match manifest["type"].as_str().unwrap_or("generic") {
        "library" => PluginType::Library,
        "metadata" => PluginType::Metadata,
        "generic" => PluginType::Generic,
        other => return Err(format!("Unknown plugin type: {}", other)),
    };

    let entry_point = manifest["entry_point"].as_str().map(|s| s.to_string());

    let mut settings_schema = None;
    if let Some(settings) = manifest.get("settings_schema") {
        if let Some(obj) = settings.as_object() {
            let mut schema = HashMap::new();
            for (key, value) in obj {
                if let Some(field_type) = value["type"].as_str() {
                    let label = value["label"]
                        .as_str()
                        .unwrap_or(key)
                        .to_string();
                    let default_value = value.get("default").cloned();
                    let description = value["description"].as_str().map(|s| s.to_string());
                    schema.insert(
                        key.clone(),
                        SettingDefinition {
                            field_type: field_type.to_string(),
                            label,
                            default_value,
                            description,
                        },
                    );
                }
            }
            settings_schema = Some(schema);
        }
    }

    Ok(PluginManifest {
        id,
        name,
        version,
        description,
        author,
        plugin_type,
        entry_point,
        settings_schema,
    })
}

pub fn create_builtin_manifest(
    id: &str,
    name: &str,
    version: &str,
    description: &str,
    author: &str,
    plugin_type: PluginType,
) -> PluginManifest {
    PluginManifest {
        id: id.to_string(),
        name: name.to_string(),
        version: version.to_string(),
        description: description.to_string(),
        author: author.to_string(),
        plugin_type,
        entry_point: None,
        settings_schema: None,
    }
}
