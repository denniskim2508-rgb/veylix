import { Play, MoreHorizontal, Star } from "lucide-react";
import { useT } from "../../i18n";
import clsx from "clsx";

export type ConsoleActionControl = "play" | "more" | "favorite";

// Shared premium motion + focus treatment.
const EASE = "transition-all duration-200 ease-out";
const FOCUS = "ring-2 ring-white/85 ring-offset-2 ring-offset-black/60";
const LIFT = "hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]";

interface ConsoleActionButtonsProps {
  isFavorite: boolean;
  interactive: boolean;
  focusedAction: ConsoleActionControl | null;
  onPlay: () => void;
  onOpenMore: () => void;
  onToggleFavorite: () => void;
}

export function ConsoleActionButtons({
  isFavorite,
  interactive,
  focusedAction,
  onPlay,
  onOpenMore,
  onToggleFavorite,
}: ConsoleActionButtonsProps) {
  const { t } = useT();
  return (
    <div className="flex items-center gap-3.5">
      {/* Play — gradient glass primary with inset glyph */}
      <button
        onClick={onPlay}
        className={clsx(
          "group relative flex items-center gap-3 rounded-full pl-2 pr-7 py-2",
          "text-[15px] font-bold tracking-wide text-black",
          EASE,
          LIFT,
          "bg-gradient-to-b from-white via-white to-[#dfe4ec]",
          "shadow-[0_14px_34px_-14px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.9)]",
          "hover:shadow-[0_18px_44px_-14px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,1)]",
          interactive && focusedAction === "play" && `${FOCUS} scale-105`
        )}
      >
        <span className="flex items-center justify-center w-9 h-9 rounded-full bg-black text-white shadow-[inset_0_1px_2px_rgba(255,255,255,0.35),0_2px_6px_rgba(0,0,0,0.4)]">
          <Play size={14} fill="currentColor" className="translate-x-[1px]" />
        </span>
        {t("common.play")}
      </button>

      {/* More — frosted glass secondary */}
      <button
        onClick={onOpenMore}
        className={clsx(
          "group relative flex items-center gap-2.5 rounded-full px-6 py-3.5",
          "text-[15px] font-semibold tracking-wide text-white",
          EASE,
          LIFT,
          "bg-white/10 border border-white/20 backdrop-blur-xl",
          "shadow-[0_12px_30px_-16px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.28)]",
          "hover:bg-white/[0.18] hover:border-white/35",
          interactive && focusedAction === "more" && `${FOCUS} scale-105`
        )}
      >
        <MoreHorizontal size={20} />
        {t("common.more")}
      </button>

      {/* Favorite — glass icon button, gold + glow when active */}
      <button
        onClick={onToggleFavorite}
        title={isFavorite ? t("game.removeFromFavorites") : t("game.addToFavorites")}
        className={clsx(
          "relative flex items-center justify-center w-[52px] h-[52px] rounded-full backdrop-blur-xl",
          EASE,
          LIFT,
          isFavorite
            ? "bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-500 text-black border border-white/40 shadow-[0_0_26px_-3px_rgba(251,191,36,0.8),inset_0_1px_0_rgba(255,255,255,0.7)]"
            : "bg-white/10 text-white border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_12px_30px_-16px_rgba(0,0,0,0.9)] hover:bg-white/[0.18] hover:border-white/35",
          interactive && focusedAction === "favorite" && `${FOCUS} scale-105`
        )}
      >
        <Star size={20} fill={isFavorite ? "currentColor" : "none"} />
      </button>
    </div>
  );
}
