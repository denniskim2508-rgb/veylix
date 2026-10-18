mod core;
mod drives;
mod launcher;
mod scanners;
mod plugins;
mod library;
mod emulators;
mod settings;
mod addons;
pub mod controller;
pub mod metadata;

use library::{GameRow, GameUpdate, PlaySessionRow, ScreenshotRow, ArtworkSearchResult};
use settings::ScanFolderRow;
use emulators::{EmulatorRow, RomScanFolderRow};
use drives::DriveInfo;
use plugins::traits::PluginManifest;
use core::events::EventBus;
use plugins::PluginManager;
use plugins::settings as plugin_settings;
use metadata::provider_registry::ProviderRegistry;
use metadata::providers::steam_griddb::SteamGridDbProvider;
use metadata::providers::steam::SteamProvider;
use metadata::providers::igdb::IgdbMetadataProvider;
use metadata::providers::rawg::RawgProvider;
use metadata::providers::moby::MobyGamesProvider;
use std::sync::{Arc, Mutex};
use once_cell::sync::Lazy;

static PLUGIN_MANAGER: Lazy<Mutex<Option<PluginManager>>> = Lazy::new(|| Mutex::new(None));
static EVENT_BUS: Lazy<Arc<EventBus>> = Lazy::new(|| Arc::new(EventBus::new()));
static PROVIDER_REGISTRY: Lazy<Arc<Mutex<Option<Arc<ProviderRegistry>>>>> = Lazy::new(|| Arc::new(Mutex::new(None)));

#[tauri::command]
fn get_games() -> Result<Vec<GameRow>, String> {
    library::get_all_games().map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_drives() -> Vec<DriveInfo> {
    tauri::async_runtime::spawn_blocking(drives::enumerate_drives)
        .await
        .unwrap_or_default()
}

#[tauri::command]
fn add_game(
    title: String,
    platform: String,
    install_path: Option<String>,
    executable_path: Option<String>,
    platform_game_id: Option<String>,
    launch_command: Option<String>,
) -> Result<i64, String> {
    let drive_letter = install_path.as_ref().and_then(|p| p.chars().next()).map(|c| c.to_string());
    library::insert_game(
        &title,
        &platform,
        install_path.as_deref(),
        executable_path.as_deref(),
        platform_game_id.as_deref(),
        launch_command.as_deref(),
        drive_letter.as_deref(),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_favorite(game_id: i64) -> Result<(), String> {
    library::toggle_favorite(game_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_game(game_id: i64) -> Result<(), String> {
    library::delete_game(game_id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn scan_libraries() -> Result<Vec<GameRow>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let drives = drives::enumerate_drives();
        let scan_folders = settings::get_scan_folder_paths().unwrap_or_default();
        scanners::scan_all(&drives, &scan_folders)
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn launch_game(launch_command: String, executable_path: Option<String>) -> Result<(), String> {
    launcher::launch_game(&launch_command, executable_path.as_deref())
}

#[tauri::command]
fn get_play_sessions(game_id: i64) -> Result<Vec<PlaySessionRow>, String> {
    library::get_play_sessions(game_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn start_play_session(game_id: i64, started_at: String) -> Result<i64, String> {
    library::insert_play_session(game_id, &started_at).map_err(|e| e.to_string())
}

#[tauri::command]
fn end_play_session(session_id: i64, ended_at: String, duration_minutes: i64) -> Result<(), String> {
    library::end_play_session(session_id, &ended_at, duration_minutes).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_playtime(game_id: i64, play_time: i64, last_played: String) -> Result<(), String> {
    library::update_game_playtime(game_id, play_time, &last_played).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_screenshots(game_id: i64) -> Result<Vec<ScreenshotRow>, String> {
    library::get_game_screenshots(game_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_scan_folders() -> Result<Vec<ScanFolderRow>, String> {
    settings::get_scan_folders().map_err(|e| e.to_string())
}

#[tauri::command]
fn add_scan_folder(path: String, label: Option<String>) -> Result<i64, String> {
    settings::add_scan_folder(&path, label.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
fn remove_scan_folder(id: i64) -> Result<(), String> {
    settings::remove_scan_folder(id).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_plugins() -> Result<Vec<PluginManifest>, String> {
    let manager = PLUGIN_MANAGER.lock().unwrap();
    let mgr = manager.as_ref().ok_or("Plugin manager not initialized")?;
    Ok(mgr.get_plugin_manifests())
}

fn mask_secret_fields(settings: &mut serde_json::Value) {
    if let Some(obj) = settings.as_object_mut() {
        for (key, val) in obj.iter_mut() {
            if key.contains("secret") || key.contains("password") || key.contains("token") {
                if val.is_string() && !val.as_str().unwrap_or("").is_empty() {
                    *val = serde_json::Value::Bool(true);
                }
            }
        }
    }
}

#[tauri::command]
fn get_plugin_settings(plugin_id: String) -> Result<serde_json::Value, String> {
    let settings = plugin_settings::load_plugin_settings(&plugin_id);
    let mut value = serde_json::to_value(settings).unwrap_or_default();
    mask_secret_fields(&mut value);
    Ok(value)
}

#[tauri::command]
fn save_plugin_settings(plugin_id: String, settings: serde_json::Value) -> Result<(), String> {
    let map: std::collections::HashMap<String, serde_json::Value> = 
        serde_json::from_value(settings).unwrap_or_default();
    plugin_settings::save_plugin_settings(&plugin_id, &map);
    Ok(())
}

#[tauri::command]
fn get_metadata_providers() -> Result<Vec<PluginManifest>, String> {
    let manager = PLUGIN_MANAGER.lock().unwrap();
    let mgr = manager.as_ref().ok_or("Plugin manager not initialized")?;
    Ok(mgr.get_plugin_manifests()
        .into_iter()
        .filter(|m| matches!(m.plugin_type, plugins::traits::PluginType::Metadata))
        .collect())
}

#[tauri::command]
fn get_library_plugins() -> Result<Vec<PluginManifest>, String> {
    let manager = PLUGIN_MANAGER.lock().unwrap();
    let mgr = manager.as_ref().ok_or("Plugin manager not initialized")?;
    Ok(mgr.get_plugin_manifests()
        .into_iter()
        .filter(|m| matches!(m.plugin_type, plugins::traits::PluginType::Library))
        .collect())
}

// --- Emulator Commands ---

#[tauri::command]
fn get_emulators() -> Result<Vec<EmulatorRow>, String> {
    emulators::get_all_emulators().map_err(|e| e.to_string())
}

#[tauri::command]
fn add_emulator(
    name: String,
    executable_path: String,
    platform: String,
    command_template: Option<String>,
    supported_extensions: Option<String>,
    default_args: Option<String>,
    is_installed: bool,
    icon: Option<String>,
    core_path: Option<String>,
) -> Result<i64, String> {
    emulators::insert_emulator(
        &name,
        &executable_path,
        &platform,
        command_template.as_deref(),
        supported_extensions.as_deref(),
        default_args.as_deref(),
        is_installed,
        icon.as_deref(),
        core_path.as_deref(),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn update_emulator(
    id: i64,
    name: String,
    executable_path: String,
    platform: String,
    command_template: Option<String>,
    supported_extensions: Option<String>,
    default_args: Option<String>,
    is_installed: bool,
    icon: Option<String>,
    core_path: Option<String>,
) -> Result<(), String> {
    emulators::update_emulator(
        id,
        &name,
        &executable_path,
        &platform,
        command_template.as_deref(),
        supported_extensions.as_deref(),
        default_args.as_deref(),
        is_installed,
        icon.as_deref(),
        core_path.as_deref(),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_emulator(id: i64) -> Result<(), String> {
    emulators::delete_emulator(id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn detect_emulators() -> Result<Vec<scanners::emulator::DetectedEmulator>, String> {
    tauri::async_runtime::spawn_blocking(|| Ok(scanners::emulator::get_known_emulators()))
        .await
        .map_err(|e| e.to_string())?
}

// --- ROM Scan Folder Commands ---

#[tauri::command]
fn get_rom_scan_folders() -> Result<Vec<RomScanFolderRow>, String> {
    emulators::get_rom_scan_folders().map_err(|e| e.to_string())
}

#[tauri::command]
fn add_rom_scan_folder(path: String, label: Option<String>, emulator_id: Option<i64>) -> Result<i64, String> {
    emulators::add_rom_scan_folder(&path, label.as_deref(), emulator_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn remove_rom_scan_folder(id: i64) -> Result<(), String> {
    emulators::remove_rom_scan_folder(id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn scan_rom_folders() -> Result<Vec<GameRow>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let drives = drives::enumerate_drives();
        let rom_scan_folders = emulators::get_rom_scan_folder_paths().unwrap_or_default();
        scanners::scan_rom_folders(&drives, &rom_scan_folders)
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_compatible_emulators(game_id: i64) -> Result<Vec<EmulatorRow>, String> {
    let ext = library::get_game_rom_extension(game_id)
        .map_err(|e| e.to_string())?
        .ok_or("Game has no ROM file")?;
    emulators::get_emulators_for_extension(&ext).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_game_emulator_override(game_id: i64, emulator_id: Option<i64>) -> Result<(), String> {
    library::set_game_emulator_override(game_id, emulator_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_scan_exclusions() -> Result<Vec<settings::ScanExclusion>, String> {
    settings::get_scan_exclusions().map_err(|e| e.to_string())
}

#[tauri::command]
fn add_scan_exclusion(pattern: String, exclusion_type: String, is_regex: bool) -> Result<i64, String> {
    settings::add_scan_exclusion(&pattern, &exclusion_type, is_regex).map_err(|e| e.to_string())
}

#[tauri::command]
fn remove_scan_exclusion(id: i64) -> Result<(), String> {
    settings::remove_scan_exclusion(id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn import_dat_file(path: String) -> Result<usize, String> {
    tauri::async_runtime::spawn_blocking(move || crate::emulators::dat_database::import_dat_file(&path))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
fn get_dat_entry_count() -> Result<i64, String> {
    crate::emulators::dat_database::get_dat_entry_count().map_err(|e| e.to_string())
}

#[tauri::command]
async fn clear_dat_database() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(|| crate::emulators::dat_database::clear_dat_database().map_err(|e| e.to_string()))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn lookup_rom_metadata(path: String) -> Result<Option<crate::emulators::DatLookupResult>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let crc = crate::emulators::dat_parser::crc32_hash_file(&path).map_err(|e| e.to_string())?;
        crate::emulators::dat_database::lookup_by_crc32(&crc).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn update_game(game_id: i64, update: GameUpdate) -> Result<(), String> {
    library::update_game(game_id, &update).map_err(|e| e.to_string())
}

#[tauri::command]
async fn upload_artwork(game_id: i64, artwork_type: String, file_path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let relative = library::artwork::save_artwork_file(game_id, &artwork_type, &file_path)?;
        let update = match artwork_type.as_str() {
            "cover" => GameUpdate { cover_image: Some(relative.clone()), ..Default::default() },
            "background" => GameUpdate { background_image: Some(relative.clone()), ..Default::default() },
            "icon" => GameUpdate { icon: Some(relative.clone()), ..Default::default() },
            "logo" => GameUpdate { logo: Some(relative.clone()), ..Default::default() },
            _ => return Err(format!("Unknown artwork type: {}", artwork_type)),
        };
        library::update_game(game_id, &update).map_err(|e| e.to_string())?;
        crate::metadata::database::delete_auto_artwork(game_id, &artwork_type).ok();
        Ok(relative)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn remove_artwork(game_id: i64, artwork_type: String) -> Result<(), String> {
    library::artwork::remove_artwork_file(game_id, &artwork_type)?;
    let col = match artwork_type.as_str() {
        "cover" => "cover_image",
        "background" => "background_image",
        "icon" => "icon",
        "logo" => "logo",
        _ => return Err(format!("Unknown artwork type: {}", artwork_type)),
    };
    let db = crate::core::db::get_db();
    let conn = db.as_ref().unwrap();
    let sql = format!("UPDATE games SET {} = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?1", col);
    conn.execute(&sql, rusqlite::params![game_id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn download_artwork_url(url: String, game_id: i64, artwork_type: String) -> Result<String, String> {
    let relative = library::image_download::download_and_save_artwork(&url, game_id, &artwork_type).await?;
    let update = match artwork_type.as_str() {
        "cover" => GameUpdate { cover_image: Some(relative.clone()), ..Default::default() },
        "background" => GameUpdate { background_image: Some(relative.clone()), ..Default::default() },
        "icon" => GameUpdate { icon: Some(relative.clone()), ..Default::default() },
        "logo" => GameUpdate { logo: Some(relative.clone()), ..Default::default() },
        _ => return Err(format!("Unknown artwork type: {}", artwork_type)),
    };
    library::update_game(game_id, &update).map_err(|e| e.to_string())?;
    crate::metadata::database::delete_auto_artwork(game_id, &artwork_type).ok();
    Ok(relative)
}

#[tauri::command]
async fn search_artwork_online(game_name: String, artwork_type: String) -> Result<Vec<ArtworkSearchResult>, String> {
    metadata::commands::search_artwork_multi_provider_cmd(game_name, artwork_type, get_registry()).await
}

#[tauri::command]
async fn web_image_search(
    query: String,
    engine: String,
    safe_search: Option<bool>,
    transparent: Option<bool>,
    min_width: Option<u32>,
    min_height: Option<u32>,
    page: Option<u32>,
) -> Result<library::web_image_search::WebImageSearchPage, String> {
    let opts = library::web_image_search::SearchOptions {
        page: page.unwrap_or(1).max(1),
        safe_search: safe_search.unwrap_or(true),
        transparent: transparent.unwrap_or(false),
        min_width: min_width.filter(|v| *v > 0),
        min_height: min_height.filter(|v| *v > 0),
    };
    library::web_image_search::search(&engine, &query, &opts)
        .await
        .map_err(|e| e.message())
}

#[tauri::command]
fn web_image_search_query(game_name: String, artwork_type: String) -> String {
    library::web_image_search::build_query(&game_name, &artwork_type)
}

#[tauri::command]
async fn web_image_probe_sizes(urls: Vec<String>) -> Vec<Option<Vec<u32>>> {
    let urls: Vec<String> = urls.into_iter().take(30).collect();
    library::web_image_search::probe_many(urls)
        .await
        .into_iter()
        .map(|d| d.map(|(w, h)| vec![w, h]))
        .collect()
}

#[tauri::command]
fn get_app_data_dir() -> Result<String, String> {
    let dir = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("gamehub");
    Ok(dir.to_string_lossy().to_string())
}

// --- App Settings (key/value) ---

#[tauri::command]
fn get_app_setting(key: String) -> Option<String> {
    settings::get_setting(&key)
}

#[tauri::command]
fn set_app_setting(key: String, value: String) -> Result<(), String> {
    settings::set_setting(&key, &value);
    Ok(())
}

#[tauri::command]
fn get_all_app_settings() -> std::collections::HashMap<String, String> {
    settings::get_all_settings()
}

// --- Trailer commands ---

#[tauri::command]
fn set_game_trailer(game_id: i64, path: String, source: String) -> Result<(), String> {
    library::set_game_trailer(game_id, &path, &source).map_err(|e| e.to_string())
}

#[tauri::command]
fn clear_game_trailer(game_id: i64) -> Result<(), String> {
    library::clear_game_trailer(game_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn probe_trailer(path: String) -> library::trailer::TrailerProbe {
    library::trailer::probe_trailer(&path)
}

#[tauri::command]
fn probe_wallpaper(path: String) -> library::trailer::TrailerProbe {
    library::trailer::probe_wallpaper(&path)
}

#[tauri::command]
fn find_auto_trailer(game_id: i64) -> Option<String> {
    library::trailer::find_auto_trailer(game_id)
}

#[tauri::command]
fn add_screenshot(game_id: i64, url: String, local_path: Option<String>) -> Result<i64, String> {
    let count = library::get_screenshot_count(game_id).map_err(|e| e.to_string())?;
    library::insert_screenshot(game_id, &url, local_path.as_deref(), count).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_screenshot(screenshot_id: i64) -> Result<(), String> {
    library::delete_screenshot(screenshot_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn reorder_screenshots(game_id: i64, screenshot_ids: Vec<i64>) -> Result<(), String> {
    library::reorder_screenshots(game_id, &screenshot_ids).map_err(|e| e.to_string())
}

#[tauri::command]
fn clear_plugin_settings(plugin_id: String) -> Result<(), String> {
    plugin_settings::delete_plugin_settings(&plugin_id);
    Ok(())
}

#[tauri::command]
async fn test_metadata_provider(provider_id: String) -> Result<String, String> {
    let registry = get_registry();
    if let Some(provider) = registry.get(&provider_id) {
        provider.test_connection().await.map_err(|e| e.to_string())
    } else {
        Err(format!("Unknown metadata provider: {}", provider_id))
    }
}

// --- Metadata Provider Commands ---

fn get_registry() -> Arc<ProviderRegistry> {
    let lock = PROVIDER_REGISTRY.lock().unwrap();
    lock.as_ref().expect("Provider registry not initialized").clone()
}

#[tauri::command]
async fn resolve_game_metadata(game_id: i64) -> Result<serde_json::Value, String> {
    let result = metadata::commands::resolve_game_metadata_cmd(game_id, get_registry()).await?;
    serde_json::to_value(result).map_err(|e| e.to_string())
}

#[tauri::command]
async fn resolve_game_artwork(game_id: i64, artwork_type: String) -> Result<Vec<metadata::models::GameArtworkCandidate>, String> {
    metadata::commands::resolve_game_artwork_cmd(game_id, artwork_type, get_registry()).await
}

#[tauri::command]
async fn resolve_all_artwork(game_id: i64) -> Result<(), String> {
    metadata::commands::resolve_all_artwork_cmd(game_id, get_registry()).await
}

#[tauri::command]
async fn resolve_screenshots(game_id: i64) -> Result<Vec<metadata::models::GameArtworkCandidate>, String> {
    metadata::commands::resolve_screenshots_cmd(game_id, get_registry()).await
}

#[tauri::command]
fn get_artwork_candidates(game_id: i64, artwork_type: String) -> Result<Vec<metadata::models::GameArtworkCandidate>, String> {
    metadata::commands::get_artwork_candidates_cmd(game_id, artwork_type)
}

#[tauri::command]
fn set_primary_artwork(artwork_id: i64, game_id: i64, artwork_type: String) -> Result<(), String> {
    metadata::commands::set_primary_artwork_cmd(artwork_id, game_id, artwork_type)
}

#[tauri::command]
fn reset_artwork_to_automatic(game_id: i64, artwork_type: String) -> Result<(), String> {
    metadata::commands::reset_artwork_to_automatic_cmd(game_id, artwork_type)
}

#[tauri::command]
fn get_metadata_provider_priorities(category: String) -> Result<Vec<metadata::models::ProviderPriority>, String> {
    metadata::commands::get_provider_priorities_cmd(category)
}

#[tauri::command]
fn set_metadata_provider_priorities(category: String, priorities: Vec<metadata::commands::PriorityEngineEntry>) -> Result<(), String> {
    metadata::commands::set_provider_priorities_cmd(category, priorities)
}

#[tauri::command]
async fn get_provider_status() -> Result<Vec<metadata::models::ProviderStatus>, String> {
    let registry = get_registry();
    let mut statuses = Vec::new();
    for provider in registry.all() {
        statuses.push(metadata::models::ProviderStatus {
            id: provider.id().to_string(),
            name: provider.name().to_string(),
            is_configured: provider.is_configured(),
            status: if provider.is_configured() { "configured".to_string() } else { "not_configured".to_string() },
            error_message: None,
        });
    }
    Ok(statuses)
}

#[tauri::command]
async fn search_artwork_multi_provider(game_name: String, artwork_type: String) -> Result<Vec<ArtworkSearchResult>, String> {
    metadata::commands::search_artwork_multi_provider_cmd(game_name, artwork_type, get_registry()).await
}

// --- Controller Commands ---

#[tauri::command]
fn get_controllers() -> Vec<controller::ControllerInfo> {
    controller::get_controllers()
}

#[tauri::command]
fn get_active_controller() -> Option<controller::ControllerInfo> {
    controller::get_active_controller()
}

#[tauri::command]
fn get_controller_settings_cmd() -> controller::ControllerSettings {
    controller::get_controller_settings()
}

#[tauri::command]
fn save_controller_settings_cmd(settings: controller::ControllerSettings) {
    controller::save_controller_settings(settings);
}

#[tauri::command]
fn poll_gamepad_events() -> Vec<controller::GamepadChannelEvent> {
    controller::poll_events()
}

#[tauri::command]
fn get_controller_debug_info() -> serde_json::Value {
    let controllers = controller::get_controllers();
    let active = controller::get_active_controller();
    serde_json::json!({
        "controllerCount": controllers.len(),
        "activeController": active,
        "allControllers": controllers,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    core::db::init_db().expect("Failed to initialize database");
    controller::init_controller_manager();

    metadata::database::init_default_priorities();

    let mut registry = ProviderRegistry::new();
    registry.register(Arc::new(SteamGridDbProvider::new()));
    registry.register(Arc::new(SteamProvider::new()));
    registry.register(Arc::new(IgdbMetadataProvider::new()));
    registry.register(Arc::new(RawgProvider::new()));
    registry.register(Arc::new(MobyGamesProvider::new()));
    {
        let mut reg_lock = PROVIDER_REGISTRY.lock().unwrap();
        *reg_lock = Some(Arc::new(registry));
    }

    let mut manager = PluginManager::new(EVENT_BUS.clone());
    plugins::builtin::register_all_builtin_plugins(&mut manager);
    
    {
        let mut mgr = PLUGIN_MANAGER.lock().unwrap();
        *mgr = Some(manager);
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            get_games,
            get_drives,
            add_game,
            toggle_favorite,
            delete_game,
            scan_libraries,
            launch_game,
            get_play_sessions,
            start_play_session,
            end_play_session,
            update_playtime,
            get_screenshots,
            get_scan_folders,
            add_scan_folder,
            remove_scan_folder,
            get_plugins,
            get_plugin_settings,
            save_plugin_settings,
            get_metadata_providers,
            get_library_plugins,
            get_emulators,
            add_emulator,
            update_emulator,
            delete_emulator,
            detect_emulators,
            get_rom_scan_folders,
            add_rom_scan_folder,
            remove_rom_scan_folder,
            scan_rom_folders,
            get_compatible_emulators,
            set_game_emulator_override,
            get_scan_exclusions,
            add_scan_exclusion,
            remove_scan_exclusion,
            import_dat_file,
            get_dat_entry_count,
            clear_dat_database,
            lookup_rom_metadata,
            update_game,
            upload_artwork,
            remove_artwork,
            download_artwork_url,
            search_artwork_online,
            web_image_search,
            web_image_search_query,
            web_image_probe_sizes,
            add_screenshot,
            delete_screenshot,
            reorder_screenshots,
            clear_plugin_settings,
            test_metadata_provider,
            get_app_data_dir,
            get_app_setting,
            set_app_setting,
            get_all_app_settings,
            set_game_trailer,
            clear_game_trailer,
            probe_trailer,
            probe_wallpaper,
            find_auto_trailer,
            resolve_game_metadata,
            resolve_game_artwork,
            resolve_all_artwork,
            resolve_screenshots,
            get_artwork_candidates,
            set_primary_artwork,
            reset_artwork_to_automatic,
            get_metadata_provider_priorities,
            set_metadata_provider_priorities,
            get_provider_status,
            search_artwork_multi_provider,
            get_controllers,
            get_active_controller,
            get_controller_settings_cmd,
            save_controller_settings_cmd,
            poll_gamepad_events,
            get_controller_debug_info,
            addons::commands::fetch_addon_catalog,
            addons::commands::load_local_addon_catalog,
            addons::commands::get_installed_addons,
            addons::commands::install_addon,
            addons::commands::uninstall_addon,
            addons::commands::enable_addon,
            addons::commands::disable_addon,
            addons::commands::update_addon,
            addons::commands::get_addon_install_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
