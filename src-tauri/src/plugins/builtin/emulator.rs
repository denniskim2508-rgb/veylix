use crate::plugins::traits::{Plugin, GenericPlugin, PluginType, SidebarItem, SidebarIconType};
use std::any::Any;

pub struct EmulatorPlugin;

impl EmulatorPlugin {
    pub fn new() -> Self {
        Self
    }
}

impl Default for EmulatorPlugin {
    fn default() -> Self {
        Self::new()
    }
}

impl Plugin for EmulatorPlugin {
    fn id(&self) -> &str {
        "emulator"
    }

    fn name(&self) -> &str {
        "Emulator Support"
    }

    fn version(&self) -> &str {
        "1.0.0"
    }

    fn description(&self) -> &str {
        "Emulator integration and ROM management"
    }

    fn author(&self) -> &str {
        "GameHub"
    }

    fn plugin_type(&self) -> PluginType {
        PluginType::Generic
    }

    fn on_load(&mut self) {}
    fn on_unload(&mut self) {}

    fn as_any(&self) -> &dyn Any {
        self
    }
}

impl GenericPlugin for EmulatorPlugin {
    fn get_sidebar_items(&self) -> Vec<SidebarItem> {
        vec![
            SidebarItem {
                id: "emulators".to_string(),
                title: "Emulators".to_string(),
                icon: None,
                icon_type: SidebarIconType::Platform,
                badge: None,
            }
        ]
    }
}
