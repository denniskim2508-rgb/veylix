import { useState, useEffect, useRef } from "react";
import type { Game, PlaySession, EmulatorProfile } from "../types";
import { ArtworkType } from "../types";
import { useArtwork } from "./useArtwork";
import { resolveShotUrl, mergeScreenshots, type ScreenshotItem } from "../utils/screenshots";
import { calculateDaysPlayed } from "../utils/format";

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

export interface GameDetailData {
  resolvedBg: string | null;
  resolvedCover: string | null;
  resolvedLogo: string | null;
  sessions: PlaySession[];
  totalMinutes: number;
  daysPlayed: number;
  sessionCount: number;
  userShots: ScreenshotItem[];
  providerShots: ScreenshotItem[];
  gallery: ScreenshotItem[];
  resolvedUrls: Record<string, string>;
  compatibleEmulators: EmulatorProfile[];
  isEmulatorGame: boolean;
  setUserShots: (shots: ScreenshotItem[]) => void;
}

export function useGameDetailData(game: Game | null): GameDetailData {
  const resolvedBg = useArtwork(game?.id ?? null, ArtworkType.Background, game?.backgroundImage ?? null).url;
  const resolvedCover = useArtwork(game?.id ?? null, ArtworkType.Cover, game?.coverImage ?? null).url;
  const resolvedLogo = useArtwork(game?.id ?? null, ArtworkType.Logo, game?.logo ?? null).url;

  const [sessions, setSessions] = useState<PlaySession[]>([]);
  const [userShots, setUserShots] = useState<ScreenshotItem[]>([]);
  const [providerShots, setProviderShots] = useState<ScreenshotItem[]>([]);
  const [compatibleEmulators, setCompatibleEmulators] = useState<EmulatorProfile[]>([]);
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});

  const isEmulatorGame = game?.platform === "emulator";
  const gameId = game?.id ?? null;

  useEffect(() => {
    setResolvedUrls({});
  }, [gameId]);

  useEffect(() => {
    setSessions([]);
    setUserShots([]);
    setProviderShots([]);
    setCompatibleEmulators([]);

    if (!gameId) return;

    invoke<PlaySession[]>("get_play_sessions", { gameId })
      .then(setSessions)
      .catch(console.error);

    if (isEmulatorGame) {
      invoke<EmulatorProfile[]>("get_compatible_emulators", { gameId })
        .then(setCompatibleEmulators)
        .catch(() => setCompatibleEmulators([]));
    }
  }, [gameId, isEmulatorGame]);

  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;
    async function loadScreenshots() {
      try {
        const user = await invoke<{ id: number; url: string }[]>("get_screenshots", { gameId });
        if (cancelled) return;
        setUserShots(user.map((s) => ({ id: s.id, url: s.url, source: "user" as const })));

        const cands = await invoke<{ id: number; url: string }[]>("get_artwork_candidates", {
          gameId,
          artworkType: ArtworkType.Screenshot,
        });
        if (cancelled) return;
        const prov = cands.map((c) => ({ id: c.id, url: c.url, source: "provider" as const }));
        setProviderShots(prov);

        if (user.length === 0 && prov.length === 0) {
          await invoke("resolve_screenshots", { gameId }).catch(() => {});
          if (cancelled) return;
          const after = await invoke<{ id: number; url: string }[]>("get_artwork_candidates", {
            gameId,
            artworkType: ArtworkType.Screenshot,
          });
          if (!cancelled) {
            setProviderShots(after.map((c) => ({ id: c.id, url: c.url, source: "provider" as const })));
          }
        }
      } catch (err) {
        console.error("Failed to load screenshots:", err);
      }
    }
    loadScreenshots();
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  const gallery = mergeScreenshots(userShots, providerShots);
  const resolvedSet = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (gameId === null) return;
    resolvedSet.current = new Set();
  }, [gameId]);

  useEffect(() => {
    gallery.forEach((item) => {
      if (resolvedSet.current.has(item.url) || resolvedUrls[item.url]) return;
      resolvedSet.current.add(item.url);
      resolveShotUrl(item.url).then((resolvedUrl) => {
        setResolvedUrls((prev) => (prev[item.url] ? prev : { ...prev, [item.url]: resolvedUrl }));
      });
    });
  }, [gallery, resolvedUrls]);

  const totalMinutes = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const daysPlayed = calculateDaysPlayed(sessions);
  const sessionCount = sessions.length;

  return {
    resolvedBg,
    resolvedCover,
    resolvedLogo,
    sessions,
    totalMinutes,
    daysPlayed,
    sessionCount,
    userShots,
    providerShots,
    gallery,
    resolvedUrls,
    compatibleEmulators,
    isEmulatorGame,
    setUserShots,
  };
}