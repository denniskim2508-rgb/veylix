import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { X, Gamepad2, AlertCircle } from "lucide-react";
import { useFocusableElement } from "../hooks/useFocusableElement";
import type { GamepadChannelEvent, GamehubAction } from "../types/controller";

interface ControllerDiagnosticsProps {
  onClose: () => void;
}

interface DebugInfo {
  controllerCount: number;
  activeController: {
    id: number;
    name: string;
    osName: string;
    controllerType: string;
    vendorId: number | null;
    productId: number | null;
    isActive: boolean;
  } | null;
  allControllers: Array<{
    id: number;
    name: string;
    osName: string;
    controllerType: string;
    vendorId: number | null;
    productId: number | null;
    isActive: boolean;
  }>;
}

interface LiveInput {
  buttons: Record<string, boolean>;
  axes: Record<string, number>;
}

export function ControllerDiagnostics({ onClose }: ControllerDiagnosticsProps) {
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [liveInput, setLiveInput] = useState<LiveInput>({ buttons: {}, axes: {} });
  const [events, setEvents] = useState<string[]>([]);
  const [backend] = useState<string>("XInput (gilrs)");
  const prevButtons = useRef<Map<string, boolean>>(new Map());
  const rafRef = useRef<number>(0);
  const eventLogRef = useRef<HTMLDivElement>(null);

  const closeBtn = useFocusableElement({ id: "diag-close", region: "modal", onClick: onClose });

  const addEvent = useCallback((msg: string) => {
    setEvents((prev) => {
      const next = [`${new Date().toLocaleTimeString()} ${msg}`, ...prev];
      return next.slice(0, 50);
    });
  }, []);

  useEffect(() => {
    let running = true;

    const poll = async () => {
      if (!running) return;
      try {
        const [info, evts] = await Promise.all([
          invoke<DebugInfo>("get_controller_debug_info"),
          invoke<GamepadChannelEvent[]>("poll_gamepad_events"),
        ]);
        setDebugInfo(info);

        for (const event of evts) {
          switch (event.type) {
            case "connected":
              addEvent(`CONNECTED: "${event.name}" (${event.controllerType}) VID=${event.vendorId} PID=${event.productId}`);
              break;
            case "disconnected":
              addEvent(`DISCONNECTED: controller id=${event.id}`);
              break;
            case "action": {
              const key = `${event.id}-${event.action}`;
              const wasPressed = prevButtons.current.get(key) || false;
              if (event.pressed !== wasPressed) {
                addEvent(`${event.action}: ${event.pressed ? "PRESSED" : "RELEASED"}`);
              }
              prevButtons.current.set(key, event.pressed);
              setLiveInput((prev) => ({
                ...prev,
                buttons: { ...prev.buttons, [event.action]: event.pressed },
              }));
              break;
            }
            case "axisChanged":
              setLiveInput((prev) => ({
                ...prev,
                axes: { ...prev.axes, [event.axis]: event.value },
              }));
              break;
          }
        }
      } catch (err) {
        console.warn("Diagnostics poll error:", err);
      }
      rafRef.current = requestAnimationFrame(poll);
    };

    rafRef.current = requestAnimationFrame(poll);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [addEvent]);

  const fmt = (v: number) => (v >= 0 ? "+" : "") + v.toFixed(3);
  const buttonState = (action: string) => (liveInput.buttons[action] ? "PRESSED" : "RELEASED");
  const buttonColor = (action: string) => (liveInput.buttons[action] ? "text-green-400" : "text-zinc-500");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[90vh] bg-zinc-900 rounded-2xl border border-zinc-700 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700">
          <div className="flex items-center gap-3">
            <Gamepad2 className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">Controller Diagnostics</h2>
          </div>
          <button
            {...closeBtn.focusableProps}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-6 space-y-6">
          {/* Backend Info */}
          <section>
            <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">Backend</h3>
            <div className="bg-zinc-800 rounded-lg px-4 py-3">
              <span className="text-white font-mono">{backend}</span>
              <span className="text-zinc-500 ml-3">
                | Loads xinput1_4.dll directly — supports up to 4 Xbox controllers
              </span>
            </div>
          </section>

          {/* Connected Controllers */}
          <section>
            <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">
              Connected Controllers ({debugInfo?.controllerCount ?? 0})
            </h3>
            {(!debugInfo || debugInfo.controllerCount === 0) ? (
              <div className="bg-zinc-800 rounded-lg px-4 py-6 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-400" />
                <span className="text-zinc-300">No controllers detected. Connect a controller and check the terminal for [Controller] log output.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {debugInfo.allControllers.map((c) => (
                  <div key={c.id} className="bg-zinc-800 rounded-lg px-4 py-3 border border-zinc-700">
                    <div className="flex items-center gap-3 mb-2">
                      <Gamepad2 className="w-4 h-4 text-blue-400" />
                      <span className="text-white font-medium">{c.name}</span>
                      {c.isActive && (
                        <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">ACTIVE</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-zinc-500">OS Name:</span> <span className="text-zinc-300 font-mono">{c.osName}</span></div>
                      <div><span className="text-zinc-500">Type:</span> <span className="text-zinc-300 font-mono">{c.controllerType}</span></div>
                      <div><span className="text-zinc-500">VID:</span> <span className="text-zinc-300 font-mono">{c.vendorId != null ? `0x${c.vendorId.toString(16).toUpperCase().padStart(4, "0")}` : "N/A"}</span></div>
                      <div><span className="text-zinc-500">PID:</span> <span className="text-zinc-300 font-mono">{c.productId != null ? `0x${c.productId.toString(16).toUpperCase().padStart(4, "0")}` : "N/A"}</span></div>
                      <div><span className="text-zinc-500">Connected:</span> <span className="text-green-400 font-mono">YES</span></div>
                      <div><span className="text-zinc-500">ID:</span> <span className="text-zinc-300 font-mono">{c.id}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Live Input */}
          <section>
            <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">Live Input</h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Buttons */}
              <div className="bg-zinc-800 rounded-lg p-4">
                <h4 className="text-xs font-medium text-zinc-500 uppercase mb-3">Buttons</h4>
                <div className="space-y-1.5 font-mono text-sm">
                  {(["up", "down", "left", "right", "confirm", "cancel", "menu", "secondaryAction",
                    "leftShoulder", "rightShoulder", "leftTrigger", "rightTrigger",
                    "leftStickClick", "rightStickClick"] as GamehubAction[]).map((action) => (
                    <div key={action} className="flex justify-between">
                      <span className="text-zinc-400">{action}</span>
                      <span className={buttonColor(action)}>{buttonState(action)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Axes */}
              <div className="bg-zinc-800 rounded-lg p-4">
                <h4 className="text-xs font-medium text-zinc-500 uppercase mb-3">Axes</h4>
                <div className="space-y-1.5 font-mono text-sm">
                  {(["LeftStickX", "LeftStickY", "RightStickX", "RightStickY",
                    "LeftZ", "RightZ"] as const).map((axis) => (
                    <div key={axis} className="flex justify-between">
                      <span className="text-zinc-400">{axis}</span>
                      <span className="text-zinc-300">{fmt(liveInput.axes[axis] ?? 0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Event Log */}
          <section>
            <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">Event Log</h3>
            <div
              ref={eventLogRef}
              className="bg-zinc-800 rounded-lg p-4 h-48 overflow-y-auto overscroll-contain font-mono text-xs"
            >
              {events.length === 0 ? (
                <div className="text-zinc-500">Waiting for controller input...</div>
              ) : (
                events.map((e, i) => (
                  <div key={i} className="text-zinc-300">{e}</div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
