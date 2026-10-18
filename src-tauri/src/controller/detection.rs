use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ControllerType {
    Xbox360,
    XboxOne,
    XboxSeries,
    PlayStation3,
    PlayStation4,
    PlayStation5,
    SwitchPro,
    SteamDeck,
    Generic,
}

impl ControllerType {
    pub fn display_name(&self) -> &'static str {
        match self {
            Self::Xbox360 => "Xbox 360",
            Self::XboxOne => "Xbox One",
            Self::XboxSeries => "Xbox Series",
            Self::PlayStation3 => "PlayStation 3",
            Self::PlayStation4 => "PlayStation 4",
            Self::PlayStation5 => "PlayStation 5",
            Self::SwitchPro => "Switch Pro",
            Self::SteamDeck => "Steam Deck",
            Self::Generic => "Generic",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ButtonPrompt {
    XboxA,
    XboxB,
    XboxX,
    XboxY,
    XboxMenu,
    XboxView,
    PlayStationCross,
    PlayStationCircle,
    PlayStationSquare,
    PlayStationTriangle,
    PlayStationOptions,
    PlayStationShare,
    GenericButton1,
    GenericButton2,
    GenericButton3,
    GenericButton4,
    DpadUp,
    DpadDown,
    DpadLeft,
    DpadRight,
    LeftStick,
    RightStick,
    LeftShoulder,
    RightShoulder,
    LeftTrigger,
    RightTrigger,
}

impl ButtonPrompt {
    pub fn label(&self) -> &'static str {
        match self {
            Self::XboxA => "A",
            Self::XboxB => "B",
            Self::XboxX => "X",
            Self::XboxY => "Y",
            Self::XboxMenu => "Menu",
            Self::XboxView => "View",
            Self::PlayStationCross => "\u{2715}",
            Self::PlayStationCircle => "\u{25CB}",
            Self::PlayStationSquare => "\u{25A1}",
            Self::PlayStationTriangle => "\u{25B3}",
            Self::PlayStationOptions => "Options",
            Self::PlayStationShare => "Share",
            Self::GenericButton1 => "1",
            Self::GenericButton2 => "2",
            Self::GenericButton3 => "3",
            Self::GenericButton4 => "4",
            Self::DpadUp => "\u{2191}",
            Self::DpadDown => "\u{2193}",
            Self::DpadLeft => "\u{2190}",
            Self::DpadRight => "\u{2192}",
            Self::LeftStick => "LS",
            Self::RightStick => "RS",
            Self::LeftShoulder => "LB",
            Self::RightShoulder => "RB",
            Self::LeftTrigger => "LT",
            Self::RightTrigger => "RT",
        }
    }
}

pub fn identify_controller(vendor_id: Option<u16>, product_id: Option<u16>, name: &str) -> ControllerType {
    let name_lower = name.to_lowercase();

    if let (Some(vid), Some(pid)) = (vendor_id, product_id) {
        match vid {
            0x045E => {
                // Microsoft
                if pid >= 0x0B00 && pid <= 0x0BFF {
                    return ControllerType::XboxSeries;
                }
                if pid >= 0x02D0 && pid <= 0x02FF {
                    return ControllerType::XboxOne;
                }
                return ControllerType::Xbox360;
            }
            0x054C => {
                // Sony
                if pid == 0x0CE6 || pid == 0x0DF2 {
                    return ControllerType::PlayStation5;
                }
                if pid == 0x05C4 || pid == 0x09CC || pid == 0x0BA0 {
                    return ControllerType::PlayStation4;
                }
                if pid == 0x0268 {
                    return ControllerType::PlayStation3;
                }
            }
            0x057E => {
                // Nintendo
                if pid == 0x2009 {
                    return ControllerType::SwitchPro;
                }
            }
            0x28DE => {
                // Valve
                if pid == 0x1205 {
                    return ControllerType::SteamDeck;
                }
            }
            _ => {}
        }
    }

    // Fallback: name-based detection
    if name_lower.contains("xbox") || name_lower.contains("xinput") {
        if name_lower.contains("series") {
            return ControllerType::XboxSeries;
        }
        if name_lower.contains("one") {
            return ControllerType::XboxOne;
        }
        return ControllerType::Xbox360;
    }
    if name_lower.contains("dualsense") || name_lower.contains("ps5") {
        return ControllerType::PlayStation5;
    }
    if name_lower.contains("dualshock 4") || name_lower.contains("dualshock4") || name_lower.contains("ps4") || name_lower.contains("wireless controller") {
        return ControllerType::PlayStation4;
    }
    if name_lower.contains("dualshock 3") || name_lower.contains("ps3") {
        return ControllerType::PlayStation3;
    }
    if name_lower.contains("switch") || name_lower.contains("pro controller") {
        return ControllerType::SwitchPro;
    }
    if name_lower.contains("steam") {
        return ControllerType::SteamDeck;
    }

    ControllerType::Generic
}
