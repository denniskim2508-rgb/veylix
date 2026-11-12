import { useEffect, useRef } from "react";
import type { ButtonPrompt, ControllerInfo, ControllerType, GamehubAction } from "../types/controller";
import { useControllerStore } from "../store/controllerStore";
import { useConsoleStore } from "../store/consoleStore";

function identifyControllerType(id: string): ControllerType {
  const n = id.toLowerCase();
  // Common Web Gamepad API IDs: "Xbox 360 Controller (XInput STANDARD GAMEPAD)",
  // "Wireless Controller (STANDARD GAMEPAD)" (DS4), "DualSense Wireless Controller", etc.
  // Also may include "Vendor: 045e Product: 028e" style strings in some browsers.
  const vidMatch = n.match(/vendor:\s*([0-9a-f]{4})/i) || n.match(/045e|054c|057e|28de/);
  const pidMatch = n.match(/product:\s*([0-9a-f]{4})/i);
  const vid = vidMatch ? (vidMatch[1] ? parseInt(vidMatch[1], 16) : (n.includes("045e") ? 0x045e : n.includes("054c") ? 0x054c : n.includes("057e") ? 0x057e : n.includes("28de") ? 0x28de : 0)) : 0;
  const pid = pidMatch ? parseInt(pidMatch[1], 16) : 0;

  if (vid === 0x045e) {
    if (pid >= 0x0b00 && pid <= 0x0bff) return "xboxSeries";
    if (pid >= 0x02d0 && pid <= 0x02ff) return "xboxOne";
    return "xbox360";
  }
  if (vid === 0x054c) {
    if (pid === 0x0ce6 || pid === 0x0df2) return "playStation5";
    if (pid === 0x05c4 || pid === 0x09cc || pid === 0x0ba0) return "playStation4";
    if (pid === 0x0268) return "playStation3";
    if (n.includes("dualsense")) return "playStation5";
    if (n.includes("dualshock 4") || n.includes("dualshock4")) return "playStation4";
    return "playStation4";
  }
  if (vid === 0x057e) return "switchPro";
  if (vid === 0x28de) return "steamDeck";

  if (n.includes("xbox") || n.includes("xinput")) {
    if (n.includes("series")) return "xboxSeries";
    if (n.includes("one")) return "xboxOne";
    return "xbox360";
  }
  if (n.includes("dualsense") || n.includes("ps5")) return "playStation5";
  if (n.includes("dualshock 4") || n.includes("dualshock4") || n.includes("ps4") || n.includes("wireless controller")) return "playStation4";
  if (n.includes("dualshock 3") || n.includes("ps3")) return "playStation3";
  if (n.includes("switch") || n.includes("pro controller")) return "switchPro";
  if (n.includes("steam")) return "steamDeck";
  return "generic";
}

function getButtonPrompts(controllerType: ControllerType): Partial<Record<GamehubAction, ButtonPrompt>> {
  const m: Partial<Record<GamehubAction, ButtonPrompt>> = {};
  if (controllerType === "xbox360" || controllerType === "xboxOne" || controllerType === "xboxSeries") {
    m.confirm = "xboxA";
    m.cancel = "xboxB";
    m.secondaryAction = "xboxX";
    m.menu = "xboxMenu";
  } else if (controllerType === "playStation3" || controllerType === "playStation4" || controllerType === "playStation5") {
    m.confirm = "playStationCross";
    m.cancel = "playStationCircle";
    m.secondaryAction = "playStationSquare";
    m.menu = "playStationOptions";
  } else {
    m.confirm = "genericButton1";
    m.cancel = "genericButton2";
    m.secondaryAction = "genericButton3";
    m.menu = "genericButton4";
  }
  m.up = "dpadUp";
  m.down = "dpadDown";
  m.left = "dpadLeft";
  m.right = "dpadRight";
  m.leftShoulder = "leftShoulder";
  m.rightShoulder = "rightShoulder";
  m.leftTrigger = "leftTrigger";
  m.rightTrigger = "rightTrigger";
  m.leftStickClick = "leftStick";
  m.rightStickClick = "rightStick";
  return m;
}

function buildControllerInfo(pad: Gamepad): ControllerInfo {
  const controllerType = identifyControllerType(pad.id);
  return {
    id: pad.index,
    name: pad.id,
    osName: "Web Gamepad API",
    controllerType,
    vendorId: null,
    productId: null,
    buttonPrompts: getButtonPrompts(controllerType),
    isActive: true,
  };
}

export function useControllerInput(
  onAction: (action: GamehubAction, pressed: boolean) => void,
  onAxis: (axis: string, value: number) => void,
) {
  const { setConnected, setControllers, setActiveController, setInputMethod, settings } = useControllerStore();
  const onActionRef = useRef(onAction);
  const onAxisRef = useRef(onAxis);
  const settingsRef = useRef(settings);
  const rafRef = useRef<number>(0);
  const prevButtons = useRef<Map<number, boolean>>(new Map());
  const postGameBaseline = useRef<boolean>(false);
  const activated = useRef<boolean>(false);

  onActionRef.current = onAction;
  onAxisRef.current = onAxis;
  settingsRef.current = settings;

  useEffect(() => {
    let running = true;

    // Track connected gamepads via the Web Gamepad API (reliable in WebView2).
    const updateConnection = () => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const connected = pads.filter((p) => p !== null).length > 0;
      setConnected(connected);
      if (connected) {
        const list = pads
          .filter((p): p is Gamepad => p !== null)
          .map((p) => buildControllerInfo(p));
        // Keep first as active for display; mark accordingly.
        if (list.length > 0) {
          list[0] = { ...list[0], isActive: true };
          for (let i = 1; i < list.length; i++) list[i] = { ...list[i], isActive: false };
        }
        setControllers(list);
        setActiveController(list[0] ?? null);
      } else {
        setControllers([]);
        setActiveController(null);
      }
    };

    // Button index -> GamehubAction (standard gamepad mapping)
    const buttonMap: Record<number, GamehubAction> = {
      0: "confirm",        // A / Cross
      1: "cancel",         // B / Circle
      2: "secondaryAction",// X / Square
      3: "secondaryAction",// Y / Triangle
      4: "leftShoulder",   // LB
      5: "rightShoulder",  // RB
      6: "leftTrigger",    // LT
      7: "rightTrigger",   // RT
      8: "secondaryAction",// Select/Share
      9: "menu",           // Start/Options
      10: "leftStickClick",
      11: "rightStickClick",
      12: "up",            // DPad Up
      13: "down",          // DPad Down
      14: "left",          // DPad Left
      15: "right",         // DPad Right
    };

    // Ensure the page is activated (required by Web Gamepad API for gamepadconnected to fire).
    const activate = () => { activated.current = true; };
    const onFirstInteraction = () => { activate(); };
    window.addEventListener("click", onFirstInteraction, { once: true });
    window.addEventListener("keydown", onFirstInteraction, { once: true });
    // Also treat any gamepad button press as activation by polling getGamepads on every frame.
    // Focus the window to ensure it's the foreground.
    try { window.focus(); } catch {}

    const poll = async () => {
      if (!running) return;

      const s = useConsoleStore.getState();
      if (s.sessionState !== "idle" && s.activeGameId === null) useConsoleStore.getState().endSession();
      const s2 = useConsoleStore.getState();
      if (s2.activeGameId !== null || s2.sessionState !== "idle") {
        rafRef.current = requestAnimationFrame(poll);
        return;
      }
      if (Date.now() - s2.gameExitedAt < 1500) {
        postGameBaseline.current = true;
        prevButtons.current.clear();
        rafRef.current = requestAnimationFrame(poll);
        return;
      }

      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const padCount = pads.filter((p) => p !== null).length;
      if (padCount > 0) {
        activated.current = true;
      }
      updateConnection();

      for (const pad of pads) {
        if (!pad) continue;
        // Buttons
        pad.buttons.forEach((btn, idx) => {
          const key = pad.index * 100 + idx;
          const wasPressed = prevButtons.current.get(key) || false;
          const pressed = btn.pressed || btn.value > 0.5;
          if (pressed !== wasPressed) {
            // button press handled below
            if (postGameBaseline.current) {
              prevButtons.current.set(key, pressed);
              return;
            }
            prevButtons.current.set(key, pressed);
            const action = buttonMap[idx];
            if (action && pressed) {
              setInputMethod("controller");
              onActionRef.current(action, true);
            }
          } else {
            prevButtons.current.set(key, pressed);
          }
        });
        // Axes
        if (pad.axes.length >= 2) {
          const dz = settingsRef.current.deadZone;
          const lx = Math.abs(pad.axes[0]) < dz ? 0 : pad.axes[0];
          const ly = Math.abs(pad.axes[1]) < dz ? 0 : pad.axes[1];
          onAxisRef.current("LeftStickX", lx);
          onAxisRef.current("LeftStickY", ly);
        }
      }

      if (postGameBaseline.current) {
        postGameBaseline.current = false;
      }

      rafRef.current = requestAnimationFrame(poll);
    };

    // Listen for gamepad connect/disconnect
    const onConnect = () => updateConnection();
    const onDisconnect = () => updateConnection();
    window.addEventListener("gamepadconnected", onConnect);
    window.addEventListener("gamepaddisconnected", onDisconnect);

    rafRef.current = requestAnimationFrame(poll);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("gamepadconnected", onConnect);
      window.removeEventListener("gamepaddisconnected", onDisconnect);
      window.removeEventListener("click", onFirstInteraction);
      window.removeEventListener("keydown", onFirstInteraction);
    };
  }, [setConnected, setControllers, setActiveController, setInputMethod]);
}
