import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { GamepadChannelEvent, GamehubAction, ControllerInfo } from "../types/controller";
import { useControllerStore } from "../store/controllerStore";
import { useConsoleStore } from "../store/consoleStore";

export function useControllerInput(
  onAction: (action: GamehubAction, pressed: boolean) => void,
  onAxis: (axis: string, value: number) => void,
) {
  const prevButtons = useRef<Map<string, boolean>>(new Map());
  const postGameBaseline = useRef<boolean>(false);
  const { setConnected, setControllers, setActiveController, setInputMethod, settings } = useControllerStore();
  const onActionRef = useRef(onAction);
  const onAxisRef = useRef(onAxis);
  const settingsRef = useRef(settings);
  const rafRef = useRef<number>(0);

  onActionRef.current = onAction;
  onAxisRef.current = onAxis;
  settingsRef.current = settings;

  useEffect(() => {
    let running = true;

    // A pad that was already plugged in when the app started never emits a
    // `connected` event, so fetch the current state once on mount.
    (async () => {
      try {
        const controllers: ControllerInfo[] = await invoke("get_controllers");
        setControllers(controllers);
        const active: ControllerInfo | null = await invoke("get_active_controller");
        setActiveController(active);
        setConnected(controllers.length > 0);
      } catch (err) {
        console.warn("Controller initial fetch error:", err);
      }
    })();

    const poll = async () => {
      if (!running) return;
      // While a game is running or launching, do not consume controller events for Veylix
      // navigation; the game owns the controller.
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
      try {
        const events: GamepadChannelEvent[] = await invoke("poll_gamepad_events");

        for (const event of events) {
          switch (event.type) {
            case "connected": {
              setConnected(true);
              setInputMethod("controller");
              const controllers: ControllerInfo[] = await invoke("get_controllers");
              setControllers(controllers);
              const active: ControllerInfo | null = await invoke("get_active_controller");
              setActiveController(active);
              break;
            }
            case "disconnected": {
              const controllers: ControllerInfo[] = await invoke("get_controllers");
              setControllers(controllers);
              if (controllers.length === 0) {
                setConnected(false);
                setActiveController(null);
              } else {
                const active: ControllerInfo | null = await invoke("get_active_controller");
                setActiveController(active);
              }
              break;
            }
            case "action": {
              const key = `${event.id}-${event.action}`;
              if (postGameBaseline.current) {
                // Establish baseline without firing actions.
                prevButtons.current.set(key, event.pressed);
                break;
              }
              const wasPressed = prevButtons.current.get(key) || false;

              if (event.pressed && !wasPressed) {
                onActionRef.current(event.action, true);
              } else if (!event.pressed && wasPressed) {
                onActionRef.current(event.action, false);
              }
              prevButtons.current.set(key, event.pressed);
              break;
            }
            case "axisChanged": {
              if (event.axis === "LeftStickX" || event.axis === "LeftStickY") {
                const dz = settingsRef.current.deadZone;
                const val = Math.abs(event.value) < dz ? 0 : event.value;
                onAxisRef.current(event.axis, val);
              }
              break;
            }
          }
        }
      } catch (err) {
        console.warn("Controller polling error:", err);
      }

      if (postGameBaseline.current) {
        // Baseline established after first post-game poll.
        postGameBaseline.current = false;
      }
      rafRef.current = requestAnimationFrame(poll);
    };

    rafRef.current = requestAnimationFrame(poll);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [setConnected, setControllers, setActiveController, setInputMethod]);
}
