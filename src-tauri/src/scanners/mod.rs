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

use crate::library;
use crate::drives::DriveInfo;

pub fn scan_all(drives: &[DriveInfo], scan_folders: &[String]) -> Vec<library::GameRow> {
    let mut all_games = Vec::new();

    all_games.extend(steam::scan_steam(drives));
    all_games.extend(epic::scan_epic(drives));
    all_games.extend(gog::scan_gog(drives));
    all_games.extend(ea::scan_ea(drives));
    all_games.extend(ubisoft::scan_ubisoft(drives));
    all_games.extend(battlenet::scan_battlenet(drives));
    all_games.extend(rockstar::scan_rockstar(drives));
    all_games.extend(xbox::scan_xbox(drives));
    all_games.extend(local::scan_local(drives, scan_folders));

    // Also scan ROM folders
    let rom_scan_folders = crate::emulators::get_rom_scan_folder_paths().unwrap_or_default();
    if !rom_scan_folders.is_empty() {
        all_games.extend(emulator::scan_rom_folders(drives, &rom_scan_folders));
    }

    all_games
}

pub fn scan_rom_folders(drives: &[DriveInfo], rom_scan_folders: &[String]) -> Vec<library::GameRow> {
    emulator::scan_rom_folders(drives, rom_scan_folders)
}
