import { useEffect, useMemo, useState } from "react";
import { Play, Star, Clapperboard, Eye, FolderOpen, Trash2 } from "lucide-react";
import type { Game } from "../../types";
import type { GamehubAction } from "../../types/controller";
import { useControllerStore } from "../../store/controllerStore";
import { setConsoleOverlayHandler } from "../../utils/consoleInput";
import { uiAudio, type UiSoundName } from "../../utils/uiAudio";
import { useT } from "../../i18n";
import { useNavFeedback } from "../../hooks/useNavFeedback";
import clsx from "clsx";

interface MoreMenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  action: () => void;
  sfx?: UiSoundName;
  danger?: boolean;
}

interface ConsoleMoreMenuProps {
  game: Game;
  onClose: () => void;
  onPlay: () => void;
  onToggleFavorite: () => void;
  onManageTrailer: () => void;
  onViewDetails: () => void;
  onOpenFolder: () => void;
  onRemove: () => void;
}

export function ConsoleMoreMenu({
  game,
  onClose,
  onPlay,
  onToggleFavorite,
  onManageTrailer,
  onViewDetails,
  onOpenFolder,
  onRemove,
}: ConsoleMoreMenuProps) {
  const [index, setIndex] = useState(0);
  const getButtonLabel = useControllerStore((s) => s.getButtonLabel);
  const { t } = useT();

  useNavFeedback(index);

  const items = useMemo<MoreMenuItem[]>(() => {
    const base: MoreMenuItem[] = [
      { id: "play", label: t("common.play"), icon: Play, action: onPlay },
      {
        id: "fav",
        label: game.isFavorite ? t("game.removeFromFavorites") : t("game.addToFavorites"),
        icon: Star,
        action: onToggleFavorite,
        sfx: "confirm",
      },
      { id: "trailer", label: t("menu.manageTrailer"), icon: Clapperboard, action: onManageTrailer, sfx: "confirm" },
      { id: "details", label: t("menu.viewDetails"), icon: Eye, action: onViewDetails },
      {
        id: "folder",
        label: t("menu.openGameFolder"),
        icon: FolderOpen,
        action: onOpenFolder,
        sfx: "confirm",
      },
    ];
    const remove: MoreMenuItem = {
      id: "remove",
      label: t("menu.removeFromLibrary"),
      icon: Trash2,
      danger: true,
      action: onRemove,
      sfx: "confirm",
    };
    const folderDisabled = !game.installPath && !game.executablePath;
    if (folderDisabled) {
      return base.filter((i) => i.id !== "folder").concat(remove);
    }
    return base.concat(remove);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, onPlay, onToggleFavorite, onManageTrailer, onViewDetails, onOpenFolder, onRemove, t]);

  const move = (dir: 1 | -1) =>
    setIndex((i) => (i + dir + items.length) % items.length);

  const activate = (item: MoreMenuItem) => {
    if (item.sfx) void uiAudio.playUiSound(item.sfx);
    item.action();
  };

  const close = () => {
    void uiAudio.playUiSound("close");
    onClose();
  };

  const handleAction = (a: GamehubAction): boolean => {
    switch (a) {
      case "down": move(1); return true;
      case "up": move(-1); return true;
      case "confirm":
        activate(items[index]);
        return true;
      case "cancel": close(); return true;
      default: return false;
    }
  };

  useEffect(() => {
    setIndex(0);
  }, [game.id]);

  useEffect(() => {
    setConsoleOverlayHandler(handleAction);
    return () => setConsoleOverlayHandler(null);
  }, [items, index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); e.stopPropagation(); move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); e.stopPropagation(); move(-1); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); activate(items[index]); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
      <div
        className="relative w-[360px] rounded-2xl bg-[#111827]/95 border border-white/15 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="px-5 pt-4 pb-2 text-sm font-semibold text-white truncate">{game.title}</p>
        <div className="py-1 max-h-[70vh] overflow-y-auto overscroll-contain">
          {items.map((item, i) => {
            const Icon = item.icon;
            const focused = i === index;
            return (
              <button
                key={item.id}
                onClick={() => activate(item)}
                onMouseEnter={() => setIndex(i)}
                className={clsx(
                  "w-full flex items-center gap-3 px-5 py-3 text-left text-sm font-medium transition-colors",
                  focused ? "bg-white text-black" : "text-white/85 hover:bg-white/10",
                  item.danger && !focused && "text-red-300/90"
                )}
              >
                <Icon size={17} />
                {item.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-4 px-5 py-3 border-t border-white/10 text-[11px] text-white/45">
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