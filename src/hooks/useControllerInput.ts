import { useEffect, useRef } from "react";
import type { GamehubAction } from "../types/controller";
import { useControllerStore } from "../store/controllerStore";
import { useConsoleStore } from "../store/consoleStore";

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
          .map((p) => ({
            id: p.index,
            name: p.id,
            os_name: "Web Gamepad API",
            controllerType: "Generic",
            vendorId: null,
            productId: null,
            buttonPrompts: {},
            isActive: true,
          }));
        setControllers(list as any);
        const active = pads.find((p) => p !== null);
        setActiveController(active ? ({ id: active.index, name: active.id, os_name: "Web Gamepad API", controllerType: "Generic", vendorId: null, productId: null, buttonPrompts: {}, isActive: true } as any) : null);
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
