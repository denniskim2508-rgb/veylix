import { useState, useEffect, useRef } from "react";
import {
  Play,
  MoreHorizontal,
  Star,
  RefreshCw,
  Clock,
  Trophy,
  Gamepad2,
  Monitor,
  Calendar,
  HardDrive,
  Tag,
} from "lucide-react";
import type { Game } from "../types";
import { PLATFORM_LABELS } from "../types";
import { PlatformBadge } from "./PlatformBadge";
import { PlatformIcon } from "./PlatformIcon";
import { EditGameModal } from "./EditGameModal";
import { ScreenshotManager } from "./ScreenshotManager";
import { ManageArtworkModal } from "./ManageArtworkModal";
import { TrailerManagerModal } from "./TrailerManagerModal";
import { GameDetailMoreMenu } from "./menus/GameDetailMoreMenu";
import { useFocusableElement } from "../hooks/useFocusableElement";
import { useNavigation } from "./NavigationProvider";
import { useGameDetailData } from "../hooks/useGameDetailData";
import { useGameDetailActions } from "../hooks/useGameDetailActions";
import { HeroTitle } from "./detail/HeroTitle";
import { Section } from "./detail/Section";
import { StatCard } from "./detail/StatCard";
import { DetailRow } from "./detail/DetailRow";
import { ShotThumb } from "./detail/ShotThumb";
import { ScreenshotLightbox } from "./detail/ScreenshotLightbox";
import { useStore } from "../store/useStore";
import { useT } from "../i18n";
import { formatPlayTime, formatDate } from "../utils/format";
import clsx from "clsx";

interface DetailsPaneProps {
  game: Game | null;
  onToggleFavorite: () => void;
  onPlay: () => void;
  onDelete: () => void;
}

export function DetailsPane({ game, onToggleFavorite, onPlay, onDelete }: DetailsPaneProps) {
  if (!game) {
    return (
      <div className="h-full flex items-center justify-center text-text-muted">
        <div className="text-center">
          <Gamepad2 size={56} className="mx-auto mb-4 opacity-30" />
          <p className="text-sm">Select a game to view details</p>
        </div>
      </div>
    );
  }
  return (
    <DetailsPaneContent
      key={game.id}
      game={game}
      onToggleFavorite={onToggleFavorite}
      onPlay={onPlay}
      onDelete={onDelete}
    />
  );
}

function DetailsPaneContent({ game, onToggleFavorite, onPlay, onDelete }: DetailsPaneProps & { game: Game }) {
  const setSelectedGame = useStore((s) => s.setSelectedGame);
  const { t, tp } = useT();

  const [showEditModal, setShowEditModal] = useState(false);
  const [showManageArtwork, setShowManageArtwork] = useState(false);
  const [showManageTrailer, setShowManageTrailer] = useState(false);
  const [showScreenshotManager, setShowScreenshotManager] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [heroFaded, setHeroFaded] = useState(false);

  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const prevMoreOpen = useRef(false);

  const { setActiveRegion, setFocus } = useNavigation();

  const data = useGameDetailData(game);
  const actions = useGameDetailActions(game);

  const playBtn = useFocusableElement({ id: "dt-play", region: "detailhero", onClick: onPlay });
  const moreBtn = useFocusableElement({ id: "dt-more", region: "detailhero", onClick: () => setMoreOpen((v) => !v) });
  const favBtn = useFocusableElement({ id: "dt-fav", region: "detailhero", onClick: handleToggleFavorite });

  function handleToggleFavorite() {
    onToggleFavorite();
    const fresh = useStore.getState().games.find((g) => g.id === game.id);
    if (fresh) setSelectedGame(fresh);
  }

  useEffect(() => {
    setHeroFaded(false);
  }, [game.id]);

  // Route navigation focus into (or out of) the "menu" sentinel while the More
  // menu is open, so global arrows/Enter stay inert and only the menu reacts.
  useEffect(() => {
    if (moreOpen) {
      setActiveRegion("menu");
      setFocus("detail-more-sentinel");
    } else if (prevMoreOpen.current) {
      setActiveRegion("detailhero");
      setFocus("dt-more");
    }
    prevMoreOpen.current = moreOpen;
  }, [moreOpen, setActiveRegion, setFocus]);

  const closeSubmodal = () => {
    setActiveRegion("detailhero");
    setFocus("dt-play");
  };

  const moreItems = actions.buildMoreItems({
    isEmulatorGame: data.isEmulatorGame,
    emulators: data.compatibleEmulators,
    onMenuClose: () => setMoreOpen(false),
    onOpenEdit: () => setShowEditModal(true),
    onOpenScreenshots: () => setShowScreenshotManager(true),
    onOpenManageArtwork: () => setShowManageArtwork(true),
    onOpenManageTrailer: () => setShowManageTrailer(true),
    onDelete,
  });

  const detailRows = [
    { icon: <Monitor size={16} />, label: "Status", value: game.isInstalled ? "Installed" : "Not Installed" },
    { icon: <PlatformIcon platform={game.platform} size={16} />, label: "Source", value: PLATFORM_LABELS[game.platform] },
    { icon: <Clock size={16} />, label: "Time Played", value: formatPlayTime(data.totalMinutes || game.playTime) },
    ...(game.lastPlayed ? [{ icon: <Calendar size={16} />, label: "Last Played", value: formatDate(game.lastPlayed) }] : []),
    ...(game.genre ? [{ icon: <Tag size={16} />, label: "Genres", value: game.genre }] : []),
    ...(game.developer ? [{ icon: <Tag size={16} />, label: "Developer", value: game.developer }] : []),
    ...(game.publisher ? [{ icon: <Tag size={16} />, label: "Publisher", value: game.publisher }] : []),
    ...(game.releaseDate ? [{ icon: <Calendar size={16} />, label: "Release Date", value: game.releaseDate }] : []),
    ...(game.installPath ? [{ icon: <HardDrive size={16} />, label: "Installation Path", value: game.installPath, fullWidth: true }] : []),
  ];

  const desc = useFocusableElement({ id: "dt-desc", region: "detaildesc" });

  return (
    <div>
      {/* ── Hero ── */}
      <div className="relative overflow-hidden" style={{ height: "min(38vh, 430px)", minHeight: 280 }}>
        {data.resolvedBg || data.resolvedCover ? (
          <div key={game.id} className="absolute inset-0 animate-fade-in-slow">
            <img
              src={(data.resolvedBg || data.resolvedCover) || undefined}
              alt=""
              onLoad={() => setHeroFaded(true)}
              className={clsx("w-full h-full transition-opacity duration-500", heroFaded ? "opacity-100" : "opacity-0")}
              style={{ objectFit: "cover", objectPosition: "center 30%" }}
            />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-bg-main to-bg-main" />
        )}

        <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to top, #0F172A 0%, rgba(15,23,42,0.6) 38%, rgba(15,23,42,0.15) 62%, rgba(15,23,42,0.05) 80%)" }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to right, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.1) 45%, transparent 70%)" }} />

        <div className="absolute bottom-0 left-0 right-0 px-5 sm:px-8 pb-5 sm:pb-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0 max-w-full">
              <HeroTitle game={game} logoUrl={data.resolvedLogo} className="text-2xl sm:text-4xl" />
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <PlatformBadge platform={game.platform} />
                {game.isInstalled && <span className="text-xs font-medium text-white/70">Installed</span>}
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                ref={playBtn.ref as React.RefObject<HTMLButtonElement>}
                onClick={onPlay}
                className={`flex items-center gap-2.5 px-5 py-2.5 sm:px-6 sm:py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-semibold text-sm sm:text-base transition-colors shadow-lg shadow-primary/30 ${playBtn.isFocused ? "is-focused" : ""}`}
                {...playBtn.focusableProps}
              >
                <Play size={18} fill="currentColor" />
                {t("common.play")}
              </button>
              <button
                ref={moreBtnRef}
                onClick={() => setMoreOpen((v) => !v)}
                className={`flex items-center gap-2 px-4 py-2.5 sm:py-3 rounded-xl text-white font-medium text-sm transition-colors ${moreBtn.isFocused ? "is-focused" : ""}`}
                style={{ border: "1px solid rgba(255,255,255,0.25)", background: "rgba(0,0,0,0.35)", backdropFilter: "blur(8px)" }}
                {...moreBtn.focusableProps}
              >
                {actions.refreshing ? <RefreshCw size={18} className="animate-spin" /> : <MoreHorizontal size={18} />}
                {t("common.more")}
              </button>
              <button
                ref={favBtn.ref as React.RefObject<HTMLButtonElement>}
                onClick={handleToggleFavorite}
                title={game.isFavorite ? t("game.removeFromFavorites") : t("game.addToFavorites")}
                className={`flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-xl text-white/80 hover:text-white transition-colors ${favBtn.isFocused ? "is-focused" : ""}`}
                style={{ border: "1px solid rgba(255,255,255,0.25)", background: "rgba(0,0,0,0.35)", backdropFilter: "blur(8px)" }}
                {...favBtn.focusableProps}
              >
                <Star size={20} fill={game.isFavorite ? "currentColor" : "none"} className={game.isFavorite ? "text-yellow-400" : ""} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      {/* @container: the two-column split reacts to the pane's real width (sidebars
          shrink it), not the viewport, so the Description column can never starve
          the Details column below its stat cards' minimum width. */}
      <div className="@container mx-auto max-w-5xl px-5 sm:px-8 pt-6 pb-12">
        <div className="grid grid-cols-1 @min-[900px]:grid-cols-[minmax(0,1fr)_360px] gap-x-10 gap-y-8">
          <div className="min-w-0">
            <Section title="Details">
              <div className="flex flex-col @min-[448px]:flex-row @min-[448px]:items-start gap-6 mb-8">
                {data.resolvedCover && (
                  <img
                    src={data.resolvedCover}
                    alt={game.title}
                    className="w-24 h-36 shrink-0 rounded-xl border border-border object-cover shadow-lg"
                  />
                )}
                <div className="flex-1 min-w-0 grid grid-cols-[repeat(auto-fit,minmax(132px,1fr))] gap-3">
                  <FocusStatCard id="dt-stat-playtime" icon={<Clock size={20} className="text-primary" />} label={t("game.playTime")} value={formatPlayTime(data.totalMinutes || game.playTime)} />
                  <FocusStatCard id="dt-stat-days" icon={<Trophy size={20} className="text-primary" />} label={t("game.daysPlayed")} value={tp("format.daysCount", data.daysPlayed)} />
                  <FocusStatCard id="dt-stat-sessions" icon={<Gamepad2 size={20} className="text-primary" />} label={t("game.sessions")} value={tp("format.sessionsCount", data.sessionCount)} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                {detailRows.map((row, i) => (
                  <FocusDetailRow
                    key={row.label}
                    id={`dt-row-${i}`}
                    icon={row.icon}
                    label={row.label}
                    value={row.value}
                    fullWidth={"fullWidth" in row ? row.fullWidth : false}
                  />
                ))}
              </div>
            </Section>
          </div>

          <div
            ref={desc.ref as React.RefObject<HTMLDivElement>}
            {...desc.focusableProps}
            className={clsx("rounded-lg min-w-0", desc.isFocused && "ring-1 ring-primary/40")}
          >
            <Section title="Description">
              {game.description ? (
                <p className="text-sm leading-relaxed text-text-secondary break-words">{game.description}</p>
              ) : (
                <p className="text-sm italic text-text-muted">No description available.</p>
              )}
            </Section>
          </div>
        </div>

        {data.gallery.length > 0 && (
          <div className="mt-2">
            <Section title="Screenshots">
              <div className="flex gap-3 overflow-x-auto overscroll-x-contain pb-2">
                {data.gallery.map((shot, index) => (
                  <ShotThumb
                    key={`${shot.source}-${shot.id}`}
                    shot={shot}
                    resolvedUrl={data.resolvedUrls[shot.url]}
                    index={index}
                    onOpen={(idx) => setLightboxIndex(idx)}
                    region="detailss"
                    idPrefix="dt"
                  />
                ))}
              </div>
            </Section>
          </div>
        )}
      </div>

      {showEditModal && (
        <EditGameModal
          game={game}
          onClose={() => {
            setShowEditModal(false);
            closeSubmodal();
          }}
        />
      )}

      {showManageArtwork && (
        <ManageArtworkModal
          game={game}
          onClose={() => {
            setShowManageArtwork(false);
            closeSubmodal();
          }}
        />
      )}

      {showManageTrailer && (
        <TrailerManagerModal
          game={game}
          onClose={() => {
            setShowManageTrailer(false);
            closeSubmodal();
          }}
          onGameUpdated={(updated) => {
            setSelectedGame(updated);
            useStore.setState((s) => ({ games: s.games.map((g) => (g.id === updated.id ? updated : g)) }));
          }}
        />
      )}

      {showScreenshotManager && (
        <ScreenshotManager
          gameId={game.id}
          screenshots={data.userShots.map((s, i) => ({ id: s.id, url: s.url, localPath: s.source === "user" ? s.url : null, sortOrder: i }))}
          onClose={() => {
            setShowScreenshotManager(false);
            closeSubmodal();
          }}
          onUpdate={(updated) => data.setUserShots(updated.map((s) => ({ id: s.id, url: s.url, source: "user" as const })))}
        />
      )}

      {moreOpen && (
        <GameDetailMoreMenu anchorRef={moreBtnRef} isOpen={moreOpen} onClose={() => setMoreOpen(false)} items={moreItems} />
      )}

      {lightboxIndex !== null && data.gallery[lightboxIndex] && (
        <ScreenshotLightbox
          items={data.gallery}
          index={lightboxIndex}
          resolved={data.resolvedUrls}
          onClose={() => setLightboxIndex(null)}
          onNav={(next) => setLightboxIndex(next)}
          region="detailss"
          idPrefix="dt-lightbox"
        />
      )}
    </div>
  );
}

function FocusStatCard({ id, icon, label, value }: { id: string; icon: React.ReactNode; label: string; value: string }) {
  const { ref, isFocused, focusableProps } = useFocusableElement({ id, region: "detailmeta" });
  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      {...focusableProps}
      className={clsx("h-full min-w-0 rounded-xl", isFocused && "ring-2 ring-primary/60")}
    >
      <StatCard icon={icon} label={label} value={value} />
    </div>
  );
}

function FocusDetailRow({ id, icon, label, value, fullWidth }: { id: string; icon: React.ReactNode; label: string; value: string; fullWidth?: boolean }) {
  const { ref, isFocused, focusableProps } = useFocusableElement({ id, region: "detailmeta" });
  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      {...focusableProps}
      className={clsx("min-w-0 rounded-lg", fullWidth && "md:col-span-2", isFocused && "ring-1 ring-primary/40")}
    >
      <DetailRow icon={icon} label={label} value={value} fullWidth={fullWidth} />
    </div>
  );
}
