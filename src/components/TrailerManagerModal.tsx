import { useState, useEffect } from "react";
import { X, Video, FolderOpen, Trash2, Loader2, FileWarning, CheckCircle2 } from "lucide-react";
import type { Game } from "../types";
import { useFocusableElement } from "../hooks/useFocusableElement";
import { useT } from "../i18n";
import { isConsoleActive } from "../store/consoleStore";
import { uiAudio } from "../utils/uiAudio";
import {
  probeTrailer,
  resolveTrailerPlaybackUrl,
  fileNameFromPath,
  formatBytes,
  invoke,
} from "../utils/trailer";

// This modal is shared by Console Mode and Desktop Mode; UI sounds only play
// while Console Mode is active.
function playUiSound(name: "confirm" | "error" | "close"): void {
  if (isConsoleActive()) void uiAudio.playUiSound(name);
}

interface TrailerManagerModalProps {
  game: Game;
  onClose: () => void;
  onGameUpdated: (game: Game) => void;
}

export function TrailerManagerModal({ game, onClose, onGameUpdated }: TrailerManagerModalProps) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [probe, setProbe] = useState<{ valid: boolean; exists: boolean; sizeBytes: number; error: string | null } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const closeBtn = useFocusableElement({ id: "trailer-close", region: "modal", onClick: onClose });

  const assignedPath = game.trailerPath;

  useEffect(() => {
    if (!assignedPath) {
      setProbe(null);
      setPreview(null);
      return;
    }
    setPreview(resolveTrailerPlaybackUrl(assignedPath));
    probeTrailer(assignedPath).then((p) => {
      setProbe({ valid: p.valid, exists: p.exists, sizeBytes: p.sizeBytes, error: p.error });
    });
  }, [assignedPath]);

  const handleBrowse = async () => {
    if (busy) return;
    const { open } = await import("@tauri-apps/plugin-dialog");
    const result = await open({
      multiple: false,
      title: "Select Trailer Video",
      filters: [
        { name: "Video", extensions: ["mp4", "webm", "mkv", "mov", "avi", "m4v", "ogv"] },
        { name: "All files", extensions: ["*"] },
      ],
    });
    const path = typeof result === "string" ? result : Array.isArray(result) ? result[0] : null;
    if (!path) return;

    setBusy(true);
    try {
      const p = await probeTrailer(path);
      if (!p.valid) {
        setProbe({ valid: false, exists: p.exists, sizeBytes: 0, error: p.error ?? "Unsupported file." });
        playUiSound("error");
        return;
      }
      await invoke("set_game_trailer", { gameId: game.id, path, source: "manual" });
      const all = await invoke<Game[]>("get_games");
      const fresh = all.find((g) => g.id === game.id);
      if (fresh) {
        onGameUpdated(fresh);
        setProbe({ valid: true, exists: true, sizeBytes: p.sizeBytes, error: null });
        setPreview(resolveTrailerPlaybackUrl(path));
        playUiSound("confirm");
      }
    } catch (err) {
      console.error("Trailer assignment failed:", err);
      playUiSound("error");
    } finally {
      setBusy(false);
    }
  };

  const handleClear = async () => {
    if (busy || !assignedPath) return;
    setBusy(true);
    try {
      await invoke("clear_game_trailer", { gameId: game.id });
      const all = await invoke<Game[]>("get_games");
      const fresh = all.find((g) => g.id === game.id);
      if (fresh) onGameUpdated(fresh);
      setProbe(null);
      setPreview(null);
      playUiSound("confirm");
    } catch (err) {
      console.error("Clear trailer failed:", err);
      playUiSound("error");
    } finally {
      setBusy(false);
    }
  };

  const missing = assignedPath && probe !== null && !probe.exists;

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className="w-[680px] max-w-[94vw] max-h-[90vh] overflow-y-auto rounded-2xl bg-[#0d1421] border border-white/15 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Video size={18} className="text-white/70" />
            <h2 className="text-base font-semibold text-white">Manage Trailer</h2>
            <span className="hidden sm:inline text-xs text-white/40 truncate max-w-[220px]">{game.title}</span>
          </div>
          <button
            ref={closeBtn.ref as React.RefObject<HTMLButtonElement>}
            onClick={() => { playUiSound("close"); onClose(); }}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            aria-label={t("common.close")}
          >
            <X size={17} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Preview */}
          <div className="rounded-xl overflow-hidden bg-black border border-white/10 aspect-video flex items-center justify-center">
            {preview ? (
              <video
                key={preview}
                src={preview}
                controls
                autoPlay={!!probe?.exists}
                muted
                playsInline
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-center text-white/40 text-sm py-16">
                <Video size={40} className="mx-auto mb-3 opacity-50" />
                No trailer assigned yet.<br />
                Pick a video file to use it as this game's cinematic background.
              </div>
            )}
          </div>

          {/* Status / current assignment */}
          <div className="space-y-2 text-sm">
            {assignedPath ? (
              <>
                <div className="flex items-center gap-2 text-white/80">
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wide bg-white/10 text-white/70">
                    {game.trailerSource === "auto" ? "Automatic" : "Manual"}
                  </span>
                  <span className="truncate text-xs text-white/60" title={assignedPath}>{fileNameFromPath(assignedPath)}</span>
                  {probe?.valid && probe.exists && (
                    <span className="ml-auto flex items-center gap-1 text-xs text-emerald-400">
                      <CheckCircle2 size={14} /> Valid · {formatBytes(probe.sizeBytes)}
                    </span>
                  )}
                </div>
                {missing && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-amber-200 text-xs">
                    <FileWarning size={16} className="mt-0.5 shrink-0" />
                    <span>{probe?.error ?? "This video file is not reachable right now. It may have moved or be on a disconnected drive."}</span>
                  </div>
                )}
                {probe && !probe.valid && probe.exists === false && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-red-200 text-xs">
                    <FileWarning size={16} className="mt-0.5 shrink-0" />
                    <span>{probe?.error ?? "This file is no longer where it was. Reassign a new trailer or clear it."}</span>
                  </div>
                )}
              </>
            ) : (
              <p className="text-white/45 text-xs">
                No trailer assigned. The console will fall back to this game's background artwork.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
            <button
              onClick={handleClear}
              disabled={!assignedPath || busy}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white/5 hover:bg-red-500/20 text-red-300 hover:text-red-200 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              {busy && assignedPath ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              Clear Trailer
            </button>
            <button
              onClick={handleBrowse}
              disabled={busy}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-white text-black hover:bg-white/85 disabled:opacity-50 transition-colors"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <FolderOpen size={15} />}
              Browse for Trailer...
            </button>
          </div>

          <p className="text-[11px] text-white/35 leading-relaxed">
            Supported formats: MP4, WebM, MKV, MOV, AVI, M4V, OGV. Files can live on any drive (including
            external); if that drive is disconnected the console shows your game's background instead.
          </p>
        </div>
      </div>
    </div>
  );
}