import type { Game } from "../../types";
import { Clock, Calendar } from "lucide-react";
import { formatPlayTime, formatDate } from "../../utils/format";
import { useGameLogo } from "../../hooks/useGameLogo";
import { useT } from "../../i18n";
import { HeroTitle } from "../detail/HeroTitle";
import { ConsoleActionButtons, type ConsoleActionControl } from "./ConsoleActionButtons";

export type { ConsoleActionControl };

interface ConsoleInfoPanelProps {
  game: Game;
  focusArea: "carousel" | "actions";
  focusedAction: ConsoleActionControl | null;
  onPlay: () => void;
  onToggleFavorite: () => void;
  onOpenMore: () => void;
  hints?: React.ReactNode;
}

export function ConsoleInfoPanel({
  game,
  focusArea,
  focusedAction,
  onPlay,
  onToggleFavorite,
  onOpenMore,
  hints,
}: ConsoleInfoPanelProps) {
  const interactive = focusArea === "actions";
  const { url: logoUrl } = useGameLogo(game);
  const { t } = useT();

  return (
    <div className="relative z-20 flex items-end justify-between gap-8 px-12">
      {/* Upper-left: title + actions, sitting directly above the carousel */}
      <div className="min-w-0 max-w-[58%]">
        <HeroTitle
          game={game}
          logoUrl={logoUrl}
          imgClassName="max-h-24 lg:max-h-32"
          textClassName="text-3xl lg:text-4xl font-extrabold leading-tight"
        />

        <div className="mt-5">
          <ConsoleActionButtons
            isFavorite={game.isFavorite}
            interactive={interactive}
            focusedAction={focusedAction}
            onPlay={onPlay}
            onOpenMore={onOpenMore}
            onToggleFavorite={onToggleFavorite}
          />
        </div>
      </div>

      {/* Upper-right: premium stats card + controller hints, above the carousel */}
      <div className="shrink-0 flex flex-col items-end gap-3">
        <div className="rounded-2xl px-6 py-4 min-w-[230px] hidden md:block border border-white/15 bg-gradient-to-b from-white/[0.14] to-white/[0.04] backdrop-blur-xl shadow-[0_24px_60px_-28px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.22)]">
          <div className="flex items-center gap-3 text-white">
            <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 border border-white/15 text-white/70">
              <Clock size={16} />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">{t("console.playTime")}</p>
              {game.playTime > 0 ? (
                <p className="text-lg font-semibold text-white">{formatPlayTime(game.playTime)}</p>
              ) : (
                <p className="text-lg font-medium text-white/50">{t("game.neverPlayed")}</p>
              )}
            </div>
          </div>
          {game.lastPlayed && (
            <div className="flex items-center gap-3 text-white mt-4 pt-4 border-t border-white/10">
              <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 border border-white/15 text-white/70">
                <Calendar size={16} />
              </span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">{t("console.lastPlayed")}</p>
                <p className="text-lg font-semibold text-white">{formatDate(game.lastPlayed)}</p>
              </div>
            </div>
          )}
        </div>
        {hints && (
          <div className="hidden sm:flex items-center gap-5 text-[11px] text-white/45">
            {hints}
          </div>
        )}
      </div>
    </div>
  );
}