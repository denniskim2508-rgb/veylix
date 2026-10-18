import { Play, Star, Monitor } from "lucide-react";
import type { Game } from "../types";
import { PlatformBadge } from "./PlatformBadge";
import { useT } from "../i18n";
import { useFocusableElement } from "../hooks/useFocusableElement";
import { useNavigation } from "./NavigationProvider";
import { useArtwork } from "../hooks/useArtwork";
import { ArtworkType } from "../types";
import clsx from "clsx";

interface GameCardProps {
  game: Game;
  onClick: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
}

export function GameCard({ game, onClick, onToggleFavorite }: GameCardProps) {
  const { url: coverUrl } = useArtwork(game.id, ArtworkType.Cover, game.coverImage);
  const { pushStack } = useNavigation();
  const { t } = useT();

  const formatPlayTime = (hours: number): string => {
    if (hours === 0) return t("game.neverPlayed");
    if (hours < 1) return t("format.playTimeMinutes", { minutes: Math.round(hours * 60) });
    return t("format.playTimeHours", { hours: Math.round(hours) });
  };

  const handleClick = () => {
    pushStack("gamegrid", `game-${game.id}`, game.id);
    onClick();
  };

  const { ref, isFocused, focusableProps } = useFocusableElement({
    id: `game-${game.id}`,
    region: "gamegrid",
    onClick: handleClick,
  });

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      role="button"
      onClick={handleClick}
      className={clsx(
        "group relative w-[200px] rounded-xl border border-border bg-bg-card overflow-hidden cursor-pointer",
        "transition-all duration-150 ease-out",
        "hover:-translate-y-1 hover:shadow-[0_8px_25px_rgba(0,0,0,0.4)]",
        isFocused && "is-focused"
      )}
      {...focusableProps}
    >
      <div className="relative w-full h-[280px] bg-bg-hover overflow-hidden">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={game.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
            <Monitor size={48} className="text-primary/30" />
          </div>
        )}

        <div className={clsx(
          "absolute inset-0 transition-colors duration-150",
          isFocused ? "bg-black/20" : "group-hover:bg-black/20"
        )} />

        <button
          onClick={onToggleFavorite}
          className={clsx(
            "absolute top-2 right-2 p-1.5 rounded-lg transition-all duration-150",
            game.isFavorite
              ? "bg-yellow-500/90 text-white opacity-100"
              : clsx(
                  "bg-black/40 text-white/70 hover:bg-black/60",
                  isFocused ? "opacity-100" : "opacity-0",
                  "group-hover:opacity-100"
                )
          )}
        >
          <Star size={14} fill={game.isFavorite ? "currentColor" : "none"} />
        </button>

        <div className={clsx(
          "absolute bottom-2 right-2 transition-all duration-150",
          isFocused ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
          "group-hover:opacity-100 group-hover:translate-y-0"
        )}>
          <button className="w-12 h-12 rounded-full bg-primary hover:bg-primary-hover text-white flex items-center justify-center shadow-lg transition-colors">
            <Play size={20} fill="currentColor" className="ml-0.5" />
          </button>
        </div>
      </div>

      <div className="p-3">
        <h3 className="text-sm font-semibold text-text-primary truncate mb-1">{game.title}</h3>
        <div className="flex items-center justify-between">
          <PlatformBadge platform={game.platform} />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-xs text-text-muted">{formatPlayTime(game.playTime)}</span>
          {game.isInstalled && (
            <span className="w-2 h-2 rounded-full bg-success" title={t("game.installed")} />
          )}
        </div>
      </div>
    </div>
  );
}
