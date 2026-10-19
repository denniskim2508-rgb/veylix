pub mod detection;
pub mod mapping;

use detection::{ControllerType, identify_controller};
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
    use gilrs::{Gilrs, GamepadId, EventType};

    let mut gilrs = match Gilrs::new() {
        Ok(g) => {
            let count = g.gamepads().count();
            let connected: Vec<_> = g.gamepads().map(|(_, p)| {
                let vid = p.vendor_id();
                let pid = p.product_id();
                format!("\"{}\" os=\"{}\" vid={:?} pid={:?}", p.name(), p.os_name(), vid, pid)
            }).collect();
            log::info!("[Controller] gilrs (XInput) initialized OK — {} device(s) on startup: {:?}", count, connected);
            g
        }
        Err(e) => {
            log::error!("[Controller] gilrs init FAILED: {:?}", e);
            log::error!("[Controller] This likely means xinput1_4.dll is not available.");
            while let Ok(_req) = rx.recv() {}
            return;
        }
    };

    let mut controllers: HashMap<GamepadId, ControllerState> = HashMap::new();
    let mut active_id: Option<GamepadId> = None;
    let mut settings = ControllerSettings::default();
    let mut next_serial_id: usize = 1;
    let mut serial_map: HashMap<GamepadId, usize> = HashMap::new();
    let mut last_alive_log = std::time::Instant::now();
    let mut poll_count: u64 = 0;

    struct ControllerState {
        info: ControllerInfo,
        mapping: ButtonMapping,
        prev_buttons: HashMap<PhysicalButton, bool>,
        left_stick_x: f32,
        left_stick_y: f32,
    }

    fn get_serial_id(gid: GamepadId, serial_map: &mut HashMap<GamepadId, usize>, next: &mut usize) -> usize {
        *serial_map.entry(gid).or_insert_with(|| {
            let id = *next;
            *next += 1;
            id
        })
    }

    // gilrs only emits `EventType::Connected` on a disconnected -> connected
    // transition. Pads that are already plugged in when `Gilrs::new()` runs never
    // produce that event, so seed the map from the current gamepad list.
    let already_connected: Vec<_> = gilrs
        .gamepads()
        .map(|(gid, pad)| {
            (
                gid,
                pad.name().to_string(),
                pad.os_name().to_string(),
                pad.vendor_id(),
                pad.product_id(),
            )
        })
        .collect();

    for (gid, name, os_name, vid, pid) in already_connected {
        let sid = get_serial_id(gid, &mut serial_map, &mut next_serial_id);
        let ctype = identify_controller(vid, pid, &name);
        let prompts = get_button_prompts(ctype);
        log::info!("[Controller] seeded already-connected pad id={} \"{}\" os=\"{}\" vid={:?} pid={:?} type={:?}", sid, name, os_name, vid, pid, ctype);
        controllers.insert(gid, ControllerState {
            info: ControllerInfo {
                id: sid,
                name,
                os_name,
                controller_type: ctype,
                vendor_id: vid,
                product_id: pid,
                button_prompts: prompts,
                is_active: true,
            },
            mapping: get_default_mapping(ctype),
            prev_buttons: HashMap::new(),
            left_stick_x: 0.0,
            left_stick_y: 0.0,
        });
        if active_id.is_none() {
            active_id = Some(gid);
        }
    }

    log::info!("[Controller] controller_thread started, entering event loop ({} controller(s) seeded)", controllers.len());
    loop {
        while let Ok(req) = rx.try_recv() {
            match req.cmd {
                ControllerCommand::PollEvents => {
                    let mut events = Vec::new();
                    poll_count += 1;

                    while let Some(ev) = gilrs.next_event() {
                        let sid = get_serial_id(ev.id, &mut serial_map, &mut next_serial_id);
                        match ev.event {
                            EventType::Connected => {
                                let pad = gilrs.gamepad(ev.id);
                                let name = pad.name().to_string();
                                let os_name = pad.os_name().to_string();
                                let vid = pad.vendor_id();
                                let pid = pad.product_id();
                                let ctype = identify_controller(vid, pid, &name);
                                let prompts = get_button_prompts(ctype);
                                let mapping = get_default_mapping(ctype);

                                log::info!("[gilrs] CONNECTED: \"{}\" os=\"{}\" vid={:?} pid={:?} type={:?}", name, os_name, vid, pid, ctype);

                                let info = ControllerInfo {
                                    id: sid,
                                    name: name.clone(),
                                    os_name: os_name.clone(),
                                    controller_type: ctype,
                                    vendor_id: vid,
                                    product_id: pid,
                                    button_prompts: prompts.clone(),
                                    is_active: true,
                                };

                                controllers.insert(ev.id, ControllerState {
                                    info,
                                    mapping,
                                    prev_buttons: HashMap::new(),
                                    left_stick_x: 0.0,
                                    left_stick_y: 0.0,
                                });

                                active_id = Some(ev.id);

                                events.push(GamepadChannelEvent::Connected {
                                    id: sid,
                                    name,
                                    os_name,
                                    controller_type: ctype,
                                    vendor_id: vid,
                                    product_id: pid,
                                    button_prompts: prompts,
                                });
                            }
                            EventType::Disconnected => {
                                log::info!("[gilrs] DISCONNECTED: serial_id={}", sid);
                                controllers.remove(&ev.id);
                                serial_map.remove(&ev.id);
                                if active_id == Some(ev.id) {
                                    active_id = controllers.keys().next().copied();
                                }
                                events.push(GamepadChannelEvent::Disconnected { id: sid });
                            }
                            EventType::ButtonPressed(button, _) => {
                                active_id = Some(ev.id);
                                if let Some(state) = controllers.get_mut(&ev.id) {
                                    if let Some(phys) = PhysicalButton::from_gilrs(button) {
                                        state.prev_buttons.insert(phys, true);
                                        let action = state.mapping.get(&phys).copied()
                                            .unwrap_or(GamehubAction::Confirm);
                                        events.push(GamepadChannelEvent::Action {
                                            id: sid,
                                            action,
                                            pressed: true,
                                        });
                                    }
                                }
                            }
                            EventType::ButtonReleased(button, _) => {
                                if let Some(state) = controllers.get_mut(&ev.id) {
                                    if let Some(phys) = PhysicalButton::from_gilrs(button) {
                                        state.prev_buttons.insert(phys, false);
                                        let action = state.mapping.get(&phys).copied()
                                            .unwrap_or(GamehubAction::Confirm);
                                        events.push(GamepadChannelEvent::Action {
                                            id: sid,
                                            action,
                                            pressed: false,
                                        });
                                    }
                                }
                            }
                            EventType::AxisChanged(axis, value, _) => {
                                active_id = Some(ev.id);
                                let axis_name = format!("{:?}", axis);
                                if let Some(state) = controllers.get_mut(&ev.id) {
                                    match axis {
                                        gilrs::Axis::LeftStickX => state.left_stick_x = value,
                                        gilrs::Axis::LeftStickY => state.left_stick_y = value,
                                        _ => {}
                                    }
                                }
                                events.push(GamepadChannelEvent::AxisChanged {
                                    id: sid,
                                    axis: axis_name,
                                    value,
                                });
                            }
                            _ => {}
                        }
                    }
                    if !events.is_empty() {
                        log::info!("[Controller] poll #{}: {} event(s)", poll_count, events.len());
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
                    return;
                }
            }
        }

        std::thread::sleep(std::time::Duration::from_millis(4));

        if last_alive_log.elapsed() >= std::time::Duration::from_secs(5) {
            log::info!("[Controller] alive #{} — {} controller(s) tracked", poll_count, controllers.len());
            last_alive_log = std::time::Instant::now();
        }
    }
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
