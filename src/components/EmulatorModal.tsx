import { useState, useEffect } from "react";
import {
  X,
  Gamepad2,
  Plus,
  Trash2,
  Search,
  Download,
  Check,
  Monitor,
  Database,
} from "lucide-react";
import { useFocusableElement } from "../hooks/useFocusableElement";
import { useT } from "../i18n";
import type { EmulatorProfile, DetectedEmulator } from "../types";
import DatDatabaseModal from "./DatDatabaseModal";

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

async function openFile(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const result = await open({
    multiple: false,
    filters: [{ name: "Executables", extensions: ["exe", "app"] }],
    title: "Select Emulator Executable",
  });
  if (typeof result === "string") return result;
  return null;
}

interface EmulatorModalProps {
  onClose: () => void;
}

export function EmulatorModal({ onClose }: EmulatorModalProps) {
  const { t } = useT();
  const [emulators, setEmulators] = useState<EmulatorProfile[]>([]);
  const [detectedEmulators, setDetectedEmulators] = useState<DetectedEmulator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetecting, setIsDetecting] = useState(false);
  const [showDetected, setShowDetected] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDatModal, setShowDatModal] = useState(false);
  const closeBtn = useFocusableElement({ id: "emulator-close", region: "modal", onClick: onClose });
  const doneBtn = useFocusableElement({ id: "emulator-done", region: "modal", onClick: onClose });
  const [newEmulator, setNewEmulator] = useState({
    name: "",
    executablePath: "",
    platform: "",
    commandTemplate: '"{{emulator}}" {{default_args}} "{{rom}}"',
    supportedExtensions: "",
    defaultArgs: "",
    corePath: "",
  });

  useEffect(() => {
    invoke<EmulatorProfile[]>("get_emulators")
      .then(setEmulators)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const handleDetect = async () => {
    setIsDetecting(true);
    try {
      const detected = await invoke<DetectedEmulator[]>("detect_emulators");
      setDetectedEmulators(detected);
      setShowDetected(true);
    } catch (err) {
      console.error("Failed to detect emulators:", err);
    } finally {
      setIsDetecting(false);
    }
  };

  const [selectedCore, setSelectedCore] = useState<string>("");

  const handleAddDetected = async (detected: DetectedEmulator) => {
    try {
      const corePath = detected.name === "RetroArch" && selectedCore
        ? `cores/${selectedCore}`
        : null;
      const id = await invoke<number>("add_emulator", {
        name: detected.name,
        executablePath: detected.executablePath,
        platform: detected.platform,
        commandTemplate: detected.commandTemplate,
        supportedExtensions: detected.supportedExtensions,
        defaultArgs: detected.defaultArgs,
        isInstalled: true,
        icon: null,
        corePath,
      });
      setEmulators([
        ...emulators,
        {
          id,
          name: detected.name,
          executablePath: detected.executablePath,
          platform: detected.platform,
          commandTemplate: detected.commandTemplate,
          supportedExtensions: detected.supportedExtensions,
          defaultArgs: detected.defaultArgs,
          isInstalled: true,
          icon: null,
          corePath,
        },
      ]);
      setDetectedEmulators(detectedEmulators.filter((d) => d.name !== detected.name));
      setSelectedCore("");
    } catch (err) {
      console.error("Failed to add emulator:", err);
    }
  };

  const handleAddCustom = async () => {
    if (!newEmulator.name || !newEmulator.executablePath) return;
    try {
      const corePath = newEmulator.corePath || null;
      const id = await invoke<number>("add_emulator", {
        name: newEmulator.name,
        executablePath: newEmulator.executablePath,
        platform: newEmulator.platform,
        commandTemplate: newEmulator.commandTemplate,
        supportedExtensions: newEmulator.supportedExtensions,
        defaultArgs: newEmulator.defaultArgs,
        isInstalled: false,
        icon: null,
        corePath,
      });
      setEmulators([
        ...emulators,
        {
          id,
          ...newEmulator,
          isInstalled: false,
          icon: null,
          corePath,
        },
      ]);
      setShowAddForm(false);
      setNewEmulator({
        name: "",
        executablePath: "",
        platform: "",
        commandTemplate: '"{{emulator}}" {{default_args}} "{{rom}}"',
        supportedExtensions: "",
        defaultArgs: "",
        corePath: "",
      });
    } catch (err) {
      console.error("Failed to add emulator:", err);
    }
  };

  const handleBrowseExe = async () => {
    const path = await openFile();
    if (path) {
      setNewEmulator({ ...newEmulator, executablePath: path });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await invoke("delete_emulator", { id });
      setEmulators(emulators.filter((e) => e.id !== id));
    } catch (err) {
      console.error("Failed to delete emulator:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-bg-card rounded-2xl border border-border shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Gamepad2 size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Emulators</h2>
              <p className="text-xs text-text-muted">
                {emulators.length} emulator{emulators.length !== 1 ? "s" : ""} configured
              </p>
            </div>
          </div>
          <button
            ref={closeBtn.ref as React.RefObject<HTMLButtonElement>}
            onClick={onClose}
            className={`p-2 rounded-lg hover:bg-bg-hover text-text-muted transition-colors ${closeBtn.isFocused ? "is-focused" : ""}`}
            {...closeBtn.focusableProps}
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto overscroll-contain flex-1">
          <div className="flex gap-2 mb-4">
            <button
              onClick={handleDetect}
              disabled={isDetecting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium text-sm transition-colors disabled:opacity-50"
            >
              <Search size={16} />
              {isDetecting ? "Detecting..." : "Auto-Detect"}
            </button>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:border-primary hover:bg-primary/5 text-text-secondary hover:text-primary font-medium text-sm transition-colors"
            >
              <Plus size={16} />
              Add Manually
            </button>
            <button
              onClick={() => setShowDatModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:border-primary hover:bg-primary/5 text-text-secondary hover:text-primary font-medium text-sm transition-colors"
            >
              <Database size={16} />
              ROM Database
            </button>
          </div>

          {showDetected && detectedEmulators.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-text-primary">
                  Detected Emulators ({detectedEmulators.length})
                </h3>
                <button
                  onClick={() => setShowDetected(false)}
                  className="text-xs text-text-muted hover:text-text-secondary"
                >
                  Hide
                </button>
              </div>
              <div className="space-y-2">
                {detectedEmulators.map((detected) => {
                  const alreadyAdded = emulators.some((e) => e.name === detected.name);
                  return (
                    <div
                      key={detected.name}
                      className="flex items-center gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/20"
                    >
                      <Monitor size={16} className="text-green-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary">{detected.name}</p>
                        <p className="text-xs text-text-muted truncate">
                          {detected.platform} &middot; {detected.executablePath}
                        </p>
                      </div>
                      {alreadyAdded ? (
                        <span className="flex items-center gap-1 text-xs text-green-500">
                          <Check size={14} />
                          Added
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          {detected.name === "RetroArch" && detected.availableCores.length > 0 && (
                            <select
                              value={selectedCore}
                              onChange={(e) => setSelectedCore(e.target.value)}
                              className="px-2 py-1 rounded bg-bg-card border border-border text-xs text-text-primary max-w-[180px] truncate focus:outline-none focus:border-primary"
                              title="Select RetroArch core"
                            >
                              <option value="">Select core...</option>
                              {detected.availableCores.map((core) => (
                                <option key={core} value={core}>{core}</option>
                              ))}
                            </select>
                          )}
                          <button
                            onClick={() => handleAddDetected(detected)}
                            disabled={detected.name === "RetroArch" && detected.availableCores.length > 0 && !selectedCore}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-500 text-xs font-medium transition-colors disabled:opacity-50"
                          >
                            <Download size={12} />
                            Add
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {showAddForm && (
            <div className="mb-6 p-4 rounded-lg bg-bg-main border border-border">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Add Emulator Manually</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Name *</label>
                  <input
                    type="text"
                    value={newEmulator.name}
                    onChange={(e) => setNewEmulator({ ...newEmulator, name: e.target.value })}
                    placeholder="e.g., RetroArch"
                    className="w-full px-3 py-2 rounded-lg bg-bg-card border border-border text-sm text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Executable Path *</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newEmulator.executablePath}
                      onChange={(e) =>
                        setNewEmulator({ ...newEmulator, executablePath: e.target.value })
                      }
                      placeholder="C:\Emulators\retroarch.exe"
                      className="flex-1 px-3 py-2 rounded-lg bg-bg-card border border-border text-sm text-text-primary focus:outline-none focus:border-primary"
                    />
                    <button
                      onClick={handleBrowseExe}
                      className="px-3 py-2 rounded-lg bg-bg-card border border-border text-sm text-text-secondary hover:text-primary hover:border-primary transition-colors"
                    >
                      Browse
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Platform</label>
                  <input
                    type="text"
                    value={newEmulator.platform}
                    onChange={(e) => setNewEmulator({ ...newEmulator, platform: e.target.value })}
                    placeholder="e.g., Multi-System"
                    className="w-full px-3 py-2 rounded-lg bg-bg-card border border-border text-sm text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Supported Extensions</label>
                  <input
                    type="text"
                    value={newEmulator.supportedExtensions}
                    onChange={(e) =>
                      setNewEmulator({ ...newEmulator, supportedExtensions: e.target.value })
                    }
                    placeholder=".nes,.sfc,.gba (comma separated)"
                    className="w-full px-3 py-2 rounded-lg bg-bg-card border border-border text-sm text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Default Arguments</label>
                  <input
                    type="text"
                    value={newEmulator.defaultArgs}
                    onChange={(e) => setNewEmulator({ ...newEmulator, defaultArgs: e.target.value })}
                    placeholder="e.g., --fullscreen"
                    className="w-full px-3 py-2 rounded-lg bg-bg-card border border-border text-sm text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Launch Command Template</label>
                  <input
                    type="text"
                    value={newEmulator.commandTemplate}
                    onChange={(e) =>
                      setNewEmulator({ ...newEmulator, commandTemplate: e.target.value })
                    }
                    placeholder='{{emulator}} {{default_args}} "{{rom}}"'
                    className="w-full px-3 py-2 rounded-lg bg-bg-card border border-border text-sm text-text-primary focus:outline-none focus:border-primary font-mono"
                  />
                  <p className="text-xs text-text-muted mt-1">
                    Variables: {"{{emulator}}"} {"{{rom}}"} {"{{default_args}}"} {"{{core}}"}
                  </p>
                </div>
                {newEmulator.name.toLowerCase().includes("retroarch") && (
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Core Path (for RetroArch)</label>
                    <input
                      type="text"
                      value={newEmulator.corePath}
                      onChange={(e) => setNewEmulator({ ...newEmulator, corePath: e.target.value })}
                      placeholder="cores/mGBA_libretro.dll"
                      className="w-full px-3 py-2 rounded-lg bg-bg-card border border-border text-sm text-text-primary focus:outline-none focus:border-primary font-mono"
                    />
                    <p className="text-xs text-text-muted mt-1">
                      Relative to RetroArch directory. Used with {"{{core}}"} variable.
                    </p>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleAddCustom}
                    disabled={!newEmulator.name || !newEmulator.executablePath}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <Plus size={14} />
                    Add Emulator
                  </button>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 rounded-lg border border-border text-sm text-text-secondary hover:text-text-primary transition-colors"
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-8 text-text-muted">Loading...</div>
          ) : emulators.length === 0 ? (
            <div className="text-center py-8 text-text-muted">
              <Gamepad2 size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No emulators configured.</p>
              <p className="text-xs mt-1">Click "Auto-Detect" or "Add Manually" to get started.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {emulators.map((emulator) => (
                <div
                  key={emulator.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-bg-main border border-border-light"
                >
                  <Gamepad2 size={16} className="text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">
                        {emulator.name}
                      </span>
                      {emulator.isInstalled && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-500/10 text-green-500 font-medium">
                          Installed
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted truncate">
                      {emulator.platform} &middot; {emulator.executablePath}
                    </p>
                    {emulator.supportedExtensions && (
                      <p className="text-xs text-text-muted mt-0.5 font-mono">
                        {emulator.supportedExtensions}
                      </p>
                    )}
                    {emulator.corePath && (
                      <p className="text-xs text-primary/70 mt-0.5 font-mono">
                        Core: {emulator.corePath}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(emulator.id)}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 pb-6 shrink-0">
          <button
            ref={doneBtn.ref as React.RefObject<HTMLButtonElement>}
            onClick={onClose}
            className={`w-full px-4 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium transition-colors ${doneBtn.isFocused ? "is-focused" : ""}`}
            {...doneBtn.focusableProps}
          >
            {t("common.done")}
          </button>
        </div>
      </div>
      <DatDatabaseModal isOpen={showDatModal} onClose={() => setShowDatModal(false)} />
    </div>
  );
}
