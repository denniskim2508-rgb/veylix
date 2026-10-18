import { useState, useEffect } from "react";
import type { Game, ConsoleWallpaperMode } from "../../types";
import { ArtworkType } from "../../types";
import { useArtwork } from "../../hooks/useArtwork";
import { discoverAutoTrailer, resolveTrailerPlaybackUrl } from "../../utils/trailer";

interface ConsoleBackgroundProps {
  game: Game | null;
  muted: boolean;
  loop: boolean;
  wallpaperMode: ConsoleWallpaperMode;
  staticWallpaperPath: string;
  liveWallpaperPath: string;
  liveAudio: boolean;
}

export function ConsoleBackground({
  game,
  muted,
  loop,
  wallpaperMode,
  staticWallpaperPath,
  liveWallpaperPath,
  liveAudio,
}: ConsoleBackgroundProps) {
  const bg = useArtwork(game?.id ?? null, ArtworkType.Background, game?.backgroundImage ?? null);
  const hero = useArtwork(game?.id ?? null, ArtworkType.Hero);
  const cover = useArtwork(game?.id ?? null, ArtworkType.Cover, game?.coverImage ?? null);

  const [trailerUrl, setTrailerUrl] = useState<string | null>(null);
  const [trailerFailed, setTrailerFailed] = useState(false);
  const [trailerResolving, setTrailerResolving] = useState(false);
  // Track which source failed rather than resetting flags in an effect, so a
  // newly chosen wallpaper always gets a fresh chance to play.
  const [failedLiveUrl, setFailedLiveUrl] = useState<string | null>(null);
  const [failedStaticUrl, setFailedStaticUrl] = useState<string | null>(null);

  // Global wallpaper sources (only relevant outside Default/Automatic mode).
  const liveVideoUrl =
    wallpaperMode === "live" && liveWallpaperPath ? resolveTrailerPlaybackUrl(liveWallpaperPath) : null;
  const staticImageUrl =
    wallpaperMode !== "default" && staticWallpaperPath ? resolveTrailerPlaybackUrl(staticWallpaperPath) : null;

  const showLive = wallpaperMode === "live" && !!liveVideoUrl && failedLiveUrl !== liveVideoUrl;
  const showStatic =
    !showLive && wallpaperMode !== "default" && !!staticImageUrl && failedStaticUrl !== staticImageUrl;

  // Per-game trailer discovery only runs in Default/Automatic mode so we never
  // decode a second video alongside a live wallpaper.
  useEffect(() => {
    setTrailerFailed(false);
    setTrailerUrl(null);

    if (wallpaperMode !== "default") return;
    if (!game) return;
    let cancelled = false;

    if (game.trailerPath) {
      setTrailerResolving(false);
      setTrailerUrl(resolveTrailerPlaybackUrl(game.trailerPath));
      return;
    }

    setTrailerResolving(true);
    discoverAutoTrailer(game.id).then((found) => {
      if (cancelled) return;
      setTrailerResolving(false);
      if (found) {
        setTrailerUrl(resolveTrailerPlaybackUrl(found));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [game?.id, game?.trailerPath, wallpaperMode]);

  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        setTrailerUrl((u) => u); // keep state; browser pauses hidden video
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const scrims = (
    <>
      {/* Dark gradient overlays for readability */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.55) 32%, rgba(0,0,0,0.18) 60%, rgba(0,0,0,0.28) 100%)" }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "linear-gradient(to right, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 45%, rgba(0,0,0,0.35) 100%)" }}
      />
    </>
  );

  // ── Global wallpaper backgrounds ───────────────────────────────────────
  if (showLive && liveVideoUrl) {
    return (
      <div className="absolute inset-0 overflow-hidden">
        <video
          key={`wp-live-${liveVideoUrl}`}
          src={liveVideoUrl}
          autoPlay
          loop
          muted={!liveAudio}
          playsInline
          preload="auto"
          onError={() => setFailedLiveUrl(liveVideoUrl)}
          className="absolute inset-0 w-full h-full object-cover animate-fade-in-slow"
          draggable={false}
        />
        {scrims}
      </div>
    );
  }

  if (showStatic && staticImageUrl) {
    return (
      <div className="absolute inset-0 overflow-hidden">
        <img
          key={`wp-static-${staticImageUrl}`}
          src={staticImageUrl}
          alt=""
          onError={() => setFailedStaticUrl(staticImageUrl)}
          className="absolute inset-0 w-full h-full object-cover animate-fade-in-slow"
          draggable={false}
        />
        {scrims}
      </div>
    );
  }

  // ── Default / Automatic: selected game's trailer, then artwork ─────────
  if (!game) {
    return (
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-black" />
    );
  }

  const bgUrl = trailerUrl && !trailerFailed ? trailerUrl : bg.url || hero.url || cover.url || null;

  const imageSource = bgUrl ? (
    <img
      key={`img-${game.id}`}
      src={bgUrl}
      alt=""
      className="absolute inset-0 w-full h-full object-cover animate-fade-in-slow"
      style={{ objectPosition: "center 30%" }}
      draggable={false}
    />
  ) : (
    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-bg-main to-black" />
  );

  return (
    <div className="absolute inset-0 overflow-hidden">
      {trailerUrl && !trailerFailed ? (
        <video
          key={`vid-${game.id}`}
          src={trailerUrl}
          autoPlay
          loop={loop}
          muted={muted}
          playsInline
          preload="auto"
          onError={() => setTrailerFailed(true)}
          onStalled={() => setTrailerResolving(false)}
          onPlaying={() => setTrailerResolving(false)}
          className="absolute inset-0 w-full h-full object-cover animate-fade-in-slow"
          draggable={false}
        />
      ) : (
        imageSource
      )}

      {trailerResolving && imageSource}

      {scrims}
    </div>
  );
}
