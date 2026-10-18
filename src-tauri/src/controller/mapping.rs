use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use super::detection::ControllerType;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GamehubAction {
    Up,
    Down,
    Left,
    Right,
    Confirm,
    Cancel,
    Menu,
    SecondaryAction,
    LeftShoulder,
    RightShoulder,
    LeftTrigger,
    RightTrigger,
    LeftStickClick,
    RightStickClick,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PhysicalButton {
    South,
    East,
    West,
    North,
    Start,
    Select,
    LeftTrigger,
    RightTrigger,
    LeftBumper,
    RightBumper,
    LeftThumb,
    RightThumb,
    DpadUp,
    DpadDown,
    DpadLeft,
    DpadRight,
}

impl PhysicalButton {
    pub fn from_gilrs(btn: gilrs::Button) -> Option<Self> {
        match btn {
            gilrs::Button::South => Some(Self::South),
            gilrs::Button::East => Some(Self::East),
            gilrs::Button::West => Some(Self::West),
            gilrs::Button::North => Some(Self::North),
            gilrs::Button::Start => Some(Self::Start),
            gilrs::Button::Select => Some(Self::Select),
            gilrs::Button::LeftTrigger => Some(Self::LeftBumper),
            gilrs::Button::LeftTrigger2 => Some(Self::LeftTrigger),
            gilrs::Button::RightTrigger => Some(Self::RightBumper),
            gilrs::Button::RightTrigger2 => Some(Self::RightTrigger),
            gilrs::Button::LeftThumb => Some(Self::LeftThumb),
            gilrs::Button::RightThumb => Some(Self::RightThumb),
            gilrs::Button::DPadUp => Some(Self::DpadUp),
            gilrs::Button::DPadDown => Some(Self::DpadDown),
            gilrs::Button::DPadLeft => Some(Self::DpadLeft),
            gilrs::Button::DPadRight => Some(Self::DpadRight),
            _ => None,
        }
    }
}

pub type ButtonMapping = HashMap<PhysicalButton, GamehubAction>;

pub fn get_default_mapping(controller_type: ControllerType) -> ButtonMapping {
    let mut m = HashMap::new();
    match controller_type {
        ControllerType::Xbox360 | ControllerType::XboxOne | ControllerType::XboxSeries => {
            m.insert(PhysicalButton::South, GamehubAction::Confirm);
            m.insert(PhysicalButton::East, GamehubAction::Cancel);
            m.insert(PhysicalButton::West, GamehubAction::SecondaryAction);
            m.insert(PhysicalButton::North, GamehubAction::SecondaryAction);
            m.insert(PhysicalButton::Start, GamehubAction::Menu);
            m.insert(PhysicalButton::Select, GamehubAction::SecondaryAction);
            m.insert(PhysicalButton::LeftBumper, GamehubAction::LeftShoulder);
            m.insert(PhysicalButton::RightBumper, GamehubAction::RightShoulder);
            m.insert(PhysicalButton::LeftTrigger, GamehubAction::LeftTrigger);
            m.insert(PhysicalButton::RightTrigger, GamehubAction::RightTrigger);
            m.insert(PhysicalButton::LeftThumb, GamehubAction::LeftStickClick);
            m.insert(PhysicalButton::RightThumb, GamehubAction::RightStickClick);
            m.insert(PhysicalButton::DpadUp, GamehubAction::Up);
            m.insert(PhysicalButton::DpadDown, GamehubAction::Down);
            m.insert(PhysicalButton::DpadLeft, GamehubAction::Left);
            m.insert(PhysicalButton::DpadRight, GamehubAction::Right);
        }
        ControllerType::PlayStation3 | ControllerType::PlayStation4 | ControllerType::PlayStation5 => {
            m.insert(PhysicalButton::South, GamehubAction::Confirm);
            m.insert(PhysicalButton::East, GamehubAction::Cancel);
            m.insert(PhysicalButton::West, GamehubAction::SecondaryAction);
            m.insert(PhysicalButton::North, GamehubAction::SecondaryAction);
            m.insert(PhysicalButton::Start, GamehubAction::Menu);
            m.insert(PhysicalButton::Select, GamehubAction::SecondaryAction);
            m.insert(PhysicalButton::LeftBumper, GamehubAction::LeftShoulder);
            m.insert(PhysicalButton::RightBumper, GamehubAction::RightShoulder);
            m.insert(PhysicalButton::LeftTrigger, GamehubAction::LeftTrigger);
            m.insert(PhysicalButton::RightTrigger, GamehubAction::RightTrigger);
            m.insert(PhysicalButton::LeftThumb, GamehubAction::LeftStickClick);
            m.insert(PhysicalButton::RightThumb, GamehubAction::RightStickClick);
            m.insert(PhysicalButton::DpadUp, GamehubAction::Up);
            m.insert(PhysicalButton::DpadDown, GamehubAction::Down);
            m.insert(PhysicalButton::DpadLeft, GamehubAction::Left);
            m.insert(PhysicalButton::DpadRight, GamehubAction::Right);
        }
        _ => {
            m.insert(PhysicalButton::South, GamehubAction::Confirm);
            m.insert(PhysicalButton::East, GamehubAction::Cancel);
            m.insert(PhysicalButton::West, GamehubAction::SecondaryAction);
            m.insert(PhysicalButton::North, GamehubAction::SecondaryAction);
            m.insert(PhysicalButton::Start, GamehubAction::Menu);
            m.insert(PhysicalButton::Select, GamehubAction::SecondaryAction);
            m.insert(PhysicalButton::LeftBumper, GamehubAction::LeftShoulder);
            m.insert(PhysicalButton::RightBumper, GamehubAction::RightShoulder);
            m.insert(PhysicalButton::LeftTrigger, GamehubAction::LeftTrigger);
            m.insert(PhysicalButton::RightTrigger, GamehubAction::RightTrigger);
            m.insert(PhysicalButton::LeftThumb, GamehubAction::LeftStickClick);
            m.insert(PhysicalButton::RightThumb, GamehubAction::RightStickClick);
            m.insert(PhysicalButton::DpadUp, GamehubAction::Up);
            m.insert(PhysicalButton::DpadDown, GamehubAction::Down);
            m.insert(PhysicalButton::DpadLeft, GamehubAction::Left);
            m.insert(PhysicalButton::DpadRight, GamehubAction::Right);
        }
    }
    m
}

pub fn get_button_prompts(controller_type: ControllerType) -> HashMap<GamehubAction, super::detection::ButtonPrompt> {
    use super::detection::ButtonPrompt;
    let mut m = HashMap::new();
    match controller_type {
        ControllerType::Xbox360 | ControllerType::XboxOne | ControllerType::XboxSeries => {
            m.insert(GamehubAction::Confirm, ButtonPrompt::XboxA);
            m.insert(GamehubAction::Cancel, ButtonPrompt::XboxB);
            m.insert(GamehubAction::SecondaryAction, ButtonPrompt::XboxX);
            m.insert(GamehubAction::Menu, ButtonPrompt::XboxMenu);
        }
        ControllerType::PlayStation3 | ControllerType::PlayStation4 | ControllerType::PlayStation5 => {
            m.insert(GamehubAction::Confirm, ButtonPrompt::PlayStationCross);
            m.insert(GamehubAction::Cancel, ButtonPrompt::PlayStationCircle);
            m.insert(GamehubAction::SecondaryAction, ButtonPrompt::PlayStationSquare);
            m.insert(GamehubAction::Menu, ButtonPrompt::PlayStationOptions);
        }
        _ => {
            m.insert(GamehubAction::Confirm, ButtonPrompt::GenericButton1);
            m.insert(GamehubAction::Cancel, ButtonPrompt::GenericButton2);
            m.insert(GamehubAction::SecondaryAction, ButtonPrompt::GenericButton3);
            m.insert(GamehubAction::Menu, ButtonPrompt::GenericButton4);
        }
    }
    m.insert(GamehubAction::Up, ButtonPrompt::DpadUp);
    m.insert(GamehubAction::Down, ButtonPrompt::DpadDown);
    m.insert(GamehubAction::Left, ButtonPrompt::DpadLeft);
    m.insert(GamehubAction::Right, ButtonPrompt::DpadRight);
    m.insert(GamehubAction::LeftShoulder, ButtonPrompt::LeftShoulder);
    m.insert(GamehubAction::RightShoulder, ButtonPrompt::RightShoulder);
    m.insert(GamehubAction::LeftTrigger, ButtonPrompt::LeftTrigger);
    m.insert(GamehubAction::RightTrigger, ButtonPrompt::RightTrigger);
    m.insert(GamehubAction::LeftStickClick, ButtonPrompt::LeftStick);
    m.insert(GamehubAction::RightStickClick, ButtonPrompt::RightStick);
    m
}
