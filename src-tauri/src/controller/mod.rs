pub mod detection;
pub mod mapping;

use detection::{ControllerType, identify_controller};

// --- XInput (via windows-sys, reliable Windows input for Xbox + XInput-mode controllers) ---
use windows_sys::Win32::UI::Input::XboxController::{
    XInputGetState, XINPUT_STATE, XINPUT_GAMEPAD,
    XINPUT_GAMEPAD_DPAD_UP, XINPUT_GAMEPAD_DPAD_DOWN, XINPUT_GAMEPAD_DPAD_LEFT,
    XINPUT_GAMEPAD_DPAD_RIGHT, XINPUT_GAMEPAD_START, XINPUT_GAMEPAD_BACK,
    XINPUT_GAMEPAD_LEFT_THUMB, XINPUT_GAMEPAD_RIGHT_THUMB,
    XINPUT_GAMEPAD_LEFT_SHOULDER, XINPUT_GAMEPAD_RIGHT_SHOULDER,
    XINPUT_GAMEPAD_A, XINPUT_GAMEPAD_B, XINPUT_GAMEPAD_X, XINPUT_GAMEPAD_Y,
};

fn xinput_get_state(slot: u32) -> Option<XINPUT_STATE> {
    let mut state: XINPUT_STATE = unsafe { std::mem::zeroed() };
    let r = unsafe { XInputGetState(slot, &mut state) };
    if r == 0 { Some(state) } else { None }
}
use mapping::{GamehubAction, PhysicalButton, ButtonMapping, get_default_mapping, get_button_prompts};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ControllerInfo {
    pub id: usize,
    pub name: String,
    pub os_name: String,
    pub controller_type: ControllerType,
    pub vendor_id: Option<u16>,
    pub product_id: Option<u16>,
    pub button_prompts: HashMap<GamehubAction, detection::ButtonPrompt>,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ControllerSettings {
    pub dead_zone: f32,
    pub repeat_delay: u64,
    pub repeat_rate: u64,
    pub stick_threshold: f32,
}

impl Default for ControllerSettings {
    fn default() -> Self {
        Self {
            dead_zone: 0.2,
            repeat_delay: 300,
            repeat_rate: 100,
            stick_threshold: 0.5,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum GamepadChannelEvent {
    Connected {
        id: usize,
        name: String,
        os_name: String,
        controller_type: ControllerType,
        vendor_id: Option<u16>,
        product_id: Option<u16>,
        button_prompts: HashMap<GamehubAction, detection::ButtonPrompt>,
    },
    Disconnected {
        id: usize,
    },
    Action {
        id: usize,
        action: GamehubAction,
        pressed: bool,
    },
    AxisChanged {
        id: usize,
        axis: String,
        value: f32,
    },
}

use std::sync::mpsc;

enum ControllerCommand {
    PollEvents,
    GetControllers,
    GetActiveController,
    GetSettings,
    UpdateSettings(ControllerSettings),
    Shutdown,
}

enum ControllerResponse {
    Events(Vec<GamepadChannelEvent>),
    Controllers(Vec<ControllerInfo>),
    ActiveController(Option<ControllerInfo>),
    Settings(ControllerSettings),
    Ack,
}

struct Request {
    cmd: ControllerCommand,
    resp_tx: mpsc::Sender<ControllerResponse>,
}

static REQ_TX: once_cell::sync::Lazy<mpsc::Sender<Request>> =
    once_cell::sync::Lazy::new(|| {
        let (tx, rx) = mpsc::channel();
        std::thread::spawn(move || controller_thread(rx));
        tx
    });

fn send_request(cmd: ControllerCommand) -> ControllerResponse {
    let (resp_tx, resp_rx) = mpsc::channel();
    let _ = REQ_TX.send(Request { cmd, resp_tx });
    resp_rx.recv().unwrap_or(ControllerResponse::Ack)
}

fn controller_thread(rx: mpsc::Receiver<Request>) {
    use windows::Gaming::Input::RawGameController as RawGc;
    use windows_sys::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED};
    use windows_sys::Win32::UI::WindowsAndMessaging::{PeekMessageW, DispatchMessageW, TranslateMessage, MSG, PM_REMOVE};

    // STA apartment is required for WGI RawGameController event delivery.
    unsafe { let _ = CoInitializeEx(std::ptr::null(), COINIT_APARTMENTTHREADED as u32); }

    // State tracking for diffing
    struct SlotState {
        id: usize,
        name: String,
        buttons: u32,
        axes: Vec<f64>,
    }
    let mut slot_states: Vec<SlotState> = Vec::new();
    let mut controllers: HashMap<usize, ControllerState> = HashMap::new();
    let mut active_id: Option<usize> = None;
    let mut settings = ControllerSettings::default();
    let mut next_serial_id: usize = 1;
    let mut serial_map: HashMap<usize, usize> = HashMap::new();
    let mut last_alive_log = std::time::Instant::now();
    let mut poll_count: u64 = 0;

    struct ControllerState {
        info: ControllerInfo,
        mapping: ButtonMapping,
        prev_buttons: HashMap<PhysicalButton, bool>,
        left_stick_x: f32,
        left_stick_y: f32,
    }

    fn get_serial_id(idx: usize, serial_map: &mut HashMap<usize, usize>, next: &mut usize) -> usize {
        *serial_map.entry(idx).or_insert_with(|| {
            let id = *next;
            *next += 1;
            id
        })
    }

    // Seed existing controllers
    if let Ok(gamepads) = windows::Gaming::Input::Gamepad::Gamepads() {
        let count = gamepads.Size().unwrap_or(0);
        for i in 0..count {
            if let Ok(gp) = gamepads.GetAt(i) {
                let reading = gp.GetCurrentReading().ok();
                let name = "Gamepad".to_string();
                let ctype = ControllerType::Xbox360;
                let prompts = get_button_prompts(ctype);
                let mapping = get_default_mapping(ctype);
                let sid = get_serial_id(i as usize, &mut serial_map, &mut next_serial_id);
                log::info!("[Controller] seeded gamepad idx={} reading={:?}", i, reading.as_ref().map(|r| r.Buttons.0));
                controllers.insert(i as usize, ControllerState {
                    info: ControllerInfo {
                        id: sid,
                        name: name.clone(),
                        os_name: "WGI".to_string(),
                        controller_type: ctype,
                        vendor_id: None,
                        product_id: None,
                        button_prompts: prompts.clone(),
                        is_active: true,
                    },
                    mapping,
                    prev_buttons: HashMap::new(),
                    left_stick_x: 0.0,
                    left_stick_y: 0.0,
                });
                slot_states.push(SlotState { id: i as usize, name, buttons: 0, axes: vec![] });
                if active_id.is_none() { active_id = Some(i as usize); }
            }
        }
    }
    log::info!("[Controller] controller_thread started, {} controller(s) seeded", controllers.len());

    loop {
        // Pump messages (required for WGI event delivery in STA).
        unsafe {
            let mut msg: MSG = std::mem::zeroed();
            while PeekMessageW(&mut msg, std::ptr::null_mut(), 0, 0, PM_REMOVE) != 0 {
                TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }
        }

        while let Ok(req) = rx.try_recv() {
            match req.cmd {
                ControllerCommand::PollEvents => {
                    let mut events = Vec::new();
                    poll_count += 1;

                    // Re-enumerate controllers (handle connect/disconnect)
                    let mut current_indices: Vec<usize> = Vec::new();
                    if let Ok(gamepads) = windows::Gaming::Input::Gamepad::Gamepads() {
                        let count = gamepads.Size().unwrap_or(0) as usize;
                        for i in 0..count {
                            if let Ok(gp) = gamepads.GetAt(i as u32) {
                                let reading = match gp.GetCurrentReading() {
                                    Ok(r) => r,
                                    Err(_) => continue,
                                };
                                let idx = i;
                                current_indices.push(idx);

                                let sid = if let Some(c) = controllers.get(&idx) { c.info.id } else {
                                    let new_sid = get_serial_id(idx, &mut serial_map, &mut next_serial_id);
                                    let ctype = ControllerType::Xbox360;
                                    let prompts = get_button_prompts(ctype);
                                    let mapping = get_default_mapping(ctype);
                                    controllers.insert(idx, ControllerState {
                                        info: ControllerInfo {
                                            id: new_sid,
                                            name: "Gamepad".to_string(),
                                            os_name: "WGI".to_string(),
                                            controller_type: ctype,
                                            vendor_id: None,
                                            product_id: None,
                                            button_prompts: prompts.clone(),
                                            is_active: true,
                                        },
                                        mapping,
                                        prev_buttons: HashMap::new(),
                                        left_stick_x: 0.0,
                                        left_stick_y: 0.0,
                                    });
                                    slot_states.push(SlotState { id: idx, name: "Gamepad".to_string(), buttons: 0, axes: vec![] });
                                    if active_id.is_none() { active_id = Some(idx); }
                                    new_sid
                                };

                                let old_btn_u32 = if idx < slot_states.len() { slot_states[idx].buttons } else { 0u32 };
                                let new_buttons_u32 = reading.Buttons.0;
                                if poll_count % 50 == 0 {
                                    log::info!("[WGI-Gamepad] buttons=0x{:X} lx={:.2} ly={:.2}", new_buttons_u32, reading.LeftThumbstickX, reading.LeftThumbstickY);
                                }
                                let changed = old_btn_u32 ^ new_buttons_u32;

                                // Map GamepadButtons to actions
                                let btn_map: &[(u32, PhysicalButton)] = &[
                                    (windows::Gaming::Input::GamepadButtons::A.0, PhysicalButton::South),
                                    (windows::Gaming::Input::GamepadButtons::B.0, PhysicalButton::East),
                                    (windows::Gaming::Input::GamepadButtons::X.0, PhysicalButton::West),
                                    (windows::Gaming::Input::GamepadButtons::Y.0, PhysicalButton::North),
                                    (windows::Gaming::Input::GamepadButtons::Menu.0, PhysicalButton::Start),
                                    (windows::Gaming::Input::GamepadButtons::View.0, PhysicalButton::Select),
                                    (windows::Gaming::Input::GamepadButtons::LeftShoulder.0, PhysicalButton::LeftBumper),
                                    (windows::Gaming::Input::GamepadButtons::RightShoulder.0, PhysicalButton::RightBumper),
                                    (windows::Gaming::Input::GamepadButtons::LeftThumbstick.0, PhysicalButton::LeftThumb),
                                    (windows::Gaming::Input::GamepadButtons::RightThumbstick.0, PhysicalButton::RightThumb),
                                    (windows::Gaming::Input::GamepadButtons::DPadUp.0, PhysicalButton::DpadUp),
                                    (windows::Gaming::Input::GamepadButtons::DPadDown.0, PhysicalButton::DpadDown),
                                    (windows::Gaming::Input::GamepadButtons::DPadLeft.0, PhysicalButton::DpadLeft),
                                    (windows::Gaming::Input::GamepadButtons::DPadRight.0, PhysicalButton::DpadRight),
                                ];

                                for (mask, phys) in btn_map {
                                    if changed & mask != 0 {
                                        let pressed = new_buttons_u32 & mask != 0;
                                        let action = match phys {
                                            PhysicalButton::South => GamehubAction::Confirm,
                                            PhysicalButton::East => GamehubAction::Cancel,
                                            PhysicalButton::West => GamehubAction::SecondaryAction,
                                            PhysicalButton::North => GamehubAction::SecondaryAction,
                                            PhysicalButton::Start => GamehubAction::Menu,
                                            PhysicalButton::Select => GamehubAction::SecondaryAction,
                                            PhysicalButton::LeftBumper => GamehubAction::LeftShoulder,
                                            PhysicalButton::RightBumper => GamehubAction::RightShoulder,
                                            PhysicalButton::LeftThumb => GamehubAction::LeftStickClick,
                                            PhysicalButton::RightThumb => GamehubAction::RightStickClick,
                                            PhysicalButton::DpadUp => GamehubAction::Up,
                                            PhysicalButton::DpadDown => GamehubAction::Down,
                                            PhysicalButton::DpadLeft => GamehubAction::Left,
                                            PhysicalButton::DpadRight => GamehubAction::Right,
                                            PhysicalButton::LeftTrigger => GamehubAction::LeftTrigger,
                                            PhysicalButton::RightTrigger => GamehubAction::RightTrigger,
                                        };
                                        log::info!("[WGI-Gamepad] idx {} button {:?} pressed={}", idx, phys, pressed);
                                        events.push(GamepadChannelEvent::Action { id: sid, action, pressed });
                                    }
                                }

                                // Triggers
                                let lt = reading.LeftTrigger;
                                let rt = reading.RightTrigger;
                                // (simplified: emit trigger press/release on threshold crossing)
                                // Skip for now to avoid spam; handle via button events if needed.

                                // Axis events
                                events.push(GamepadChannelEvent::AxisChanged { id: sid, axis: "LeftStickX".to_string(), value: reading.LeftThumbstickX as f32 });
                                events.push(GamepadChannelEvent::AxisChanged { id: sid, axis: "LeftStickY".to_string(), value: reading.LeftThumbstickY as f32 });

                                if idx < slot_states.len() {
                                    slot_states[idx].buttons = new_buttons_u32;
                                    slot_states[idx].axes = vec![reading.LeftThumbstickX, reading.LeftThumbstickY, reading.RightThumbstickX, reading.RightThumbstickY];
                                } else {
                                    slot_states.push(SlotState { id: idx, name: "Gamepad".to_string(), buttons: new_buttons_u32, axes: vec![reading.LeftThumbstickX, reading.LeftThumbstickY, reading.RightThumbstickX, reading.RightThumbstickY] });
                                }
                            }
                        }
                    }

                    // Handle disconnections
                    let connected_indices: Vec<usize> = current_indices.clone();
                    let disconnected: Vec<usize> = slot_states.iter().map(|s| s.id).filter(|id| !connected_indices.contains(id)).collect();
                    for idx in disconnected {
                        log::info!("[WGI-Direct] DISCONNECTED idx={}", idx);
                        if let Some(c) = controllers.get(&idx) {
                            events.push(GamepadChannelEvent::Disconnected { id: c.info.id });
                        }
                        controllers.remove(&idx);
                        slot_states.retain(|s| s.id != idx);
                        serial_map.remove(&idx);
                    }

                    if poll_count % 50 == 0 {
                        log::info!("[Controller] poll #{}: {} controller(s) tracked, {} events", poll_count, controllers.len(), events.len());
                    }

                    let _ = req.resp_tx.send(ControllerResponse::Events(events));
                }
                ControllerCommand::GetControllers => {
                    let list: Vec<ControllerInfo> = controllers.values().map(|s| {
                        let mut info = s.info.clone();
                        if let Some(aid) = active_id {
                            info.is_active = controllers.get(&aid).map(|a| a.info.id) == Some(s.info.id);
                        } else {
                            info.is_active = false;
                        }
                        info
                    }).collect();
                    let _ = req.resp_tx.send(ControllerResponse::Controllers(list));
                }
                ControllerCommand::GetActiveController => {
                    let info = active_id.and_then(|id| {
                        controllers.get(&id).map(|s| {
                            let mut i = s.info.clone();
                            i.is_active = true;
                            i
                        })
                    });
                    let _ = req.resp_tx.send(ControllerResponse::ActiveController(info));
                }
                ControllerCommand::GetSettings => {
                    let _ = req.resp_tx.send(ControllerResponse::Settings(settings.clone()));
                }
                ControllerCommand::UpdateSettings(new_settings) => {
                    settings = new_settings;
                    let _ = req.resp_tx.send(ControllerResponse::Ack);
                }
                ControllerCommand::Shutdown => {
                    let _ = req.resp_tx.send(ControllerResponse::Ack);
                    unsafe { windows_sys::Win32::System::Com::CoUninitialize(); }
                    return;
                }
            }
        }

        std::thread::sleep(std::time::Duration::from_millis(4));

        if last_alive_log.elapsed() >= std::time::Duration::from_secs(5) {
            log::info!("[Controller] alive #{} - {} controller(s) tracked", poll_count, controllers.len());
            last_alive_log = std::time::Instant::now();
        }
    }

    unsafe { windows_sys::Win32::System::Com::CoUninitialize(); }
}


pub fn init_controller_manager() {
    let _ = &*REQ_TX;
}

pub fn poll_events() -> Vec<GamepadChannelEvent> {
    match send_request(ControllerCommand::PollEvents) {
        ControllerResponse::Events(events) => events,
        _ => vec![],
    }
}

pub fn get_controllers() -> Vec<ControllerInfo> {
    match send_request(ControllerCommand::GetControllers) {
        ControllerResponse::Controllers(list) => list,
        _ => vec![],
    }
}

pub fn get_active_controller() -> Option<ControllerInfo> {
    match send_request(ControllerCommand::GetActiveController) {
        ControllerResponse::ActiveController(info) => info,
        _ => None,
    }
}

pub fn get_controller_settings() -> ControllerSettings {
    match send_request(ControllerCommand::GetSettings) {
        ControllerResponse::Settings(s) => s,
        _ => ControllerSettings::default(),
    }
}

pub fn save_controller_settings(settings: ControllerSettings) {
    let _ = send_request(ControllerCommand::UpdateSettings(settings));
}
