import { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowLeft,
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

interface GameDetailProps {
  game: Game;
  onClose: () => void;
  onToggleFavorite: () => void;
  onPlay: () => void;
  onDelete: () => void;
}

export function GameDetail({ game, onClose, onToggleFavorite, onPlay, onDelete }: GameDetailProps) {
  const setSelectedGame = useStore((s) => s.setSelectedGame);
  const { t } = useT();

  const [showEditModal, setShowEditModal] = useState(false);
  const [showManageArtwork, setShowManageArtwork] = useState(false);
  const [showManageTrailer, setShowManageTrailer] = useState(false);
  const [showScreenshotManager, setShowScreenshotManager] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [heroFaded, setHeroFaded] = useState(false);

  const moreBtnRef = useRef<HTMLButtonElement>(null);

  const { setActiveRegion, setFocus, goBack } = useNavigation();

  const data = useGameDetailData(game);
  const actions = useGameDetailActions(game);

  const handleClose = useCallback(() => {
    goBack();
    onClose();
  }, [goBack, onClose]);

  const handleToggleFavorite = useCallback(() => {
    onToggleFavorite();
    const fresh = useStore.getState().games.find((g) => g.id === game.id);
    if (fresh) setSelectedGame(fresh);
  }, [onToggleFavorite, game.id, setSelectedGame]);

  const backBtn = useFocusableElement({ id: "detail-back", region: "gamedetail", onClick: handleClose });
  const playBtn = useFocusableElement({ id: "detail-play", region: "gamedetail", onClick: onPlay });
  const moreBtn = useFocusableElement({ id: "detail-more", region: "gamedetail", onClick: () => setMoreOpen((v) => !v) });
  const favBtn = useFocusableElement({ id: "detail-fav", region: "gamedetail", onClick: handleToggleFavorite });

  useEffect(() => {
    setHeroFaded(false);
  }, [game.id]);

  // Route navigation focus into (or out of) the "menu" sentinel while the More
  // menu is open, so global arrows/Enter stay inert and only the menu reacts.
  useEffect(() => {
    if (moreOpen) {
      setActiveRegion("menu");
      setFocus("detail-more-sentinel");
    } else {
      setActiveRegion("gamedetail");
      setFocus("detail-more");
    }
  }, [moreOpen, setActiveRegion, setFocus]);

  // Default focus lands on the Play button when the page opens.
  useEffect(() => {
    setActiveRegion("gamedetail");
    setFocus("detail-play");
  }, [setActiveRegion, setFocus]);

  // B / Escape closes the page — but only when no sub-UI is covering it.
  useEffect(() => {
    const busy = showEditModal || showScreenshotManager || showManageArtwork || showManageTrailer || lightboxIndex !== null || moreOpen;
    if (busy) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "b" || e.key === "B") {
        e.preventDefault();
        e.stopImmediatePropagation();
        handleClose();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [showEditModal, showScreenshotManager, showManageArtwork, showManageTrailer, lightboxIndex, moreOpen, handleClose]);

  const closeSubmodal = () => {
    setActiveRegion("gamedetail");
    setFocus("detail-play");
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

  return (
    <div className="fixed inset-0 z-40 bg-bg-main overflow-y-auto overscroll-contain">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden" style={{ height: "min(55vh, 640px)", minHeight: 430 }}>
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

        <button
          ref={backBtn.ref as React.RefObject<HTMLButtonElement>}
          onClick={handleClose}
          className={`absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 backdrop-blur-md transition-colors ${backBtn.isFocused ? "is-focused" : ""}`}
          style={{ border: "1px solid rgba(255,255,255,0.18)" }}
          {...backBtn.focusableProps}
        >
          <ArrowLeft size={18} />
          <span className="hidden sm:inline text-sm font-medium">Back</span>
        </button>

        <div className="absolute bottom-0 left-0 right-0 px-5 sm:px-8 pb-5 sm:pb-7">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="min-w-0 max-w-full">
              <HeroTitle game={game} logoUrl={data.resolvedLogo} />
              <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                <PlatformBadge platform={game.platform} />
                {game.isInstalled && <span className="text-xs font-medium text-white/70">Installed</span>}
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                ref={playBtn.ref as React.RefObject<HTMLButtonElement>}
                onClick={onPlay}
                className={`flex items-center gap-2.5 px-6 py-3 sm:px-7 sm:py-3.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-semibold text-base sm:text-lg transition-colors shadow-lg shadow-primary/30 ${playBtn.isFocused ? "is-focused" : ""}`}
                {...playBtn.focusableProps}
              >
                <Play size={20} fill="currentColor" />
                {t("common.play")}
              </button>
              <button
                ref={moreBtnRef}
                onClick={() => setMoreOpen((v) => !v)}
                className={`flex items-center gap-2 px-4 py-3 sm:py-3.5 rounded-xl text-white font-medium text-sm transition-colors ${moreBtn.isFocused ? "is-focused" : ""}`}
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
                className={`flex items-center justify-center w-12 h-12 rounded-xl text-white/80 hover:text-white transition-colors ${favBtn.isFocused ? "is-focused" : ""}`}
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
      <div className="relative mx-auto max-w-5xl px-4 sm:px-8 pt-8 pb-16">
        <Section title="Details">
          <div className="flex flex-col md:flex-row gap-6 mb-8">
            {data.resolvedCover && (
              <img
                src={data.resolvedCover}
                alt={game.title}
                className="w-28 h-40 shrink-0 rounded-xl border border-border object-cover shadow-lg"
              />
            )}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <StatCard icon={<Clock size={20} className="text-primary" />} label="Play Time" value={formatPlayTime(data.totalMinutes || game.playTime)} />
              <StatCard icon={<Trophy size={20} className="text-primary" />} label="Days Played" value={data.daysPlayed === 0 ? "0 days" : `${data.daysPlayed} day${data.daysPlayed !== 1 ? "s" : ""}`} />
              <StatCard icon={<Gamepad2 size={20} className="text-primary" />} label="Sessions" value={data.sessionCount === 0 ? "0 sessions" : `${data.sessionCount} session${data.sessionCount !== 1 ? "s" : ""}`} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-5">
            {detailRows.map((row) => (
              <DetailRow key={row.label} icon={row.icon} label={row.label} value={row.value} fullWidth={"fullWidth" in row ? row.fullWidth : false} />
            ))}
          </div>
        </Section>

        <div className="mt-2">
          <Section title="Description">
            {game.description ? (
              <p className="max-w-3xl text-sm leading-relaxed text-text-secondary">{game.description}</p>
            ) : (
              <p className="max-w-3xl text-sm italic text-text-muted">No description available.</p>
            )}
          </Section>
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
        />
      )}
    </div>
  );
}