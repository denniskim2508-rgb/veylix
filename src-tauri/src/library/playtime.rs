use std::collections::HashSet;
use std::path::Path;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use once_cell::sync::Lazy;
use tauri::{AppHandle, Emitter};

use super::{add_game_playtime, end_play_session, insert_play_session};

static ACTIVE_SESSIONS: Lazy<Mutex<HashSet<i64>>> = Lazy::new(|| Mutex::new(HashSet::new()));
static SESSION_PIDS: Lazy<Mutex<std::collections::HashMap<i64, Vec<u32>>>> = Lazy::new(|| Mutex::new(std::collections::HashMap::new()));

const PROCESS_APPEAR_TIMEOUT: Duration = Duration::from_secs(120);
const PROCESS_APPEAR_INTERVAL: Duration = Duration::from_secs(1);
const PROCESS_POLL_INTERVAL: Duration = Duration::from_secs(3);
const WINDOW_READY_TIMEOUT: Duration = Duration::from_secs(60);

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

#[cfg(target_os = "windows")]
fn get_process_pids(image_name: &str) -> Vec<u32> {
    use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };

    let target = image_name.to_ascii_lowercase();
    let mut pids = Vec::new();

    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snapshot == INVALID_HANDLE_VALUE {
            return pids;
        }

        let mut entry: PROCESSENTRY32W = std::mem::zeroed();
        entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;

        let mut ok = Process32FirstW(snapshot, &mut entry);
        while ok != 0 {
            if wide_to_string(&entry.szExeFile).to_ascii_lowercase() == target {
                pids.push(entry.th32ProcessID);
            }
            ok = Process32NextW(snapshot, &mut entry);
        }

        CloseHandle(snapshot);
    }
    pids
}

#[cfg(target_os = "windows")]
fn has_visible_window_for_pids(pids: &[u32]) -> bool {
    use windows_sys::Win32::Foundation::{BOOL, HWND, LPARAM, RECT};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindowRect, GetWindowThreadProcessId, IsWindowVisible,
    };

    struct EnumData {
        pids: Vec<u32>,
        found: bool,
    }

    unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let data = &mut *(lparam as *mut EnumData);
        if IsWindowVisible(hwnd) == 0 {
            return 1;
        }
        // Size check: filter out tiny helper/tray windows.
        let mut rect: RECT = std::mem::zeroed();
        if GetWindowRect(hwnd, &mut rect) == 0 {
            return 1;
        }
        let w = rect.right - rect.left;
        let h = rect.bottom - rect.top;
        if w < 100 || h < 100 {
            return 1;
        }
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if data.pids.contains(&pid) {
            log::info!("[Playtime] Found visible window for PID {} ({}x{})", pid, w, h);
            data.found = true;
            return 0; // stop enumeration
        }
        1
    }

    let mut data = EnumData {
        pids: pids.to_vec(),
        found: false,
    };
    unsafe {
        EnumWindows(Some(enum_proc), &mut data as *mut EnumData as LPARAM);
    }
    data.found
}

#[cfg(not(target_os = "windows"))]
fn get_process_pids(_image_name: &str) -> Vec<u32> {
    vec![]
}

#[cfg(not(target_os = "windows"))]
fn has_visible_window_for_pids(_pids: &[u32]) -> bool {
    false
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
    SESSION_PIDS.lock().unwrap().remove(&game_id);
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

        // Notify the frontend that the game process actually appeared, so it
        // can mark the session as active (and keep controller input paused).
        let pids = get_process_pids(&image_name);
        if !pids.is_empty() {
            SESSION_PIDS.lock().unwrap().insert(game_id, pids.clone());
        }
        let _ = app.emit(
            "play://session-started",
            serde_json::json!({
                "gameId": game_id,
                "startedAt": started_at,
            }),
        );

        // Wait for a visible window to be ready (cinematic loading screen)
        // Track all processes that appear (including children from launchers)
        let mut tracked_pids: Vec<u32> = pids.clone();
        let mut last_pid_check = Instant::now();
        let mut window_stable_count: u32 = 0;
        const STABLE_THRESHOLD: u32 = 5; // ~1s of consecutive detections
        log::info!("[Playtime] Waiting for window for game {} watching {}", game_id, image_name);
        
        loop {
            // Re-scan for processes periodically to catch child processes from launchers
            if last_pid_check.elapsed() >= Duration::from_millis(100) {
                let current_pids = get_process_pids(&image_name);
                for pid in current_pids {
                    if !tracked_pids.contains(&pid) {
                        log::info!("[Playtime] Found new process {} for game {}", pid, game_id);
                        tracked_pids.push(pid);
                    }
                }
                SESSION_PIDS.lock().unwrap().insert(game_id, tracked_pids.clone());
                last_pid_check = Instant::now();
            }
            
            if is_process_running(&image_name) {
                let current_pids = get_process_pids(&image_name);
                if !current_pids.is_empty() {
                    for pid in current_pids {
                        if !tracked_pids.contains(&pid) {
                            tracked_pids.push(pid);
                            log::info!("[Playtime] Added PID {} from scan for game {}", pid, game_id);
                        }
                    }
                }
            }
            
            // Stability check: require the window to be visible for several
            // consecutive polls before declaring ready, so splash screens do
            // not dismiss the loading screen prematurely.
            if !tracked_pids.is_empty() && has_visible_window_for_pids(&tracked_pids) {
                window_stable_count += 1;
                if window_stable_count >= STABLE_THRESHOLD {
                    log::info!("[Playtime] Window stable for game {}, dismissing loading screen", game_id);
                    let _ = app.emit(
                        "play://game-window-ready",
                        serde_json::json!({
                            "gameId": game_id,
                        }),
                    );
                    break;
                }
            } else {
                window_stable_count = 0;
            }
            
            // Check if any tracked process is still running
            let mut any_running = false;
            for pid in &tracked_pids {
                let current_pids = get_process_pids(&image_name);
                if current_pids.contains(pid) {
                    any_running = true;
                    break;
                }
            }
            if tracked_pids.is_empty() {
                any_running = is_process_running(&image_name);
            } else if !any_running {
                any_running = is_process_running(&image_name);
            }
            
            if !any_running && !is_process_running(&image_name) {
                log::warn!("[Playtime] All processes dead before window appeared for game {}", game_id);
                // All processes died before window appeared
                finalize(&app, game_id, session_id, 0, &started_at);
                return;
            }
            
            // No timer-based force dismiss: keep waiting while the process runs.
            // Only exit via window detection above or process death.
            std::thread::sleep(Duration::from_millis(200));
        }

        let play_start = Instant::now();
        while is_process_running(&image_name) {
            std::thread::sleep(PROCESS_POLL_INTERVAL);
        }

        let minutes = (play_start.elapsed().as_secs() / 60) as i64;
        finalize(&app, game_id, session_id, minutes, &started_at);
    });
}
