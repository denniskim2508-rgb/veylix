import { useState, useEffect } from "react";
import { X, Upload, Trash2, GripVertical, Plus } from "lucide-react";
import { resolveArtworkUrl } from "../utils/artwork";
import { useFocusableElement } from "../hooks/useFocusableElement";

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

interface Screenshot {
  id: number;
  url: string;
  localPath: string | null;
  sortOrder: number;
}

interface ScreenshotManagerProps {
  gameId: number;
  screenshots: Screenshot[];
  onClose: () => void;
  onUpdate: (screenshots: Screenshot[]) => void;
}

export function ScreenshotManager({ gameId, screenshots, onClose, onUpdate }: ScreenshotManagerProps) {
  const [list, setList] = useState<Screenshot[]>([...screenshots].sort((a, b) => a.sortOrder - b.sortOrder));
  const [uploading, setUploading] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [resolvedUrls, setResolvedUrls] = useState<Record<number, string>>({});
  const closeBtn = useFocusableElement({ id: "screenshot-close", region: "modal", onClick: onClose });

  useEffect(() => {
    list.forEach((ss) => {
      resolveArtworkUrl(ss.url).then((url) => {
        if (url) setResolvedUrls((prev) => ({ ...prev, [ss.id]: url }));
      });
    });
  }, [list]);

  const handleUpload = async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const result = await open({
      multiple: true,
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
    });

    if (!result) return;
    const files = Array.isArray(result) ? result : [result];
    setUploading(true);

    try {
      const newScreenshots = [...list];
      for (const filePath of files) {
        const id = await invoke<number>("add_screenshot", {
          gameId,
          url: filePath,
          localPath: filePath,
        });
        newScreenshots.push({
          id,
          url: filePath,
          localPath: filePath,
          sortOrder: newScreenshots.length,
        });
      }
      setList(newScreenshots);
      onUpdate(newScreenshots);
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (screenshot: Screenshot) => {
    try {
      await invoke("delete_screenshot", { screenshotId: screenshot.id });
      const newList = list.filter((s) => s.id !== screenshot.id);
      setList(newList);
      onUpdate(newList);
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const newList = [...list];
    const [moved] = newList.splice(dragIdx, 1);
    newList.splice(idx, 0, moved);
    setList(newList);
    setDragIdx(idx);
  };

  const handleDragEnd = async () => {
    setDragIdx(null);
    const ids = list.map((s) => s.id);
    try {
      await invoke("reorder_screenshots", { gameId, screenshotIds: ids });
      onUpdate(list);
    } catch (err) {
      console.error("Reorder failed:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[80vh] bg-bg-card rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">Screenshots ({list.length})</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Plus size={14} />
              Add
            </button>
            <button
              ref={closeBtn.ref as React.RefObject<HTMLButtonElement>}
              onClick={onClose}
              className={`p-2 rounded-lg hover:bg-bg-hover transition-colors text-text-secondary ${closeBtn.isFocused ? "is-focused" : ""}`}
              {...closeBtn.focusableProps}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-6">
          {list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-text-muted">
              <p className="text-sm">No screenshots yet.</p>
              <button
                onClick={handleUpload}
                className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-bg-main border border-border hover:bg-bg-hover text-sm text-text-secondary transition-colors"
              >
                <Upload size={14} />
                Upload screenshots
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {list.map((ss, idx) => (
                <div
                  key={ss.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 p-2 rounded-xl border border-border bg-bg-main transition-colors ${
                    dragIdx === idx ? "opacity-50 border-primary" : "hover:bg-bg-hover"
                  }`}
                >
                  <div className="cursor-grab text-text-muted hover:text-text-secondary">
                    <GripVertical size={16} />
                  </div>
                  <div className="w-32 h-20 rounded-lg overflow-hidden bg-bg-hover shrink-0">
                    <img src={resolvedUrls[ss.id] || ss.url} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-text-muted truncate">
                      {ss.localPath ? ss.localPath.split(/[/\\]/).pop() : `Screenshot ${idx + 1}`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(ss)}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
