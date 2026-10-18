pub mod steam;
pub mod epic;
pub mod gog;
pub mod ea;
pub mod ubisoft;
pub mod battlenet;
pub mod rockstar;
pub mod xbox;
pub mod local;
pub mod emulator;
pub mod metadata;

use crate::plugins::PluginManager;

pub fn register_all_builtin_plugins(manager: &mut PluginManager) {
    manager.register_plugin(Box::new(steam::SteamPlugin::new()));
    manager.register_plugin(Box::new(epic::EpicPlugin::new()));
    manager.register_plugin(Box::new(gog::GogPlugin::new()));
    manager.register_plugin(Box::new(ea::EaPlugin::new()));
    manager.register_plugin(Box::new(ubisoft::UbisoftPlugin::new()));
    manager.register_plugin(Box::new(battlenet::BattleNetPlugin::new()));
    manager.register_plugin(Box::new(rockstar::RockstarPlugin::new()));
    manager.register_plugin(Box::new(xbox::XboxPlugin::new()));
    manager.register_plugin(Box::new(local::LocalPlugin::new()));
    manager.register_plugin(Box::new(emulator::EmulatorPlugin::new()));
    manager.register_plugin(Box::new(metadata::igdb::IgdbMetadataPlugin::new()));
    manager.register_plugin(Box::new(metadata::steam_store::SteamStoreMetadataPlugin::new()));
}
