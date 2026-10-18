import { useState, useEffect } from "react";
import { X, Disc, Plus, Trash2, FolderOpen, RefreshCw, Ban } from "lucide-react";
import { useFocusableElement } from "../hooks/useFocusableElement";
import { useT } from "../i18n";
import type { RomScanFolder, EmulatorProfile, ScanExclusion } from "../types";

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

async function openFolder(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const result = await open({
    directory: true,
    multiple: false,
    title: "Select ROM Folder to Scan",
  });
  if (typeof result === "string") return result;
  return null;
}

interface RomScanFoldersModalProps {
  onClose: () => void;
}

export function RomScanFoldersModal({ onClose }: RomScanFoldersModalProps) {
  const { t } = useT();
  const [folders, setFolders] = useState<RomScanFolder[]>([]);
  const [emulators, setEmulators] = useState<EmulatorProfile[]>([]);
  const [exclusions, setExclusions] = useState<ScanExclusion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedEmulatorId, setSelectedEmulatorId] = useState<number | null>(null);
  const [newExclusionPattern, setNewExclusionPattern] = useState("");
  const [newExclusionType, setNewExclusionType] = useState<string>("contains");
  const closeBtn = useFocusableElement({ id: "romscan-close", region: "modal", onClick: onClose });
  const doneBtn = useFocusableElement({ id: "romscan-done", region: "modal", onClick: onClose });

  useEffect(() => {
    Promise.all([
      invoke<RomScanFolder[]>("get_rom_scan_folders"),
      invoke<EmulatorProfile[]>("get_emulators"),
      invoke<ScanExclusion[]>("get_scan_exclusions"),
    ])
      .then(([f, e, ex]) => {
        setFolders(f);
        setEmulators(e);
        setExclusions(ex);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const handleAddFolder = async () => {
    const folder = await openFolder();
    if (folder) {
      try {
        const id = await invoke<number>("add_rom_scan_folder", {
          path: folder,
          label: null,
          emulatorId: selectedEmulatorId,
        });
        setFolders([...folders, { id, path: folder, label: null, emulatorId: selectedEmulatorId }]);
        setSelectedEmulatorId(null);
      } catch (err) {
        console.error("Failed to add ROM scan folder:", err);
      }
    }
  };

  const handleRemoveFolder = async (id: number) => {
    try {
      await invoke("remove_rom_scan_folder", { id });
      setFolders(folders.filter((f) => f.id !== id));
    } catch (err) {
      console.error("Failed to remove ROM scan folder:", err);
    }
  };

  const handleScan = async () => {
    setIsScanning(true);
    try {
      const games = await invoke<unknown[]>("scan_rom_folders");
      alert(`Scan complete! Found ${games.length} ROM(s).`);
    } catch (err) {
      console.error("Failed to scan ROM folders:", err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleAddExclusion = async () => {
    if (!newExclusionPattern.trim()) return;
    try {
      const id = await invoke<number>("add_scan_exclusion", {
        pattern: newExclusionPattern.trim(),
        exclusionType: newExclusionType,
        isRegex: false,
      });
      setExclusions([
        ...exclusions,
        { id, pattern: newExclusionPattern.trim(), exclusionType: newExclusionType, isRegex: false },
      ]);
      setNewExclusionPattern("");
    } catch (err) {
      console.error("Failed to add exclusion:", err);
    }
  };

  const handleRemoveExclusion = async (id: number) => {
    try {
      await invoke("remove_scan_exclusion", { id });
      setExclusions(exclusions.filter((e) => e.id !== id));
    } catch (err) {
      console.error("Failed to remove exclusion:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Disc size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">ROM Folders</h2>
              <p className="text-xs text-text-muted">
                {folders.length} folder{folders.length !== 1 ? "s" : ""} configured
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

        <div className="p-6">
          <p className="text-sm text-text-secondary mb-4">
            Add folders containing ROM files. GameHub will scan these directories to detect ROMs
            and match them with configured emulators.
          </p>

          {emulators.length > 0 && (
            <div className="mb-4">
              <label className="block text-xs text-text-muted mb-1">
                Optional: Assign emulator to new folder
              </label>
              <select
                value={selectedEmulatorId ?? ""}
                onChange={(e) =>
                  setSelectedEmulatorId(e.target.value ? Number(e.target.value) : null)
                }
                className="w-full px-3 py-2 rounded-lg bg-bg-main border border-border text-sm text-text-primary focus:outline-none focus:border-primary"
              >
                <option value="">No specific emulator</option>
                {emulators.map((emu) => (
                  <option key={emu.id} value={emu.id}>
                    {emu.name} ({emu.platform})
                  </option>
                ))}
              </select>
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-8 text-text-muted">Loading...</div>
          ) : (
            <div className="space-y-2 mb-4 max-h-64 overflow-y-auto overscroll-contain">
              {folders.length === 0 ? (
                <div className="text-center py-8 text-text-muted">
                  <FolderOpen size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No ROM folders configured.</p>
                  <p className="text-xs mt-1">Click "Add Folder" to get started.</p>
                </div>
              ) : (
                folders.map((folder) => {
                  const emu = emulators.find((e) => e.id === folder.emulatorId);
                  return (
                    <div
                      key={folder.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-bg-main border border-border-light"
                    >
                      <FolderOpen size={16} className="text-text-muted shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-text-primary truncate block">
                          {folder.path}
                        </span>
                        {emu && (
                          <span className="text-xs text-primary">
                            {emu.name}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveFolder(folder.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleAddFolder}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-border hover:border-primary hover:bg-primary/5 text-text-secondary hover:text-primary transition-colors"
            >
              <Plus size={16} />
              Add Folder
            </button>
            <button
              onClick={handleScan}
              disabled={isScanning || folders.length === 0}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium text-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={isScanning ? "animate-spin" : ""} />
              {isScanning ? "Scanning..." : "Scan Now"}
            </button>
          </div>

          {/* Exclusions Section */}
          <div className="mt-6 pt-4 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              <Ban size={16} className="text-text-muted" />
              <h3 className="text-sm font-semibold text-text-primary">Scan Exclusions</h3>
            </div>
            <p className="text-xs text-text-muted mb-3">
              Exclude files or folders from ROM scanning.
            </p>

            <div className="flex gap-2 mb-3">
              <select
                value={newExclusionType}
                onChange={(e) => setNewExclusionType(e.target.value)}
                className="px-2 py-2 rounded-lg bg-bg-main border border-border text-xs text-text-primary focus:outline-none focus:border-primary"
              >
                <option value="contains">Contains</option>
                <option value="extension">Extension</option>
                <option value="path">Path</option>
              </select>
              <input
                type="text"
                value={newExclusionPattern}
                onChange={(e) => setNewExclusionPattern(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddExclusion()}
                placeholder={
                  newExclusionType === "extension" ? ".chd" :
                  newExclusionType === "path" ? "C:\\path\\to\\exclude" :
                  "pattern to exclude"
                }
                className="flex-1 px-3 py-2 rounded-lg bg-bg-main border border-border text-sm text-text-primary focus:outline-none focus:border-primary"
              />
              <button
                onClick={handleAddExclusion}
                disabled={!newExclusionPattern.trim()}
                className="px-3 py-2 rounded-lg bg-bg-main border border-border text-sm text-text-secondary hover:text-primary hover:border-primary transition-colors disabled:opacity-50"
              >
                <Plus size={14} />
              </button>
            </div>

            {exclusions.length > 0 && (
              <div className="space-y-1 max-h-32 overflow-y-auto overscroll-contain">
                {exclusions.map((exc) => (
                  <div
                    key={exc.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded bg-bg-main border border-border-light text-xs"
                  >
                    <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 font-medium shrink-0">
                      {exc.exclusionType}
                    </span>
                    <span className="text-text-primary truncate flex-1 font-mono">{exc.pattern}</span>
                    <button
                      onClick={() => handleRemoveExclusion(exc.id)}
                      className="p-0.5 rounded hover:bg-red-500/10 text-text-muted hover:text-red-500 transition-colors shrink-0"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 pb-6">
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
    </div>
  );
}
