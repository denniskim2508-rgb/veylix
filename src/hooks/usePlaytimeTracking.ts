import { useEffect } from "react";
import type { Game } from "../types";
import { useStore } from "../store/useStore";

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

/// Refreshes the library whenever a tracked play session ends so play time,
/// last played, days played and the "recent" filter stay in sync.
export function usePlaytimeTracking() {
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    import("@tauri-apps/api/event")
      .then(({ listen }) =>
        listen("play://session-ended", async () => {
          try {
            const games = await invoke<Game[]>("get_games");
            useStore.getState().setGames(games);
          } catch (err) {
            console.error("Failed to refresh games after session end:", err);
          }
          useStore.getState().bumpPlaytime();
        })
      )
      .then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      })
      .catch((err) => console.error("Failed to subscribe to play sessions:", err));

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);
}
