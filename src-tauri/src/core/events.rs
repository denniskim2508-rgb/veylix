#![allow(dead_code)]

use std::sync::Mutex;
use std::collections::HashMap;

pub type EventHandler = Box<dyn Fn(&PluginEvent) + Send + Sync>;

#[derive(Debug, Clone)]
pub enum PluginEvent {
    ApplicationStarted,
    ApplicationStopped,
    GameStarted { game_id: i64 },
    GameStopped { game_id: i64, duration_minutes: u64 },
    GameInstalled { game_id: i64 },
    GameUninstalled { game_id: i64 },
    GameSelected { game_id: i64 },
    LibraryUpdated { game_count: usize },
    ScanStarted,
    ScanCompleted { new_game_count: usize },
    PluginLoaded { plugin_id: String },
    PluginUnloaded { plugin_id: String },
}

pub struct EventBus {
    handlers: Mutex<HashMap<String, Vec<EventHandler>>>,
    global_handlers: Mutex<Vec<EventHandler>>,
}

impl EventBus {
    pub fn new() -> Self {
        Self {
            handlers: Mutex::new(HashMap::new()),
            global_handlers: Mutex::new(Vec::new()),
        }
    }

    pub fn subscribe(&self, event_type: &str, handler: EventHandler) {
        let mut handlers = self.handlers.lock().unwrap();
        handlers
            .entry(event_type.to_string())
            .or_insert_with(Vec::new)
            .push(handler);
    }

    pub fn subscribe_all(&self, handler: EventHandler) {
        let mut handlers = self.global_handlers.lock().unwrap();
        handlers.push(handler);
    }

    pub fn emit(&self, event: &PluginEvent) {
        let event_type = match event {
            PluginEvent::ApplicationStarted => "application_started",
            PluginEvent::ApplicationStopped => "application_stopped",
            PluginEvent::GameStarted { .. } => "game_started",
            PluginEvent::GameStopped { .. } => "game_stopped",
            PluginEvent::GameInstalled { .. } => "game_installed",
            PluginEvent::GameUninstalled { .. } => "game_uninstalled",
            PluginEvent::GameSelected { .. } => "game_selected",
            PluginEvent::LibraryUpdated { .. } => "library_updated",
            PluginEvent::ScanStarted => "scan_started",
            PluginEvent::ScanCompleted { .. } => "scan_completed",
            PluginEvent::PluginLoaded { .. } => "plugin_loaded",
            PluginEvent::PluginUnloaded { .. } => "plugin_unloaded",
        };

        let handlers = self.handlers.lock().unwrap();
        if let Some(event_handlers) = handlers.get(event_type) {
            for handler in event_handlers {
                handler(event);
            }
        }

        let global_handlers = self.global_handlers.lock().unwrap();
        for handler in global_handlers.iter() {
            handler(event);
        }
    }
}

impl Default for EventBus {
    fn default() -> Self {
        Self::new()
    }
}
