import { useState, useEffect } from "react";
import { X, Gamepad2, RotateCcw } from "lucide-react";
import { useControllerStore } from "../store/controllerStore";
import { useFocusableElement } from "../hooks/useFocusableElement";
import { useT } from "../i18n";
import type { ControllerSettings as ControllerSettingsType } from "../types/controller";
import clsx from "clsx";

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

interface ControllerSettingsModalProps {
  onClose: () => void;
}

export function ControllerSettingsModal({ onClose }: ControllerSettingsModalProps) {
  const { controllers, activeController, settings, setSettings } = useControllerStore();
  const { t } = useT();
  const [localSettings, setLocalSettings] = useState<ControllerSettingsType>({ ...settings });
  const [saved, setSaved] = useState(false);

  const closeBtn = useFocusableElement({ id: "ctrl-settings-close", region: "modal", onClick: onClose });
  const saveBtn = useFocusableElement({
    id: "ctrl-settings-save",
    region: "modal",
    onClick: async () => {
      await invoke("save_controller_settings_cmd", { settings: localSettings });
      setSettings(localSettings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });
  const resetBtn = useFocusableElement({
    id: "ctrl-settings-reset",
    region: "modal",
    onClick: () => {
      const defaults: ControllerSettingsType = { deadZone: 0.2, repeatDelay: 300, repeatRate: 100, stickThreshold: 0.5 };
      setLocalSettings(defaults);
    },
  });

  useEffect(() => {
    invoke<ControllerSettingsType>("get_controller_settings_cmd")
      .then(setLocalSettings)
      .catch(() => {});
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Gamepad2 size={20} className="text-primary" />
            <h2 className="text-lg font-bold text-text-primary">Controller Settings</h2>
          </div>
          <button
            ref={closeBtn.ref as React.RefObject<HTMLButtonElement>}
            onClick={onClose}
            className={clsx("p-2 rounded-lg hover:bg-bg-hover transition-colors text-text-secondary", closeBtn.isFocused && "is-focused")}
            {...closeBtn.focusableProps}
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Connected Controllers */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">Connected Controllers</h3>
            {controllers.length === 0 ? (
              <p className="text-sm text-text-muted">No controllers connected. Connect a controller to get started.</p>
            ) : (
              <div className="space-y-2">
                {controllers.map((ctrl) => (
                  <div
                    key={ctrl.id}
                    className={clsx(
                      "flex items-center gap-3 p-3 rounded-xl border transition-colors",
                      ctrl.isActive
                        ? "border-primary bg-primary/5"
                        : "border-border bg-bg-main"
                    )}
                  >
                    <div className={clsx(
                      "w-2 h-2 rounded-full",
                      ctrl.isActive ? "bg-success" : "bg-text-muted"
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{ctrl.osName}</p>
                      <p className="text-xs text-text-muted">
                        {ctrl.vendorId != null && ctrl.productId != null
                          ? `VID: 0x${ctrl.vendorId.toString(16).toUpperCase().padStart(4, "0")} PID: 0x${ctrl.productId.toString(16).toUpperCase().padStart(4, "0")}`
                          : ctrl.name}
                      </p>
                    </div>
                    {ctrl.isActive && (
                      <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">Active</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-text-primary">Input Settings</h3>

            {/* Dead Zone */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm text-text-secondary">Dead Zone</label>
                <span className="text-xs text-text-muted tabular-nums">{localSettings.deadZone.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="0.5"
                step="0.05"
                value={localSettings.deadZone}
                onChange={(e) => setLocalSettings((s) => ({ ...s, deadZone: parseFloat(e.target.value) }))}
                className="w-full accent-primary"
              />
              <p className="text-xs text-text-muted mt-1">Stick movement below this threshold is ignored. Increase if stick drift occurs.</p>
            </div>

            {/* Stick Threshold */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm text-text-secondary">Stick Navigation Threshold</label>
                <span className="text-xs text-text-muted tabular-nums">{localSettings.stickThreshold.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.3"
                max="0.9"
                step="0.05"
                value={localSettings.stickThreshold}
                onChange={(e) => setLocalSettings((s) => ({ ...s, stickThreshold: parseFloat(e.target.value) }))}
                className="w-full accent-primary"
              />
              <p className="text-xs text-text-muted mt-1">How far the stick must be pushed to trigger a navigation direction.</p>
            </div>

            {/* Repeat Delay */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm text-text-secondary">Navigation Repeat Delay</label>
                <span className="text-xs text-text-muted tabular-nums">{localSettings.repeatDelay}ms</span>
              </div>
              <input
                type="range"
                min="100"
                max="800"
                step="50"
                value={localSettings.repeatDelay}
                onChange={(e) => setLocalSettings((s) => ({ ...s, repeatDelay: parseInt(e.target.value) }))}
                className="w-full accent-primary"
              />
              <p className="text-xs text-text-muted mt-1">Delay before holding a direction starts repeating.</p>
            </div>

            {/* Repeat Rate */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm text-text-secondary">Navigation Repeat Rate</label>
                <span className="text-xs text-text-muted tabular-nums">{localSettings.repeatRate}ms</span>
              </div>
              <input
                type="range"
                min="30"
                max="300"
                step="10"
                value={localSettings.repeatRate}
                onChange={(e) => setLocalSettings((s) => ({ ...s, repeatRate: parseInt(e.target.value) }))}
                className="w-full accent-primary"
              />
              <p className="text-xs text-text-muted mt-1">Interval between repeated navigation events when holding a direction.</p>
            </div>
          </div>

          {/* Button Mapping Display */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">Button Mapping</h3>
            {activeController ? (
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(activeController.buttonPrompts).map(([action, prompt]) => {
                  const actionLabels: Record<string, string> = {
                    confirm: "Confirm", cancel: "Cancel", menu: "Menu",
                    up: "Up", down: "Down", left: "Left", right: "Right",
                    secondaryAction: "Secondary", leftShoulder: "LB/L1", rightShoulder: "RB/R1",
                    leftTrigger: "LT/L2", rightTrigger: "RT/R2",
                    leftStickClick: "L3", rightStickClick: "R3",
                  };
                  const promptLabels: Record<string, string> = {
                    xboxA: "A", xboxB: "B", xboxX: "X", xboxY: "Y",
                    xboxMenu: "Menu", xboxView: "View",
                    playStationCross: "\u2715", playStationCircle: "\u25CB",
                    playStationSquare: "\u25A1", playStationTriangle: "\u25B3",
                    playStationOptions: "Options", playStationShare: "Share",
                    genericButton1: "1", genericButton2: "2", genericButton3: "3", genericButton4: "4",
                    dpadUp: "\u2191", dpadDown: "\u2193", dpadLeft: "\u2190", dpadRight: "\u2192",
                    leftStick: "LS", rightStick: "RS",
                    leftShoulder: "LB", rightShoulder: "RB",
                    leftTrigger: "LT", rightTrigger: "RT",
                  };
                  return (
                    <div key={action} className="flex items-center justify-between p-2 rounded-lg bg-bg-main border border-border-light">
                      <span className="text-text-secondary">{actionLabels[action] || action}</span>
                      <span className="font-mono font-bold text-text-primary text-xs bg-bg-card px-2 py-0.5 rounded border border-border">
                        {promptLabels[prompt] || prompt}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-text-muted">Connect a controller to see button mapping.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          <button
            ref={resetBtn.ref as React.RefObject<HTMLButtonElement>}
            onClick={() => {
              const defaults: ControllerSettingsType = { deadZone: 0.2, repeatDelay: 300, repeatRate: 100, stickThreshold: 0.5 };
              setLocalSettings(defaults);
            }}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-text-secondary hover:bg-bg-hover text-sm transition-colors",
              resetBtn.isFocused && "is-focused"
            )}
            {...resetBtn.focusableProps}
          >
            <RotateCcw size={14} />
            Restore Defaults
          </button>
          <div className="flex items-center gap-3">
            {saved && <span className="text-sm text-success">Saved!</span>}
            <button
              ref={saveBtn.ref as React.RefObject<HTMLButtonElement>}
              onClick={async () => {
                await invoke("save_controller_settings_cmd", { settings: localSettings });
                setSettings(localSettings);
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
              }}
              className={clsx(
                "px-5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium text-sm transition-colors",
                saveBtn.isFocused && "is-focused"
              )}
              {...saveBtn.focusableProps}
            >
              {t("common.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
