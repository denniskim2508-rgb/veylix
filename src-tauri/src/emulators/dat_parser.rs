use std::collections::HashMap;
use std::fs;

#[allow(dead_code)]
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DatGame {
    pub name: String,
    pub description: String,
    pub rom_name: String,
    pub crc32: String,
    pub size: u64,
}

#[derive(Debug, Clone)]
pub struct DatDatabase {
    pub platform: String,
    pub games: Vec<DatGame>,
}

impl DatDatabase {
    #[allow(dead_code)]
    pub fn build_crc_index(&self) -> HashMap<String, DatGame> {
        let mut index = HashMap::new();
        for game in &self.games {
            index.insert(game.crc32.to_uppercase(), game.clone());
        }
        index
    }
}

/// Parse a No-Intro / CLR-MamePro DAT file
pub fn parse_dat_file(content: &str) -> DatDatabase {
    let mut games = Vec::new();
    let mut current_name = String::new();
    let mut current_description = String::new();
    let mut current_rom_name = String::new();
    let mut current_crc = String::new();
    let mut current_size: u64 = 0;
    let mut in_game = false;
    let mut in_rom = false;

    // Try to detect platform from header
    let platform = detect_platform_from_header(content);

    for line in content.lines() {
        let trimmed = line.trim();

        if trimmed.starts_with("game") && trimmed.contains('(') {
            in_game = true;
            current_name.clear();
            current_description.clear();
            current_rom_name.clear();
            current_crc.clear();
            current_size = 0;
            continue;
        }

        if in_game && trimmed.starts_with("rom") && trimmed.contains('(') {
            in_rom = true;
            // Parse rom fields from this line and subsequent content
            parse_rom_line(trimmed, &mut current_rom_name, &mut current_crc, &mut current_size);
            continue;
        }

        if in_game {
            if trimmed.starts_with("name") {
                current_name = extract_dat_value(trimmed);
            } else if trimmed.starts_with("description") {
                current_description = extract_dat_value(trimmed);
            } else if in_rom {
                // Handle multi-line rom entries
                if trimmed.contains("name") {
                    current_rom_name = extract_dat_value(trimmed);
                } else if trimmed.to_lowercase().starts_with("size") {
                    if let Some(s) = trimmed.split_whitespace().nth(1) {
                        current_size = s.parse().unwrap_or(0);
                    }
                } else if trimmed.to_lowercase().starts_with("crc") {
                    current_crc = trimmed.split_whitespace().nth(1).unwrap_or("").to_string();
                }
            }
        }

        // End of rom block
        if in_rom && (trimmed == ")" || trimmed.contains(")")) {
            in_rom = false;
        }

        // End of game block
        if in_game && trimmed == ")" {
            if !current_crc.is_empty() {
                games.push(DatGame {
                    name: if current_name.is_empty() {
                        current_description.clone()
                    } else {
                        current_name.clone()
                    },
                    description: current_description.clone(),
                    rom_name: if current_rom_name.is_empty() {
                        current_name.clone()
                    } else {
                        current_rom_name.clone()
                    },
                    crc32: current_crc.to_uppercase(),
                    size: current_size,
                });
            }
            in_game = false;
        }
    }

    DatDatabase { platform, games }
}

fn parse_rom_line(line: &str, rom_name: &mut String, crc: &mut String, size: &mut u64) {
    // Parse: rom (name "file.nes" size 40960 crc 3B4E5F71)
    // or: rom (name "file.nes" size 40960 crc32 3B4E5F71)
    let parts: Vec<&str> = line.split_whitespace().collect();
    let mut i = 0;
    while i < parts.len() {
        let part = parts[i].trim_matches(|c| c == '(' || c == ')');
        match part {
            "name" => {
                i += 1;
                if i < parts.len() {
                    *rom_name = parts[i].trim_matches('"').to_string();
                }
            }
            "size" => {
                i += 1;
                if i < parts.len() {
                    *size = parts[i].parse().unwrap_or(0);
                }
            }
            "crc" | "crc32" | "CRC" | "CRC32" => {
                i += 1;
                if i < parts.len() {
                    *crc = parts[i].trim().to_uppercase();
                }
            }
            _ => {}
        }
        i += 1;
    }
}

fn extract_dat_value(line: &str) -> String {
    // Extract value from: name "value" or description "value"
    if let Some(start) = line.find('"') {
        if let Some(end) = line[start + 1..].find('"') {
            return line[start + 1..start + 1 + end].to_string();
        }
    }
    // Fallback: get everything after the key
    line.split_whitespace().skip(1).collect::<Vec<&str>>().join(" ")
}

fn detect_platform_from_header(content: &str) -> String {
    let header = content.lines().take(20).collect::<Vec<_>>().join("\n").to_lowercase();

    if header.contains("nintendo") || header.contains("nes") {
        "Nintendo".to_string()
    } else if header.contains("sega") {
        "Sega".to_string()
    } else if header.contains("sony") || header.contains("playstation") {
        "Sony".to_string()
    } else if header.contains("atari") {
        "Atari".to_string()
    } else if header.contains("nec") || header.contains("turbografx") {
        "NEC".to_string()
    } else if header.contains("bandai") || header.contains("wonderswan") {
        "Bandai".to_string()
    } else {
        "Unknown".to_string()
    }
}

/// Load a DAT file from disk
#[allow(dead_code)]
pub fn load_dat_file(path: &str) -> Result<DatDatabase, String> {
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read DAT file: {}", e))?;
    Ok(parse_dat_file(&content))
}

/// CRC32 lookup: hash a file and find matching DAT entry
pub fn crc32_hash_file(path: &str) -> Result<String, String> {
    let data = fs::read(path).map_err(|e| format!("Failed to read file: {}", e))?;
    let hash = crc32fast::hash(&data);
    Ok(format!("{:08X}", hash))
}
