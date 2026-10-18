import { useState, useEffect } from "react";
import { X, FolderOpen, Plus, Trash2, Settings } from "lucide-react";
import { useStore } from "../store/useStore";
import { useFocusableElement } from "../hooks/useFocusableElement";
import { useT } from "../i18n";
import type { ScanFolder } from "../types";

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

async function openFolder(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const result = await open({
    directory: true,
    multiple: false,
    title: "Select Game Folder to Scan",
  });
  if (typeof result === "string") return result;
  return null;
}

interface ScanFoldersModalProps {
  onClose: () => void;
}

export function ScanFoldersModal({ onClose }: ScanFoldersModalProps) {
  const { scanFolders, setScanFolders } = useStore();
  const { t } = useT();
  const [isLoading, setIsLoading] = useState(true);

  const handleAddFolder = async () => {
    const folder = await openFolder();
    if (folder) {
      try {
        const id = await invoke<number>("add_scan_folder", {
          path: folder,
          label: null,
        });
        setScanFolders([...scanFolders, { id, path: folder, label: null }]);
      } catch (err) {
        console.error("Failed to add scan folder:", err);
      }
    }
  };

  const handleRemoveFolder = async (id: number) => {
    try {
      await invoke("remove_scan_folder", { id });
      setScanFolders(scanFolders.filter((f) => f.id !== id));
    } catch (err) {
      console.error("Failed to remove scan folder:", err);
    }
  };

  useEffect(() => {
    invoke<ScanFolder[]>("get_scan_folders")
      .then(setScanFolders)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [setScanFolders]);

  const closeBtn = useFocusableElement({ id: "scanfolders-close", region: "modal", onClick: onClose });
  const addBtn = useFocusableElement({ id: "scanfolders-add", region: "modal", onClick: handleAddFolder });
  const doneBtn = useFocusableElement({ id: "scanfolders-done", region: "modal", onClick: onClose });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Settings size={20} className="text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-text-primary">Scan Folders</h2>
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
            Add folders containing local games. GameHub will scan these directories
            when you click "Scan" to detect installed games.
          </p>

          {isLoading ? (
            <div className="text-center py-8 text-text-muted">Loading...</div>
          ) : (
            <div className="space-y-2 mb-4 max-h-64 overflow-y-auto overscroll-contain">
              {scanFolders.length === 0 ? (
                <div className="text-center py-8 text-text-muted">
                  <FolderOpen size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No scan folders configured.</p>
                  <p className="text-xs mt-1">Click "Add Folder" to get started.</p>
                </div>
              ) : (
                scanFolders.map((folder) => (
                  <div
                    key={folder.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-bg-main border border-border-light"
                  >
                    <FolderOpen size={16} className="text-text-muted shrink-0" />
                    <span className="flex-1 text-sm text-text-primary truncate">
                      {folder.path}
                    </span>
                    <button
                      onClick={() => handleRemoveFolder(folder.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          <button
            ref={addBtn.ref as React.RefObject<HTMLButtonElement>}
            onClick={handleAddFolder}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-border hover:border-primary hover:bg-primary/5 text-text-secondary hover:text-primary transition-colors ${addBtn.isFocused ? "is-focused" : ""}`}
            {...addBtn.focusableProps}
          >
            <Plus size={16} />
            Add Folder
          </button>
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
