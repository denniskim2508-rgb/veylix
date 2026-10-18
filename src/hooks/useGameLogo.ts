import { useState, useEffect, useRef } from "react";
import type { Game, ArtworkCandidate } from "../types";
import { ArtworkType } from "../types";
import { resolveArtworkUrl } from "../utils/artwork";

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

/**
 * Resolves a game's transparent title logo for the console hero.
 *
 * Asks the artwork resolver for the logo once per game per session. The
 * resolver is idempotent and self-healing: it returns the cached logo when it
 * is still reachable, and re-resolves (dropping the stale row) when it is not.
 * Falls back to the game's stored `logo` (or null) when no valid logo exists.
 */
export function useGameLogo(game: Game | null): { url: string | null; loading: boolean } {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const attempted = useRef<Set<number>>(new Set());

  const gameId = game?.id ?? null;
  const fallback = game?.logo ?? null;

  useEffect(() => {
    if (!gameId) {
      setUrl(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    // A local artwork file (uploaded or downloaded) is a deliberate choice:
    // use it directly, mirroring the resolver's own "artwork/ → skip" rule,
    // so stale auto-resolved candidates can never override it.
    const localFallback = fallback && fallback.startsWith("artwork/") ? fallback : null;
    if (localFallback) {
      setLoading(true);
      resolveArtworkUrl(localFallback)
        .then((resolved) => {
          if (!cancelled) setUrl(resolved);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => { cancelled = true; };
    }

    setLoading(true);

    // Debounce so rapid carousel scrolling only resolves the settled game.
    const timer = window.setTimeout(async () => {
      try {
        // Ask the resolver once per game per session. It is idempotent and
        // self-healing: it returns the cached logo when reachable and
        // re-resolves when the cached one is broken.
        if (!attempted.current.has(gameId)) {
          attempted.current.add(gameId);
          await invoke("resolve_game_artwork", {
            gameId,
            artworkType: ArtworkType.Logo,
          }).catch(() => {});
        }

        if (cancelled) return;
        const candidates = await invoke<ArtworkCandidate[]>("get_artwork_candidates", {
          gameId,
          artworkType: ArtworkType.Logo,
        });

        if (cancelled) return;
        const source =
          candidates.find((c) => c.isPrimary)?.url ?? candidates[0]?.url ?? fallback;
        setUrl(await resolveArtworkUrl(source));
      } catch {
        if (cancelled) return;
        setUrl(await resolveArtworkUrl(fallback));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [gameId, fallback]);

  return { url, loading };
}
