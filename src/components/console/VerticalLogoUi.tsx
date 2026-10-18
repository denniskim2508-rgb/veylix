import { useEffect, useRef, useState } from "react";
import type { Game, ArtworkCandidate } from "../../types";
import { ArtworkType } from "../../types";
import { resolveArtworkUrl } from "../../utils/artwork";
import { formatPlayTime, formatDate } from "../../utils/format";
import { useT } from "../../i18n";
import { Clock, Calendar } from "lucide-react";
import { ConsoleActionButtons, type ConsoleActionControl } from "./ConsoleActionButtons";
import clsx from "clsx";

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

/**
 * Reads a game's transparent logo from the local artwork cache. Unlike
 * `useGameLogo`, this never triggers a network resolve — the vertical list can
 * hold many games, so resolution is done once for the selected game only (see
 * `VerticalLogoUi`) and this hook simply reflects the cached result.
 *
 * When `enabled` is false (rows far from the selection) it skips the
 * `get_artwork_candidates` lookup and only uses the game's own `logo` path, so
 * a large library does not fire hundreds of IPC calls on mount.
 */
function useCachedLogoUrl(
  gameId: number | null,
  fallback: string | null,
  refreshKey: number,
  enabled = true
): string | null {
  const [resolved, setResolved] = useState<{ id: number; url: string | null } | null>(null);
  // Games whose real candidates were already fetched — never downgrade them
  // when they scroll out of the windowed fetch range.
  const upgradedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!gameId) return;
    if (!enabled && upgradedRef.current.has(gameId)) return;
    let cancelled = false;
    (async () => {
      try {
        let source = fallback;
        if (enabled) {
          const candidates = await invoke<ArtworkCandidate[]>("get_artwork_candidates", {
            gameId,
            artworkType: ArtworkType.Logo,
          });
          if (cancelled) return;
          source = candidates.find((c) => c.isPrimary)?.url ?? candidates[0]?.url ?? fallback;
          upgradedRef.current.add(gameId);
        }
        const url = await resolveArtworkUrl(source);
        if (!cancelled) setResolved({ id: gameId, url });
      } catch {
        if (!cancelled) setResolved({ id: gameId, url: await resolveArtworkUrl(fallback) });
      }
    })();
    return () => { cancelled = true; };
  }, [gameId, fallback, refreshKey, enabled]);

  // Derived (not set in the effect): null while a different/absent game is selected.
  return gameId != null && resolved?.id === gameId ? resolved.url : null;
}

function releaseYear(date: string | null): string | null {
  if (!date) return null;
  const match = date.match(/\d{4}/);
  return match ? match[0] : null;
}

interface VerticalLogoUiProps {
  games: Game[];
  selectedIndex: number;
  isFocused: boolean;
  actionFocused: boolean;
  focusedAction: ConsoleActionControl | null;
  onSelect: (index: number) => void;
  onActivate: () => void;
  onPlay: () => void;
  onToggleFavorite: () => void;
  onOpenMore: () => void;
  hints?: React.ReactNode;
  logoEpoch: number;
}

function LogoRow({
  game,
  index,
  selected,
  nearby,
  refresh,
  onSelect,
  onActivate,
  registerRef,
}: {
  game: Game;
  index: number;
  selected: boolean;
  nearby: boolean;
  refresh: number;
  onSelect: (index: number) => void;
  onActivate: () => void;
  registerRef: (id: number, el: HTMLButtonElement | null) => void;
}) {
  const url = useCachedLogoUrl(game.id, game.logo, refresh, nearby);

  return (
    <button
      ref={(el) => registerRef(game.id, el)}
      onClick={() => (selected ? onActivate() : onSelect(index))}
      className={clsx(
        "group flex w-full items-center justify-start py-3.5 pl-2 pr-3 text-left transition-all duration-200 ease-out",
        selected ? "opacity-100" : "opacity-55 hover:opacity-90"
      )}
    >
      {url ? (
        <img
          src={url}
          alt={game.title}
          draggable={false}
          className={clsx(
            "max-h-12 md:max-h-16 w-auto max-w-[260px] object-contain object-left transition-transform duration-200 ease-out",
            selected ? "scale-105 drop-shadow-[0_6px_20px_rgba(0,0,0,0.75)]" : "scale-100"
          )}
        />
      ) : (
        <span
          className={clsx(
            "truncate transition-transform duration-200 ease-out",
            selected
              ? "text-2xl md:text-3xl font-extrabold text-white drop-shadow-[0_4px_14px_rgba(0,0,0,0.8)] scale-105"
              : "text-lg md:text-xl font-semibold text-white/90"
          )}
        >
          {game.title}
        </span>
      )}
    </button>
  );
}

export function VerticalLogoUi({
  games,
  selectedIndex,
  isFocused,
  actionFocused,
  focusedAction,
  onSelect,
  onActivate,
  onPlay,
  onToggleFavorite,
  onOpenMore,
  hints,
  logoEpoch,
}: VerticalLogoUiProps) {
  const { t } = useT();
  const selectedGame = games[selectedIndex] ?? null;
  const [refreshKey, setRefreshKey] = useState(0);
  const resolvedRef = useRef<Set<number>>(new Set());
  const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  // Resolve the selected game's logo once per session (the resolver caches it
  // in the DB), then refresh so the newly-available logo appears in the list.
  useEffect(() => {
    const game = games[selectedIndex];
    if (!game || resolvedRef.current.has(game.id)) return;
    resolvedRef.current.add(game.id);
    let cancelled = false;
    (async () => {
      try {
        await invoke("resolve_game_artwork", { gameId: game.id, artworkType: ArtworkType.Logo });
      } catch {
        /* resolver is best-effort */
      }
      if (!cancelled) setRefreshKey((k) => k + 1);
    })();
    return () => { cancelled = true; };
  }, [games, selectedIndex]);

  const refresh = refreshKey + logoEpoch;

  const registerRef = (id: number, el: HTMLButtonElement | null) => {
    if (el) itemRefs.current.set(id, el);
    else itemRefs.current.delete(id);
  };

  // Keep the selected logo visible while navigating.
  useEffect(() => {
    if (!selectedGame) return;
    itemRefs.current.get(selectedGame.id)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [selectedGame]);

  const selectedLogoUrl = useCachedLogoUrl(selectedGame?.id ?? null, selectedGame?.logo ?? null, refresh);
  const year = releaseYear(selectedGame?.releaseDate ?? null);

  return (
    <div className="absolute inset-0 z-10">
      {/* Readability scrim — subtle, only where text sits; wallpaper stays dominant. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-black/55 to-transparent" />

      {/* Vertical logo list (left) */}
      <div
        className="absolute left-6 md:left-10 top-24 bottom-44 w-[280px] md:w-[340px] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {games.length === 0 ? (
          <p className="pt-8 pl-2 text-lg font-semibold text-white/50">No games in this section</p>
        ) : (
          <div className={clsx("flex flex-col transition-opacity", isFocused ? "opacity-100" : "opacity-95")}>
            {games.map((game, index) => (
              <LogoRow
                key={game.id}
                game={game}
                index={index}
                selected={index === selectedIndex}
                nearby={Math.abs(index - selectedIndex) <= 12}
                refresh={refresh}
                onSelect={onSelect}
                onActivate={onActivate}
                registerRef={registerRef}
              />
            ))}
          </div>
        )}
      </div>

      {/* Selected game info (lower-left, right of the logo list) */}
      {selectedGame && (
        <div className="absolute bottom-12 left-[320px] md:left-[400px] right-6 lg:right-[320px] max-w-[640px]">
          {selectedLogoUrl ? (
            <img
              src={selectedLogoUrl}
              alt={selectedGame.title}
              draggable={false}
              className="max-h-16 lg:max-h-20 w-auto max-w-[420px] object-contain object-left drop-shadow-[0_8px_26px_rgba(0,0,0,0.8)]"
            />
          ) : (
            <h2 className="text-3xl lg:text-4xl font-extrabold leading-tight text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)]">
              {selectedGame.title}
            </h2>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-white/70">
            {year && <span className="text-white/85">{year}</span>}
            {selectedGame.genre && (
              <>
                {year && <span className="text-white/30">•</span>}
                <span>{selectedGame.genre}</span>
              </>
            )}
            {(selectedGame.developer || selectedGame.publisher) && (
              <>
                <span className="text-white/30">•</span>
                <span>{selectedGame.developer || selectedGame.publisher}</span>
              </>
            )}
          </div>

          {selectedGame.description && (
            <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-white/65 line-clamp-3">
              {selectedGame.description}
            </p>
          )}

          <div className="mt-5">
            <ConsoleActionButtons
              isFavorite={selectedGame.isFavorite}
              interactive={actionFocused}
              focusedAction={focusedAction}
              onPlay={onPlay}
              onOpenMore={onOpenMore}
              onToggleFavorite={onToggleFavorite}
            />
          </div>
        </div>
      )}

      {/* Playtime panel (right) — only when real data exists */}
      {selectedGame && (selectedGame.playTime > 0 || selectedGame.lastPlayed) && (
        <div className="absolute right-10 top-1/2 hidden -translate-y-1/2 md:block">
          <div className="rounded-2xl px-6 py-4 min-w-[230px] border border-white/15 bg-gradient-to-b from-white/[0.14] to-white/[0.04] backdrop-blur-xl shadow-[0_24px_60px_-28px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.22)]">
            {selectedGame.playTime > 0 && (
              <div className="flex items-center gap-3 text-white">
                <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 border border-white/15 text-white/70">
                  <Clock size={16} />
                </span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">{t("console.playTime")}</p>
                  <p className="text-lg font-semibold text-white">{formatPlayTime(selectedGame.playTime)}</p>
                </div>
              </div>
            )}
            {selectedGame.lastPlayed && (
              <div
                className={clsx(
                  "flex items-center gap-3 text-white",
                  selectedGame.playTime > 0 && "mt-4 pt-4 border-t border-white/10"
                )}
              >
                <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 border border-white/15 text-white/70">
                  <Calendar size={16} />
                </span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">{t("console.lastPlayed")}</p>
                  <p className="text-lg font-semibold text-white">{formatDate(selectedGame.lastPlayed)}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {hints && (
        <div className="absolute bottom-4 right-10 hidden sm:flex items-center gap-5 text-[11px] text-white/45">
          {hints}
        </div>
      )}
    </div>
  );
}
