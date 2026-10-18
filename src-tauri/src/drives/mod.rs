use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum DriveType {
    Fixed,
    Removable,
    Remote,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DriveInfo {
    pub letter: char,
    pub root_path: String,
    pub drive_type: DriveType,
    pub volume_label: String,
    pub fs_type: String,
    pub total_bytes: u64,
    pub free_bytes: u64,
}

impl DriveInfo {
    #[allow(dead_code)]
    pub fn used_bytes(&self) -> u64 {
        self.total_bytes.saturating_sub(self.free_bytes)
    }

    #[allow(dead_code)]
    pub fn usage_percent(&self) -> f64 {
        if self.total_bytes == 0 {
            return 0.0;
        }
        (self.used_bytes() as f64 / self.total_bytes as f64) * 100.0
    }
}

pub fn enumerate_drives() -> Vec<DriveInfo> {
    #[cfg(target_os = "windows")]
    {
        enumerate_drives_windows()
    }
    #[cfg(not(target_os = "windows"))]
    {
        Vec::new()
    }
}

#[cfg(target_os = "windows")]
fn enumerate_drives_windows() -> Vec<DriveInfo> {
    use windows_sys::Win32::Storage::FileSystem::{
        GetDiskFreeSpaceExW, GetDriveTypeW, GetLogicalDrives, GetVolumeInformationW,
    };

    let mut drives = Vec::new();
    let bitmask = unsafe { GetLogicalDrives() };

    if bitmask == 0 {
        return drives;
    }

    for i in 0..26u32 {
        if bitmask & (1 << i) == 0 {
            continue;
        }

        let letter = (b'A' + i as u8) as char;
        let root: Vec<u16> = format!("{letter}:\\")
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();

        let drive_type_raw = unsafe { GetDriveTypeW(root.as_ptr()) };
        let drive_type = match drive_type_raw {
            2 => DriveType::Removable,
            3 => DriveType::Fixed,
            4 => DriveType::Remote,
            _ => continue, // Skip CD-ROM, RAM disk, unknown
        };

        let mut free_bytes: u64 = 0;
        let mut total_bytes: u64 = 0;
        let space_ok = unsafe {
            GetDiskFreeSpaceExW(
                root.as_ptr(),
                std::ptr::null_mut(),
                &mut total_bytes,
                &mut free_bytes,
            )
        } != 0;

        let mut name_buf = [0u16; 256];
        let mut serial: u32 = 0;
        let mut max_comp: u32 = 0;
        let mut fs_flags: u32 = 0;
        let mut fs_buf = [0u16; 64];
        let has_info = unsafe {
            GetVolumeInformationW(
                root.as_ptr(),
                name_buf.as_mut_ptr(),
                name_buf.len() as u32,
                &mut serial,
                &mut max_comp,
                &mut fs_flags,
                fs_buf.as_mut_ptr(),
                fs_buf.len() as u32,
            )
        } != 0;

        let volume_label = if has_info {
            utf16_to_string(&name_buf)
        } else {
            String::new()
        };

        let fs_type = if has_info {
            utf16_to_string(&fs_buf)
        } else {
            String::new()
        };

        drives.push(DriveInfo {
            letter,
            root_path: format!("{letter}:\\"),
            drive_type,
            volume_label,
            fs_type,
            total_bytes: if space_ok { total_bytes } else { 0 },
            free_bytes: if space_ok { free_bytes } else { 0 },
        });
    }

    drives
}

fn utf16_to_string(buf: &[u16]) -> String {
    let len = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
    String::from_utf16_lossy(&buf[..len])
}
