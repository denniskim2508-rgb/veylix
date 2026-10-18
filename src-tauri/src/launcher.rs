use std::process::Command;

#[cfg(target_os = "windows")]
fn shell_execute_launch(exe: &str, args: Option<&str>, work_dir: Option<&str>) -> Result<(), String> {
    use windows_sys::Win32::UI::Shell::ShellExecuteW;
    use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

    let wide_verb: Vec<u16> = "open\0".encode_utf16().collect();
    let wide_exe: Vec<u16> = exe.encode_utf16().chain(std::iter::once(0)).collect();
    let wide_args: Vec<u16> = args
        .map(|a| a.encode_utf16().chain(std::iter::once(0)).collect())
        .unwrap_or_default();
    let wide_dir: Vec<u16> = work_dir
        .map(|d| d.encode_utf16().chain(std::iter::once(0)).collect())
        .unwrap_or_default();

    let result = unsafe {
        ShellExecuteW(
            std::ptr::null_mut(),
            wide_verb.as_ptr(),
            wide_exe.as_ptr(),
            if wide_args.is_empty() {
                std::ptr::null()
            } else {
                wide_args.as_ptr()
            },
            if wide_dir.is_empty() {
                std::ptr::null()
            } else {
                wide_dir.as_ptr()
            },
            SW_SHOWNORMAL,
        )
    };

    if result as isize > 32 {
        Ok(())
    } else {
        let err = std::io::Error::last_os_error();
        Err(format!("Failed to launch: {}", err))
    }
}

#[cfg(target_os = "windows")]
fn parse_exe_and_args(command: &str) -> (&str, Option<&str>) {
    let trimmed = command.trim();
    if trimmed.starts_with('"') {
        if let Some(end_quote) = trimmed[1..].find('"') {
            let exe = &trimmed[1..=end_quote];
            let rest = trimmed[end_quote + 2..].trim();
            if rest.is_empty() {
                (exe, None)
            } else {
                (exe, Some(rest))
            }
        } else {
            (trimmed, None)
        }
    } else {
        for (i, ch) in trimmed.char_indices() {
            if ch == ' ' || ch == '\t' {
                let exe = &trimmed[..i];
                let rest = trimmed[i..].trim();
                if rest.is_empty() {
                    return (exe, None);
                } else {
                    return (exe, Some(rest));
                }
            }
        }
        (trimmed, None)
    }
}

#[cfg(target_os = "windows")]
fn spawn_with_elevation(launch_command: &str) -> Result<(), String> {
    let (exe, args) = parse_exe_and_args(launch_command);

    if shell_execute_launch(exe, args, None).is_ok() {
        return Ok(());
    }

    if let Some(parent) = std::path::Path::new(exe).parent() {
        let work_dir = parent.to_string_lossy().to_string();
        if shell_execute_launch(exe, args, Some(&work_dir)).is_ok() {
            return Ok(());
        }
    }

    Command::new("cmd")
        .args(["/C", launch_command])
        .spawn()
        .map_err(|e| format!("Failed to launch game: {}", e))?;

    Ok(())
}

pub fn launch_game(launch_command: &str, executable_path: Option<&str>) -> Result<(), String> {
    if launch_command.starts_with("steam://")
        || launch_command.starts_with("com.epicgames.launcher://")
        || launch_command.starts_with("uplay://")
        || launch_command.starts_with("origin2://")
        || launch_command.starts_with("battlenet://")
        || launch_command.starts_with("rockstargames://")
    {
        open::that(launch_command).map_err(|e| format!("Failed to launch: {}", e))?;
        return Ok(());
    }

    if let Some(exe) = executable_path {
        #[cfg(target_os = "windows")]
        {
            let work_dir = std::path::Path::new(exe)
                .parent()
                .map(|p| p.to_string_lossy().to_string());

            if shell_execute_launch(exe, None, work_dir.as_deref()).is_ok() {
                return Ok(());
            }

            if shell_execute_launch(exe, None, None).is_ok() {
                return Ok(());
            }

            Command::new(exe)
                .spawn()
                .map_err(|e| format!("Failed to launch game: {}", e))?;
            return Ok(());
        }
        #[cfg(not(target_os = "windows"))]
        {
            Command::new(exe)
                .spawn()
                .map_err(|e| format!("Failed to launch game: {}", e))?;
            return Ok(());
        }
    }

    if !launch_command.is_empty() {
        #[cfg(target_os = "windows")]
        {
            return spawn_with_elevation(launch_command);
        }
        #[cfg(not(target_os = "windows"))]
        {
            Command::new("sh")
                .args(["-c", launch_command])
                .spawn()
                .map_err(|e| format!("Failed to launch game: {}", e))?;
            return Ok(());
        }
    }

    Err("No launch command or executable path available".to_string())
}
