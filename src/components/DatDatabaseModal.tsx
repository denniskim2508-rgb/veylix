import { useState, useEffect } from "react";
import { X, Database, Trash2, Upload, FileSearch } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useFocusableElement } from "../hooks/useFocusableElement";
import { useT } from "../i18n";
import type { DatEntry } from "../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function DatDatabaseModal({ isOpen, onClose }: Props) {
  const { t } = useT();
  const [entries, setEntries] = useState<DatEntry[]>([]);
  const [entryCount, setEntryCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const closeBtn = useFocusableElement({ id: "dat-close", region: "modal", onClick: onClose });
  const doneBtn = useFocusableElement({ id: "dat-done", region: "modal", onClick: onClose });

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    Promise.all([
      invoke<DatEntry[]>("get_dat_entries"),
      invoke<number>("get_dat_entry_count"),
    ])
      .then(([e, c]) => {
        setEntries(e);
        setEntryCount(c);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [isOpen]);

  const handleSelectFile = async () => {
    const file = await open({
      multiple: false,
      filters: [
        { name: "DAT Files", extensions: ["dat", "txt"] },
      ],
    });
    if (file) {
      setSelectedFile(file as string);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    setIsImporting(true);
    try {
      const count = await invoke<number>("import_dat_file", { path: selectedFile });
      alert(`Imported ${count} entries from DAT file.`);
      setSelectedFile(null);
      // Refresh list
      const [e, c] = await Promise.all([
        invoke<DatEntry[]>("get_dat_entries"),
        invoke<number>("get_dat_entry_count"),
      ]);
      setEntries(e);
      setEntryCount(c);
    } catch (err) {
      console.error("Failed to import DAT file:", err);
      alert("Failed to import DAT file.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleClear = async () => {
    if (!confirm("Clear all DAT database entries? This cannot be undone.")) return;
    setIsClearing(true);
    try {
      await invoke("clear_dat_database");
      setEntries([]);
      setEntryCount(0);
    } catch (err) {
      console.error("Failed to clear DAT database:", err);
    } finally {
      setIsClearing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-bg-secondary rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Database size={18} className="text-primary" />
            <h2 className="text-lg font-semibold text-text-primary">ROM Database (DAT Files)</h2>
          </div>
          <button
            ref={closeBtn.ref as React.RefObject<HTMLButtonElement>}
            onClick={onClose}
            className={`p-1 rounded-lg hover:bg-bg-main text-text-muted hover:text-text-primary transition-colors ${closeBtn.isFocused ? "is-focused" : ""}`}
            {...closeBtn.focusableProps}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4">
          {isLoading ? (
            <div className="text-center py-8 text-text-muted">Loading...</div>
          ) : (
            <>
              {/* Import Section */}
              <div className="bg-bg-main rounded-lg p-4 border border-border">
                <h3 className="text-sm font-semibold text-text-primary mb-2">Import DAT File</h3>
                <p className="text-xs text-text-muted mb-3">
                  Import No-Intro or CLR-MamePro DAT files to get accurate ROM metadata.
                  ROMs will be matched by CRC32 hash.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleSelectFile}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-secondary border border-border text-sm text-text-secondary hover:text-primary hover:border-primary transition-colors"
                  >
                    <FileSearch size={14} />
                    {selectedFile ? selectedFile.split("\\").pop() : "Select DAT File"}
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={!selectedFile || isImporting}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <Upload size={14} />
                    {isImporting ? "Importing..." : "Import"}
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-muted">
                  {entryCount.toLocaleString()} entries in database
                </span>
                {entryCount > 0 && (
                  <button
                    onClick={handleClear}
                    disabled={isClearing}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={12} />
                    {isClearing ? "Clearing..." : "Clear All"}
                  </button>
                )}
              </div>

              {/* Entries List */}
              {entries.length > 0 && (
                <div className="bg-bg-main rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-text-muted text-left">
                        <th className="px-3 py-2 font-medium">Game Name</th>
                        <th className="px-3 py-2 font-medium">Platform</th>
                        <th className="px-3 py-2 font-medium">CRC32</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.slice(0, 100).map((entry) => (
                        <tr key={entry.id} className="border-b border-border-light hover:bg-bg-secondary/50">
                          <td className="px-3 py-1.5 text-text-primary truncate max-w-[200px]">
                            {entry.gameName}
                          </td>
                          <td className="px-3 py-1.5 text-text-secondary">{entry.platform}</td>
                          <td className="px-3 py-1.5 text-text-muted font-mono text-xs">{entry.crc32}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {entries.length > 100 && (
                    <div className="px-3 py-2 text-xs text-text-muted text-center border-t border-border">
                      Showing 100 of {entries.length.toLocaleString()} entries
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-border">
          <button
            ref={doneBtn.ref as React.RefObject<HTMLButtonElement>}
            onClick={onClose}
            className={`px-4 py-2 rounded-lg bg-bg-main border border-border text-sm text-text-secondary hover:text-primary hover:border-primary transition-colors ${doneBtn.isFocused ? "is-focused" : ""}`}
            {...doneBtn.focusableProps}
          >
            {t("common.done")}
          </button>
        </div>
      </div>
    </div>
  );
}
