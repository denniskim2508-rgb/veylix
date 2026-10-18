import { useState, useEffect } from "react";
import type { ArtworkCandidate, ArtworkType } from "../types";
import { resolveArtworkUrl } from "../utils/artwork";

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

export function useArtwork(
  gameId: number | null,
  artworkType: ArtworkType,
  fallbackUrl?: string | null
): { url: string | null; loading: boolean; candidates: ArtworkCandidate[] } {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<ArtworkCandidate[]>([]);

  useEffect(() => {
    if (!gameId) {
      setUrl(null);
      setLoading(false);
      setCandidates([]);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const result = await invoke<ArtworkCandidate[]>("get_artwork_candidates", {
          gameId,
          artworkType,
        });

        if (cancelled) return;
        setCandidates(result);

        // A local artwork file is a deliberate choice (uploaded or
        // downloaded): mirror the resolver's "artwork/ → skip" rule so stale
        // auto-resolved candidates never override it.
        if (fallbackUrl?.startsWith("artwork/")) {
          const resolved = await resolveArtworkUrl(fallbackUrl);
          if (!cancelled) setUrl(resolved);
          return;
        }

        const primary = result.find((c) => c.isPrimary);
        if (primary) {
          const resolved = await resolveArtworkUrl(primary.url);
          if (!cancelled) setUrl(resolved);
        } else if (fallbackUrl) {
          const resolved = await resolveArtworkUrl(fallbackUrl);
          if (!cancelled) setUrl(resolved);
        } else {
          setUrl(null);
        }
      } catch {
        if (!cancelled) {
          if (fallbackUrl) {
            const resolved = await resolveArtworkUrl(fallbackUrl);
            setUrl(resolved);
          } else {
            setUrl(null);
          }
          setCandidates([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [gameId, artworkType, fallbackUrl]);

  return { url, loading, candidates };
}

export function usePrimaryArtwork(
  gameId: number | null,
  artworkType: ArtworkType,
  fallbackUrl: string | null
): { url: string | null; loading: boolean } {
  const { url: artworkUrl, loading } = useArtwork(gameId, artworkType, fallbackUrl);
  return { url: artworkUrl || fallbackUrl, loading };
}
