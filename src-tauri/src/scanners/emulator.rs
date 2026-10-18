use crate::library;
use crate::emulators;
use crate::settings;
use crate::drives::DriveInfo;
use std::path::{Path, PathBuf};
use std::fs;

pub const EMULATOR_EXTENSIONS: &[(&str, &[&str])] = &[
    ("Nintendo Entertainment System", &[".nes"]),
    ("Super Nintendo", &[".sfc", ".smc"]),
    ("Nintendo 64", &[".n64", ".z64", ".v64"]),
    ("Game Boy", &[".gb", ".gbc"]),
    ("Game Boy Advance", &[".gba"]),
    ("Nintendo DS", &[".nds"]),
    ("Nintendo 3DS", &[".3ds"]),
    ("Sega Genesis", &[".gen", ".md", ".bin"]),
    ("Sega Master System", &[".sms"]),
    ("Sega Dreamcast", &[".cdi", ".gdi", ".chd"]),
    ("Sega Saturn", &[".bin", ".cue"]),
    ("PlayStation 1", &[".bin", ".cue", ".iso", ".pbp"]),
    ("PlayStation 2", &[".iso", ".bin", ".chd"]),
    ("PlayStation Portable", &[".iso", ".cso"]),
    ("GameCube", &[".iso", ".gcm", ".rvz"]),
    ("Wii", &[".iso", ".wbfs", ".rvz"]),
    ("Wii U", &[".wud", ".wux", ".rpx"]),
    ("Xbox", &[".iso", ".xbe"]),
    ("Xbox 360", &[".iso", ".xex"]),
    ("Atari 2600", &[".a26"]),
    ("Atari 7800", &[".a78"]),
    ("Neo Geo", &[".neo", ".zip"]),
    ("TurboGrafx-16", &[".pce"]),
    ("WonderSwan", &[".ws", ".wsc"]),
];

pub const ARCHIVE_EXTENSIONS: &[&str] = &[".zip", ".7z", ".rar"];

const MAX_ROM_DEPTH: usize = 10;
const MAX_ROM_DIRS: usize = 2000;
const MAX_HASH_FILE_SIZE: u64 = 1 << 30;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedEmulator {
    pub name: String,
    pub executable_path: String,
    pub platform: String,
    pub command_template: String,
    pub supported_extensions: String,
    pub default_args: String,
    pub available_cores: Vec<String>,
}

pub fn get_known_emulators() -> Vec<DetectedEmulator> {
    let mut emulators = Vec::new();
    let home = dirs::home_dir().unwrap_or_default();
    let local_app_data = dirs::data_local_dir().unwrap_or_default();
    let program_files = PathBuf::from(std::env::var("ProgramFiles").unwrap_or_default());
    let program_files_x86 = PathBuf::from(std::env::var("ProgramFiles(x86)").unwrap_or_default());

    // RetroArch
    let retroarch_paths = [
        program_files.join("RetroArch"),
        program_files_x86.join("RetroArch"),
        home.join("RetroArch"),
        local_app_data.join("RetroArch"),
        PathBuf::from("C:\\RetroArch"),
        PathBuf::from("D:\\RetroArch"),
    ];

    for path in &retroarch_paths {
        let exe = path.join("retroarch.exe");
        if exe.exists() {
            let all_exts: Vec<&str> = EMULATOR_EXTENSIONS.iter()
                .flat_map(|(_, exts)| exts.iter().copied())
                .collect();

            // Scan for available RetroArch cores
            let cores_dir = path.join("cores");
            let available_cores: Vec<String> = if cores_dir.exists() {
                fs::read_dir(&cores_dir)
                    .ok()
                    .into_iter()
                    .flatten()
                    .filter_map(|r| r.ok())
                    .filter_map(|e| {
                        let name = e.file_name().to_string_lossy().to_string();
                        if name.ends_with("_libretro.dll") || name.ends_with(".dll") {
                            Some(name)
                        } else {
                            None
                        }
                    })
                    .collect()
            } else {
                Vec::new()
            };

            emulators.push(DetectedEmulator {
                name: "RetroArch".to_string(),
                executable_path: exe.to_string_lossy().to_string(),
                platform: "Multi-System".to_string(),
                command_template: "{{emulator}} {{default_args}} -L {{core}} \"{{rom}}\"".to_string(),
                supported_extensions: all_exts.join(","),
                default_args: "".to_string(),
                available_cores,
            });
            break;
        }
    }

    // Dolphin (GameCube/Wii)
    let dolphin_paths = [
        program_files.join("Dolphin").join("Emulator"),
        program_files_x86.join("Dolphin").join("Emulator"),
        local_app_data.join("Dolphin").join("Emulator"),
    ];

    for path in &dolphin_paths {
        let exe = path.join("Dolphin.exe");
        if exe.exists() {
            emulators.push(DetectedEmulator {
                name: "Dolphin".to_string(),
                executable_path: exe.to_string_lossy().to_string(),
                platform: "GameCube/Wii".to_string(),
                command_template: "\"{{emulator}}\" --batch \"{{rom}}\"".to_string(),
                supported_extensions: ".iso,.gcm,.wbfs,.rvz,.wad".to_string(),
                default_args: "--batch".to_string(),
                available_cores: Vec::new(),
            });
            break;
        }
    }

    // PCSX2 (PlayStation 2)
    let pcsx2_paths = [
        program_files.join("PCSX2"),
        program_files_x86.join("PCSX2"),
        local_app_data.join("PCSX2"),
    ];

    for path in &pcsx2_paths {
        let exe = path.join("pcsx2.exe");
        if exe.exists() {
            emulators.push(DetectedEmulator {
                name: "PCSX2".to_string(),
                executable_path: exe.to_string_lossy().to_string(),
                platform: "PlayStation 2".to_string(),
                command_template: "\"{{emulator}}\" {{default_args}} \"{{rom}}\"".to_string(),
                supported_extensions: ".iso,.bin,.chd,.gz".to_string(),
                default_args: "".to_string(),
                available_cores: Vec::new(),
            });
            break;
        }
    }

    // PPSSPP (PlayStation Portable)
    let ppsspp_paths = [
        program_files.join("PPSSPP"),
        program_files_x86.join("PPSSPP"),
        local_app_data.join("PPSSPP"),
    ];

    for path in &ppsspp_paths {
        let exe = path.join("PPSSPPWindows64.exe");
        let exe = if exe.exists() { exe } else { path.join("PPSSPPWindows.exe") };
        if exe.exists() {
            emulators.push(DetectedEmulator {
                name: "PPSSPP".to_string(),
                executable_path: exe.to_string_lossy().to_string(),
                platform: "PlayStation Portable".to_string(),
                command_template: "\"{{emulator}}\" {{default_args}} \"{{rom}}\"".to_string(),
                supported_extensions: ".iso,.cso".to_string(),
                default_args: "".to_string(),
                available_cores: Vec::new(),
            });
            break;
        }
    }

    // Project64 (Nintendo 64)
    let pj64_paths = [
        program_files.join("Project64"),
        program_files_x86.join("Project64"),
        local_app_data.join("Project64"),
    ];

    for path in &pj64_paths {
        let exe = path.join("Project64.exe");
        if exe.exists() {
            emulators.push(DetectedEmulator {
                name: "Project64".to_string(),
                executable_path: exe.to_string_lossy().to_string(),
                platform: "Nintendo 64".to_string(),
                command_template: "\"{{emulator}}\" {{default_args}} \"{{rom}}\"".to_string(),
                supported_extensions: ".n64,.z64,.v64,.rom,.mp3".to_string(),
                default_args: "".to_string(),
                available_cores: Vec::new(),
            });
            break;
        }
    }

    // snes9x (Super Nintendo)
    let snes9x_paths = [
        program_files.join("snes9x"),
        program_files_x86.join("snes9x"),
        local_app_data.join("snes9x"),
    ];

    for path in &snes9x_paths {
        let exe = path.join("snes9x.exe");
        if exe.exists() {
            emulators.push(DetectedEmulator {
                name: "snes9x".to_string(),
                executable_path: exe.to_string_lossy().to_string(),
                platform: "Super Nintendo".to_string(),
                command_template: "\"{{emulator}}\" {{default_args}} \"{{rom}}\"".to_string(),
                supported_extensions: ".sfc,.smc,.zip".to_string(),
                default_args: "".to_string(),
                available_cores: Vec::new(),
            });
            break;
        }
    }

    // mGBA (Game Boy Advance)
    let mgba_paths = [
        program_files.join("mGBA"),
        program_files_x86.join("mGBA"),
        local_app_data.join("mGBA"),
    ];

    for path in &mgba_paths {
        let exe = path.join("mgba.exe");
        if exe.exists() {
            emulators.push(DetectedEmulator {
                name: "mGBA".to_string(),
                executable_path: exe.to_string_lossy().to_string(),
                platform: "Game Boy Advance".to_string(),
                command_template: "\"{{emulator}}\" {{default_args}} \"{{rom}}\"".to_string(),
                supported_extensions: ".gba,.gb,.gbc,.zip".to_string(),
                default_args: "".to_string(),
                available_cores: Vec::new(),
            });
            break;
        }
    }

    // Cemu (Wii U)
    let cemu_paths = [
        program_files.join("Cemu"),
        program_files_x86.join("Cemu"),
        local_app_data.join("Cemu"),
        PathBuf::from("C:\\Cemu"),
        PathBuf::from("D:\\Cemu"),
    ];

    for path in &cemu_paths {
        let exe = path.join("Cemu.exe");
        if exe.exists() {
            emulators.push(DetectedEmulator {
                name: "Cemu".to_string(),
                executable_path: exe.to_string_lossy().to_string(),
                platform: "Wii U".to_string(),
                command_template: "\"{{emulator}}\" {{default_args}} \"{{rom}}\"".to_string(),
                supported_extensions: ".wud,.wux,.rpx,.iso".to_string(),
                default_args: "".to_string(),
                available_cores: Vec::new(),
            });
            break;
        }
    }

    // Yuzu (Nintendo Switch)
    let yuzu_paths = [
        program_files.join("yuzu"),
        program_files_x86.join("yuzu"),
        local_app_data.join("yuzu"),
    ];

    for path in &yuzu_paths {
        let exe = path.join("yuzu.exe");
        if exe.exists() {
            emulators.push(DetectedEmulator {
                name: "Yuzu".to_string(),
                executable_path: exe.to_string_lossy().to_string(),
                platform: "Nintendo Switch".to_string(),
                command_template: "\"{{emulator}}\" {{default_args}} \"{{rom}}\"".to_string(),
                supported_extensions: ".nsp,.xci,.nca,.nro".to_string(),
                default_args: "".to_string(),
                available_cores: Vec::new(),
            });
            break;
        }
    }

    // Citra (Nintendo 3DS)
    let citra_paths = [
        program_files.join("Citra"),
        program_files_x86.join("Citra"),
        local_app_data.join("Citra"),
    ];

    for path in &citra_paths {
        let exe = path.join("citra.exe");
        if exe.exists() {
            emulators.push(DetectedEmulator {
                name: "Citra".to_string(),
                executable_path: exe.to_string_lossy().to_string(),
                platform: "Nintendo 3DS".to_string(),
                command_template: "\"{{emulator}}\" {{default_args}} \"{{rom}}\"".to_string(),
                supported_extensions: ".3ds,.cia,.cxi,.3dsx".to_string(),
                default_args: "".to_string(),
                available_cores: Vec::new(),
            });
            break;
        }
    }

    // ePSXe (PlayStation 1)
    let epsxe_paths = [
        program_files.join("ePSXe"),
        program_files_x86.join("ePSXe"),
        PathBuf::from("C:\\ePSXe"),
    ];

    for path in &epsxe_paths {
        let exe = path.join("ePSXe.exe");
        if exe.exists() {
            emulators.push(DetectedEmulator {
                name: "ePSXe".to_string(),
                executable_path: exe.to_string_lossy().to_string(),
                platform: "PlayStation 1".to_string(),
                command_template: "\"{{emulator}}\" {{default_args}} \"{{rom}}\"".to_string(),
                supported_extensions: ".bin,.cue,.iso,.pbp".to_string(),
                default_args: "".to_string(),
                available_cores: Vec::new(),
            });
            break;
        }
    }

    // Mednafen (multi-system)
    let mednafen_paths = [
        program_files.join("mednafen"),
        program_files_x86.join("mednafen"),
        local_app_data.join("mednafen"),
        PathBuf::from("C:\\mednafen"),
    ];

    for path in &mednafen_paths {
        let exe = path.join("mednafen.exe");
        if exe.exists() {
            emulators.push(DetectedEmulator {
                name: "Mednafen".to_string(),
                executable_path: exe.to_string_lossy().to_string(),
                platform: "Multi-System".to_string(),
                command_template: "\"{{emulator}}\" {{default_args}} \"{{rom}}\"".to_string(),
                supported_extensions: ".nes,.sfc,.smc,.gb,.gba,.pce,.gen,.md,.sms,.gg,.ws,.wsc".to_string(),
                default_args: "".to_string(),
                available_cores: Vec::new(),
            });
            break;
        }
    }

    emulators
}

pub fn get_platform_for_extension(ext: &str) -> Option<&'static str> {
    let ext_lower = ext.to_lowercase();
    for (platform, extensions) in EMULATOR_EXTENSIONS {
        if extensions.iter().any(|e| e.eq_ignore_ascii_case(&ext_lower)) {
            return Some(platform);
        }
    }
    None
}

#[allow(dead_code)]
pub fn get_extensions_for_platform(platform: &str) -> Vec<&'static str> {
    for (p, extensions) in EMULATOR_EXTENSIONS {
        if p.eq_ignore_ascii_case(platform) {
            return extensions.to_vec();
        }
    }
    Vec::new()
}

pub fn scan_rom_folders(_drives: &[DriveInfo], rom_scan_folders: &[String]) -> Vec<library::GameRow> {
    let mut games = Vec::new();
    let emulator_rows = emulators::get_all_emulators().unwrap_or_default();
    let exclusions = settings::get_scan_exclusions().unwrap_or_default();

    // Build DAT index for CRC32 lookups
    let dat_index = crate::emulators::dat_database::build_crc_index().unwrap_or_default();

    let scan_paths: Vec<PathBuf> = rom_scan_folders.iter().map(PathBuf::from).collect();

    if scan_paths.is_empty() {
        return games;
    }

    let mut visited = std::collections::HashSet::new();
    let mut dir_budget = MAX_ROM_DIRS;

    for scan_path in &scan_paths {
        if !scan_path.exists() || !scan_path.is_dir() {
            continue;
        }

        scan_rom_directory(
            scan_path,
            0,
            &mut visited,
            &mut dir_budget,
            &emulator_rows,
            &exclusions,
            &dat_index,
            &mut games,
        );
    }

    games
}

struct ScannedRom {
    path: PathBuf,
    path_str: String,
    ext_lower: String,
    file_name: String,
    file_size: i64,
}

fn scan_rom_directory(
    dir: &Path,
    depth: usize,
    visited: &mut std::collections::HashSet<PathBuf>,
    dir_budget: &mut usize,
    emulator_rows: &[emulators::EmulatorRow],
    exclusions: &[settings::ScanExclusion],
    dat_index: &std::collections::HashMap<String, crate::emulators::DatLookupResult>,
    games: &mut Vec<library::GameRow>,
) {
    if depth > MAX_ROM_DEPTH || *dir_budget == 0 {
        return;
    }

    let canonical = fs::canonicalize(dir).unwrap_or_else(|_| PathBuf::from(dir));
    if !visited.insert(canonical) {
        return;
    }
    *dir_budget -= 1;

    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(_) => return,
    };

    // Collect all ROM files in this directory
    let mut rom_files: Vec<ScannedRom> = Vec::new();
    let mut subdirs: Vec<PathBuf> = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            subdirs.push(path);
            continue;
        }

        let ext = match path.extension().and_then(|e| e.to_str()) {
            Some(ext) => ext,
            None => continue,
        };

        let ext_lower = format!(".{}", ext.to_lowercase());
        if !is_rom_extension(&ext_lower) {
            continue;
        }

        let path_str = path.to_string_lossy().to_string();
        if emulators::rom_file_exists(&path_str).unwrap_or(false) {
            continue;
        }

        // Check exclusions
        if settings::is_path_excluded(&path_str, exclusions) {
            continue;
        }

        let file_name = path.file_stem()
            .and_then(|n| n.to_str())
            .unwrap_or("Unknown")
            .to_string();
        let file_size = fs::metadata(&path).map(|m| m.len() as i64).unwrap_or(0);

        rom_files.push(ScannedRom {
            path,
            path_str,
            ext_lower,
            file_name,
            file_size,
        });
    }

    // Group files by sanitized name (for multi-disc merging)
    let mut groups: std::collections::HashMap<String, Vec<usize>> = std::collections::HashMap::new();
    for (idx, rom) in rom_files.iter().enumerate() {
        let base_name = sanitize_name_for_grouping(&rom.file_name);
        groups.entry(base_name).or_default().push(idx);
    }

    // Process each group
    for (_base_name, indices) in &groups {
        if indices.len() == 1 {
            // Single file - create game as before
            let rom = &rom_files[indices[0]];
            create_rom_game(rom, emulator_rows, dat_index, games);
        } else {
            // Multi-disc group - create one game with first file, link all ROMs
            let first_rom = &rom_files[indices[0]];
            let platform = get_platform_for_extension(&first_rom.ext_lower).unwrap_or("Unknown");

            let matching_emulator = find_matching_emulator(&first_rom.ext_lower, emulator_rows);
            let emulator_id = matching_emulator.map(|e| e.id);
            let emulator_name = matching_emulator.map(|e| e.name.clone()).unwrap_or_default();

            let launch_command = build_launch_command(
                &first_rom.path_str,
                matching_emulator,
            );

            let title = clean_rom_title(&first_rom.file_name);
            let disc_count = indices.len();
            let description = format!("{} ROM - {} ({} discs)", platform, emulator_name, disc_count);

            let game_id = library::insert_game(
                &title,
                "emulator",
                Some(&first_rom.path_str),
                None,
                None,
                Some(&launch_command),
                first_rom.path.to_str().and_then(|p| p.chars().next()).map(|c| c.to_string()).as_deref(),
            );

            if let Ok(game_id) = game_id {
                // Link all ROM files in the group
                for &idx in indices {
                    let rom = &rom_files[idx];
                    let _ = emulators::insert_rom_file(game_id, emulator_id, &rom.path_str, &rom.file_name, rom.file_size);
                }

                let drive_letter = first_rom.path.to_str()
                    .and_then(|p| p.chars().next())
                    .map(|c| c.to_string());

                games.push(library::GameRow {
                    id: game_id,
                    title,
                    platform: "emulator".to_string(),
                    install_path: Some(first_rom.path_str.clone()),
                    executable_path: None,
                    cover_image: None,
                    background_image: None,
                    description: Some(description),
                    release_date: None,
                    genre: None,
                    developer: None,
                    publisher: None,
                    play_time: 0,
                    last_played: None,
                    is_installed: true,
                    is_favorite: false,
                    platform_game_id: None,
                    launch_command: Some(launch_command),
                    drive_letter,
                    icon: None,
                    logo: None,
                    trailer_path: None,
                    trailer_source: None,
                    created_at: chrono::Utc::now().to_rfc3339(),
                    updated_at: chrono::Utc::now().to_rfc3339(),
                });
            }
        }
    }

    // Recurse into subdirectories
    for subdir in subdirs {
        if subdir.file_name().map(|n| n.to_string_lossy().starts_with('.')).unwrap_or(false) {
            continue;
        }
        scan_rom_directory(
            &subdir,
            depth + 1,
            visited,
            dir_budget,
            emulator_rows,
            exclusions,
            dat_index,
            games,
        );
    }
}

fn create_rom_game(
    rom: &ScannedRom,
    emulator_rows: &[emulators::EmulatorRow],
    dat_index: &std::collections::HashMap<String, crate::emulators::DatLookupResult>,
    games: &mut Vec<library::GameRow>,
) {
    let platform = get_platform_for_extension(&rom.ext_lower).unwrap_or("Unknown");

    // Try DAT lookup by CRC32 first (skip when no DAT index is imported or the
    // file is too large to hash: hashing reads the entire file into memory)
    let dat_result = if dat_index.is_empty() || (rom.file_size as u64) > MAX_HASH_FILE_SIZE {
        None
    } else if let Ok(crc) = crate::emulators::dat_parser::crc32_hash_file(&rom.path_str) {
        dat_index.get(&crc).cloned()
    } else {
        None
    };

    // Fallback: try DAT lookup by ROM filename
    let dat_result = dat_result.or_else(|| {
        crate::emulators::dat_database::lookup_by_rom_name(&rom.file_name).ok().flatten()
    });

    let matching_emulator = find_matching_emulator(&rom.ext_lower, emulator_rows);
    let emulator_id = matching_emulator.map(|e| e.id);
    let emulator_name = matching_emulator.map(|e| e.name.clone()).unwrap_or_default();

    let launch_command = build_launch_command(&rom.path_str, matching_emulator);

    // Use DAT metadata if available, otherwise derive from filename
    let (title, description) = if let Some(dat) = &dat_result {
        let desc = dat.description.as_deref().unwrap_or(&dat.game_name);
        (dat.game_name.clone(), Some(format!("{} - {}", desc, dat.platform)))
    } else {
        let t = clean_rom_title(&rom.file_name);
        (t, Some(format!("{} ROM - {}", platform, emulator_name)))
    };

    let game_id = library::insert_game(
        &title,
        "emulator",
        Some(&rom.path_str),
        None,
        None,
        Some(&launch_command),
        rom.path.to_str().and_then(|p| p.chars().next()).map(|c| c.to_string()).as_deref(),
    );

    if let Ok(game_id) = game_id {
        let _ = emulators::insert_rom_file(game_id, emulator_id, &rom.path_str, &rom.file_name, rom.file_size);

        let drive_letter = rom.path.to_str()
            .and_then(|p| p.chars().next())
            .map(|c| c.to_string());

        games.push(library::GameRow {
            id: game_id,
            title,
            platform: "emulator".to_string(),
            install_path: Some(rom.path_str.clone()),
            executable_path: None,
            cover_image: None,
            background_image: None,
            description,
            release_date: None,
            genre: None,
            developer: None,
            publisher: None,
            play_time: 0,
            last_played: None,
            is_installed: true,
            is_favorite: false,
            platform_game_id: None,
            launch_command: Some(launch_command),
            drive_letter,
            icon: None,
            logo: None,
            trailer_path: None,
            trailer_source: None,
            created_at: chrono::Utc::now().to_rfc3339(),
            updated_at: chrono::Utc::now().to_rfc3339(),
        });
    }
}

fn find_matching_emulator<'a>(
    ext: &str,
    emulator_rows: &'a [emulators::EmulatorRow],
) -> Option<&'a emulators::EmulatorRow> {
    emulator_rows.iter().find(|e| {
        e.supported_extensions
            .as_ref()
            .map(|exts| exts.split(',').any(|e| e.trim().eq_ignore_ascii_case(ext)))
            .unwrap_or(false)
    })
}

fn build_launch_command(
    path_str: &str,
    emulator: Option<&emulators::EmulatorRow>,
) -> String {
    if let Some(emu) = emulator {
        let template = emu.command_template.as_deref().unwrap_or("\"{{emulator}}\" \"{{rom}}\"");
        let args = emu.default_args.as_deref().unwrap_or("");
        let core = emu.core_path.as_deref().unwrap_or("");
        template
            .replace("{{emulator}}", &emu.executable_path)
            .replace("{{rom}}", path_str)
            .replace("{{default_args}}", args)
            .replace("{{core}}", core)
    } else {
        format!("\"{}\"", path_str)
    }
}

/// Sanitize a ROM filename for grouping multi-disc files.
/// Removes disc markers like "(Disc 1)", "(Disc 2)", "(Side A)", etc.
fn sanitize_name_for_grouping(name: &str) -> String {
    let mut result = name.to_string();

    // Remove disc/side markers
    let disc_patterns = [
        "disc 1", "disc 2", "disc 3", "disc 4", "disc 5",
        "side a", "side b",
        "cd1", "cd2", "cd3",
        "disk 1", "disk 2", "disk 3",
    ];
    for pattern in &disc_patterns {
        result = result.replace(pattern, "");
        result = result.replace(&pattern.to_uppercase(), "");
    }

    // Remove "(Rev 1)", "(Rev 2)" etc.
    result = result.replace("(Rev 1)", "");
    result = result.replace("(Rev 2)", "");
    result = result.replace("(Rev 3)", "");

    // Clean up extra spaces and parentheses
    while result.contains("  ") {
        result = result.replace("  ", " ");
    }
    result = result.replace("()", "");
    result = result.trim().to_string();

    result.to_lowercase()
}

fn is_rom_extension(ext: &str) -> bool {
    for (_, extensions) in EMULATOR_EXTENSIONS {
        if extensions.iter().any(|e| e.eq_ignore_ascii_case(ext)) {
            return true;
        }
    }
    if ARCHIVE_EXTENSIONS.iter().any(|e| e.eq_ignore_ascii_case(ext)) {
        return true;
    }
    false
}

fn clean_rom_title(filename: &str) -> String {
    let mut title = filename.to_string();

    // Remove common ROM tags
    let tags_to_remove = [
        "(USA)", "(Europe)", "(Japan)", "(World)", "(Proto)", "(Beta)",
        "(Rev 1)", "(Rev 2)", "(Rev 3)", "(v1.0)", "(v1.1)", "(v1.2)",
        "[!]", "(Unl)", "(Alt)", "(Hack)", "(Trimmed)",
        "(USA) (Rev 1)", "(Europe) (Rev 1)", "(Japan) (Rev 1)",
    ];

    for tag in &tags_to_remove {
        title = title.replace(tag, "");
    }

    // Clean up extra spaces
    while title.contains("  ") {
        title = title.replace("  ", " ");
    }

    title.trim().to_string()
}
