import { useEffect, useState } from "react";
import { X, Image as ImageIcon, Video, FolderOpen, Trash2, Loader2, FileWarning, CheckCircle2, Check } from "lucide-react";
import type { GamehubAction } from "../../types/controller";
import { useControllerStore } from "../../store/controllerStore";
import { setConsoleOverlayHandler } from "../../utils/consoleInput";
import { uiAudio } from "../../utils/uiAudio";
import { useT } from "../../i18n";
import { useNavFeedback } from "../../hooks/useNavFeedback";
import {
  probeWallpaper,
  resolveTrailerPlaybackUrl,
  fileNameFromPath,
  formatBytes,
  WALLPAPER_IMAGE_EXTENSIONS,
  WALLPAPER_VIDEO_EXTENSIONS,
} from "../../utils/trailer";
import clsx from "clsx";

interface WallpaperPickerModalProps {
  kind: "static" | "live";
  assignedPath: string;
  audioEnabled?: boolean;
  onApply: (path: string) => void;
  onRemove: () => void;
  onClose: () => void;
}

interface PickerButton {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  primary?: boolean;
}

export function WallpaperPickerModal({ kind, assignedPath, audioEnabled = false, onApply, onRemove, onClose }: WallpaperPickerModalProps) {
  const [index, setIndex] = useState(0);
  const [candidate, setCandidate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [probe, setProbe] = useState<{ valid: boolean; exists: boolean; sizeBytes: number; error: string | null } | null>(null);
  const getButtonLabel = useControllerStore((s) => s.getButtonLabel);
  const { t } = useT();

  const isStatic = kind === "static";
  const shownPath = candidate ?? assignedPath;
  const preview = shownPath ? resolveTrailerPlaybackUrl(shownPath) : null;
  const canApply = !!candidate && candidate !== assignedPath;
  const missing = !!shownPath && probe !== null && !probe.exists;

  useNavFeedback(index);

  useEffect(() => {
    if (!assignedPath) return;
    let cancelled = false;
    probeWallpaper(assignedPath)
      .then((p) => {
        if (!cancelled) setProbe({ valid: p.valid, exists: p.exists, sizeBytes: p.sizeBytes, error: p.error });
      })
      .catch(() => {
        if (!cancelled) setProbe(null);
      });
    return () => {
      cancelled = true;
    };
  }, [assignedPath]);

  const handleBrowse = async () => {
    if (busy) return;
    void uiAudio.playUiSound("open");
    const { open } = await import("@tauri-apps/plugin-dialog");
    const result = await open({
      multiple: false,
      title: isStatic ? "Select Wallpaper Image" : "Select Live Wallpaper Video",
      filters: isStatic
        ? [
            { name: "Images", extensions: [...WALLPAPER_IMAGE_EXTENSIONS] },
            { name: "All files", extensions: ["*"] },
          ]
        : [
            { name: "Video", extensions: [...WALLPAPER_VIDEO_EXTENSIONS] },
            { name: "All files", extensions: ["*"] },
          ],
    });
    const path = typeof result === "string" ? result : Array.isArray(result) ? result[0] : null;
    if (!path) return;

    setBusy(true);
    try {
      const p = await probeWallpaper(path);
      setCandidate(path);
      setProbe({ valid: p.valid, exists: p.exists, sizeBytes: p.sizeBytes, error: p.error });
      void uiAudio.playUiSound(p.valid ? "confirm" : "error");
    } catch (err) {
      console.error("Wallpaper probe failed:", err);
      void uiAudio.playUiSound("error");
    } finally {
      setBusy(false);
    }
  };

  const handleApply = () => {
    if (!candidate) return;
    void uiAudio.playUiSound("confirm");
    onApply(candidate);
    onClose();
  };

  const handleRemove = () => {
    void uiAudio.playUiSound("confirm");
    onRemove();
    onClose();
  };

  const close = () => {
    void uiAudio.playUiSound("close");
    onClose();
  };

  const buttons: PickerButton[] = [
    {
      id: "browse",
      label: shownPath ? "Change File..." : "Browse...",
      icon: FolderOpen,
      onClick: handleBrowse,
      disabled: busy,
      primary: !canApply,
    },
    ...(canApply
      ? [{ id: "apply", label: t("common.apply"), icon: Check, onClick: handleApply, primary: true } as PickerButton]
      : []),
    ...(assignedPath
      ? [{ id: "remove", label: isStatic ? "Remove Wallpaper" : "Remove Live Wallpaper", icon: Trash2, onClick: handleRemove, danger: true } as PickerButton]
      : []),
  ];

  const move = (dir: 1 | -1) => setIndex((i) => (i + dir + buttons.length) % buttons.length);

  const activate = (btn: PickerButton) => {
    if (btn.disabled) return;
    btn.onClick();
  };

  const handleAction = (a: GamehubAction): boolean => {
    switch (a) {
      case "down":
      case "right":
        move(1);
        return true;
      case "up":
      case "left":
        move(-1);
        return true;
      case "confirm":
        activate(buttons[index]);
        return true;
      case "cancel":
        close();
        return true;
      default:
        return false;
    }
  };

  useEffect(() => {
    setConsoleOverlayHandler(handleAction);
    return () => setConsoleOverlayHandler(null);
  }, [buttons, index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); e.stopPropagation(); move(1); }
      else if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); e.stopPropagation(); move(-1); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); activate(buttons[index]); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const TitleIcon = isStatic ? ImageIcon : Video;
  const title = isStatic ? "Static Wallpaper" : "Live Wallpaper";

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={close} />
      <div
        className="relative w-[620px] max-w-[94vw] max-h-[90vh] overflow-y-auto rounded-2xl bg-[#111827]/95 border border-white/15 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <TitleIcon size={18} className="text-white/70" />
            <h2 className="text-base font-semibold text-white">{title}</h2>
          </div>
          <button
            onClick={close}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            aria-label={t("common.close")}
          >
            <X size={17} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Preview */}
          <div className="rounded-xl overflow-hidden bg-black border border-white/10 aspect-video flex items-center justify-center">
            {preview ? (
              isStatic ? (
                <img
                  key={preview}
                  src={preview}
                  alt=""
                  className="w-full h-full object-contain"
                  draggable={false}
                />
              ) : (
                <video
                  key={preview}
                  src={preview}
                  controls
                  autoPlay={!!probe?.exists}
                  muted={!audioEnabled}
                  loop
                  playsInline
                  className="w-full h-full object-contain"
                />
              )
            ) : (
              <div className="text-center text-white/40 text-sm py-16">
                <TitleIcon size={40} className="mx-auto mb-3 opacity-50" />
                No wallpaper selected yet.<br />
                {isStatic
                  ? "Pick an image to use as the Console Mode background."
                  : "Pick a video to loop as the Console Mode background."}
              </div>
            )}
          </div>

          {/* Status */}
          <div className="space-y-2 text-sm">
            {shownPath ? (
              <>
                <div className="flex items-center gap-2 text-white/80">
                  {candidate && candidate !== assignedPath && (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wide bg-white/10 text-white/70">
                      Pending
                    </span>
                  )}
                  <span className="truncate text-xs text-white/60" title={shownPath}>{fileNameFromPath(shownPath)}</span>
                  {probe?.valid && probe.exists && (
                    <span className="ml-auto flex items-center gap-1 text-xs text-emerald-400">
                      <CheckCircle2 size={14} /> Valid · {formatBytes(probe.sizeBytes)}
                    </span>
                  )}
                </div>
                {missing && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-amber-200 text-xs">
                    <FileWarning size={16} className="mt-0.5 shrink-0" />
                    <span>{probe?.error ?? "This file is not reachable right now. It may have moved or be on a disconnected drive."}</span>
                  </div>
                )}
              </>
            ) : (
              <p className="text-white/45 text-xs">
                {isStatic
                  ? "No wallpaper set. Console Mode keeps using each game's trailer or artwork."
                  : "No live wallpaper set. Console Mode keeps using each game's trailer or artwork."}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
            {buttons.map((btn, i) => {
              const Icon = btn.icon;
              const focused = i === index;
              return (
                <button
                  key={btn.id}
                  onClick={() => { setIndex(i); activate(btn); }}
                  onMouseEnter={() => setIndex(i)}
                  disabled={btn.disabled}
                  className={clsx(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none",
                    focused
                      ? "bg-white text-black"
                      : btn.danger
                        ? "bg-white/5 text-red-300 hover:bg-red-500/20 hover:text-red-200"
                        : btn.primary
                          ? "bg-white/90 text-black hover:bg-white"
                          : "bg-white/5 text-white/80 hover:bg-white/10"
                  )}
                >
                  {busy && btn.id === "browse" ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} />}
                  {btn.label}
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-white/35 leading-relaxed">
            {isStatic
              ? "Supported images: PNG, JPG, JPEG, WebP, BMP, GIF. Files can live on any drive; if a drive is disconnected the console falls back to each game's background."
              : "Supported video: MP4, WebM, MKV, MOV, AVI, M4V, OGV. Loops continuously; plays muted unless \"Live Wallpaper Sound\" is On. Files can live on any drive; if a drive is disconnected the console falls back to your static wallpaper, then each game's background."}
          </p>
        </div>

        <div className="sticky bottom-0 flex items-center gap-4 px-5 py-3 border-t border-white/10 bg-[#111827]/95 text-[11px] text-white/45">
          <span>
            <span className="inline-block w-4 text-center font-bold">{getButtonLabel("confirm")}</span> {t("console.hintSelect")}
          </span>
          <span>
            <span className="inline-block w-4 text-center font-bold">{getButtonLabel("cancel")}</span> {t("common.back")}
          </span>
        </div>
      </div>
    </div>
  );
}
