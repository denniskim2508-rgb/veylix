import { create } from "zustand";
import type { Update } from "@tauri-apps/plugin-updater";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "uptodate"
  | "available"
  | "downloading"
  | "installing"
  | "error";

interface UpdateState {
  status: UpdateStatus;
  latestVersion: string | null;
  notes: string | null;
  progress: number;
  error: string | null;
  pending: Update | null;
  check: () => Promise<void>;
  install: () => Promise<void>;
  reset: () => void;
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
  status: "idle",
  latestVersion: null,
  notes: null,
  progress: 0,
  error: null,
  pending: null,

  reset: () =>
    set({ status: "idle", latestVersion: null, notes: null, progress: 0, error: null, pending: null }),

  check: async () => {
    if (get().status === "checking") return;
    set({ status: "checking", error: null, progress: 0, pending: null });
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();
      if (!update) {
        set({ status: "uptodate", latestVersion: null, notes: null, pending: null });
        return;
      }
      set({
        status: "available",
        latestVersion: update.version,
        notes: update.body ?? null,
        pending: update,
      });
    } catch (err) {
      set({ status: "error", error: toMessage(err), pending: null });
    }
  },

  install: async () => {
    const update = get().pending;
    if (!update || get().status !== "available") return;
    set({ status: "downloading", progress: 0, error: null });
    try {
      let downloaded = 0;
      let contentLength = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          contentLength = event.data.contentLength ?? 0;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          set({
            progress:
              contentLength > 0
                ? Math.min(100, Math.round((downloaded / contentLength) * 100))
                : 0,
          });
        } else {
          set({ status: "installing", progress: 100 });
        }
      });
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (err) {
      set({ status: "error", error: toMessage(err) });
    }
  },
}));
