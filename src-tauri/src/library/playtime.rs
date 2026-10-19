use std::collections::HashSet;
use std::path::Path;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use once_cell::sync::Lazy;
use tauri::{AppHandle, Emitter};

use super::{add_game_playtime, end_play_session, insert_play_session};

static ACTIVE_SESSIONS: Lazy<Mutex<HashSet<i64>>> = Lazy::new(|| Mutex::new(HashSet::new()));

const PROCESS_APPEAR_TIMEOUT: Duration = Duration::from_secs(90);
const PROCESS_APPEAR_INTERVAL: Duration = Duration::from_secs(2);
const PROCESS_POLL_INTERVAL: Duration = Duration::from_secs(5);

pub fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
}

fn first_token(command: &str) -> String {
    let trimmed = command.trim();
    if let Some(rest) = trimmed.strip_prefix('"') {
        if let Some(end) = rest.find('"') {
            return rest[..end].to_string();
        }
        return trimmed.trim_matches('"').to_string();
    }
    trimmed.split_whitespace().next().unwrap_or("").to_string()
}

/// Determines which process image name to watch for a launch, or `None` when
/// the launch cannot be tracked (store:// URLs, scripts, missing executable).
pub fn resolve_watch_target(launch_command: &str, executable_path: Option<&str>) -> Option<String> {
    let raw = match executable_path {
        Some(p) if !p.trim().is_empty() => p.trim().to_string(),
        _ => {
            let cmd = launch_command.trim();
            if cmd.is_empty() || cmd.contains("://") {
                return None;
            }
            first_token(cmd)
        }
    };

    if raw.is_empty() || raw.contains("://") {
        return None;
    }

    let file_name = Path::new(&raw).file_name()?.to_string_lossy().to_string();
    let lower = file_name.to_ascii_lowercase();
    if !lower.ends_with(".exe") {
        return None;
    }
    if matches!(
        lower.as_str(),
        "cmd.exe" | "sh.exe" | "bash.exe" | "powershell.exe" | "pwsh.exe" | "explorer.exe"
    ) {
        return None;
    }

    Some(file_name)
}

#[cfg(target_os = "windows")]
fn wide_to_string(buf: &[u16]) -> String {
    let len = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
    String::from_utf16_lossy(&buf[..len])
}

#[cfg(target_os = "windows")]
pub fn is_process_running(image_name: &str) -> bool {
    use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };

    let target = image_name.to_ascii_lowercase();

    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snapshot == INVALID_HANDLE_VALUE {
            return false;
        }

        let mut entry: PROCESSENTRY32W = std::mem::zeroed();
        entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;

        let mut found = false;
        let mut ok = Process32FirstW(snapshot, &mut entry);
        while ok != 0 {
            if wide_to_string(&entry.szExeFile).to_ascii_lowercase() == target {
                found = true;
                break;
            }
            ok = Process32NextW(snapshot, &mut entry);
        }

        CloseHandle(snapshot);
        found
    }
}

#[cfg(not(target_os = "windows"))]
pub fn is_process_running(_image_name: &str) -> bool {
    false
}

fn finalize(app: &AppHandle, game_id: i64, session_id: i64, minutes: i64, started_at: &str) {
    let ended_at = now_iso();

    if let Err(e) = end_play_session(session_id, &ended_at, minutes) {
        log::error!("Failed to close play session {}: {}", session_id, e);
    }

    if minutes > 0 {
        if let Err(e) = add_game_playtime(game_id, minutes, &ended_at) {
            log::error!("Failed to accumulate playtime for game {}: {}", game_id, e);
        }
    }

    let _ = app.emit(
        "play://session-ended",
        serde_json::json!({
            "gameId": game_id,
            "durationMinutes": minutes,
            "startedAt": started_at,
        }),
    );

    ACTIVE_SESSIONS.lock().unwrap().remove(&game_id);
}

/// Records a play session and watches the game process, closing the session
/// (and accumulating playtime) once the process exits. If the process never
/// appears the session is closed with zero duration so no time is fabricated.
pub fn track_session(app: AppHandle, game_id: i64, image_name: String, started_at: String) {
    {
        let mut active = ACTIVE_SESSIONS.lock().unwrap();
        if !active.insert(game_id) {
            return;
        }
    }

    let session_id = match insert_play_session(game_id, &started_at) {
        Ok(id) => id,
        Err(e) => {
            log::error!("Failed to start play session for game {}: {}", game_id, e);
            ACTIVE_SESSIONS.lock().unwrap().remove(&game_id);
            return;
        }
    };

    std::thread::spawn(move || {
        let wait_start = Instant::now();

        loop {
            if is_process_running(&image_name) {
                break;
            }
            if wait_start.elapsed() >= PROCESS_APPEAR_TIMEOUT {
                finalize(&app, game_id, session_id, 0, &started_at);
                return;
            }
            std::thread::sleep(PROCESS_APPEAR_INTERVAL);
        }

        let play_start = Instant::now();
        while is_process_running(&image_name) {
            std::thread::sleep(PROCESS_POLL_INTERVAL);
        }

        let minutes = (play_start.elapsed().as_secs() / 60) as i64;
        finalize(&app, game_id, session_id, minutes, &started_at);
    });
}
