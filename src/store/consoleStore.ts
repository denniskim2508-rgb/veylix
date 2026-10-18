import { create } from "zustand";
import type { StartupMode, ConsoleCardSize, ConsoleWallpaperMode, ConsoleUiStyle } from "../types";

const KEY_STARTUP_MODE = "startup_mode";
const KEY_LAST_MODE = "last_mode";
const KEY_CARD_SIZE = "console_card_size";
const KEY_UI_STYLE = "console_ui_style";
const KEY_TRAILER_MUTED = "trailer_muted";
const KEY_TRAILER_LOOP = "trailer_loop";
const KEY_WALLPAPER_MODE = "console_wallpaper_mode";
const KEY_WALLPAPER_STATIC = "console_wallpaper_static";
const KEY_WALLPAPER_LIVE = "console_wallpaper_live";
const KEY_WALLPAPER_AUDIO = "console_wallpaper_audio";
const KEY_UI_SOUNDS_ENABLED = "ui_sounds_enabled";
const KEY_UI_SOUND_ENTRY = "ui_sound_entry";
const KEY_UI_SOUND_NAVIGATION = "ui_sound_navigation";
const KEY_UI_SOUND_SELECTION = "ui_sound_selection";
const KEY_UI_SOUND_VOLUME = "ui_sound_volume";

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

export type ActiveMode = "desktop" | "console";

interface ConsoleStore {
  settingsLoaded: boolean;
  startupMode: StartupMode;
  activeMode: ActiveMode;
  lastMode: ActiveMode;
  cardSize: ConsoleCardSize;
  uiStyle: ConsoleUiStyle;
  trailerMuted: boolean;
  trailerLoop: boolean;
  // Global Console wallpaper (reference to a user-chosen file, never copied)
  wallpaperMode: ConsoleWallpaperMode;
  staticWallpaperPath: string;
  liveWallpaperPath: string;
  wallpaperAudio: boolean;
  // Console Audio settings
  uiSoundsEnabled: boolean;
  uiSoundEntry: boolean;
  uiSoundNavigation: boolean;
  uiSoundSelection: boolean;
  uiSoundVolume: number;
  loadSettings: () => Promise<void>;
  setStartupMode: (mode: StartupMode) => Promise<void>;
  setCardSize: (size: ConsoleCardSize) => Promise<void>;
  setUiStyle: (style: ConsoleUiStyle) => Promise<void>;
  setTrailerMuted: (muted: boolean) => Promise<void>;
  setTrailerLoop: (loop: boolean) => Promise<void>;
  setWallpaperMode: (mode: ConsoleWallpaperMode) => Promise<void>;
  setStaticWallpaper: (path: string) => Promise<void>;
  setLiveWallpaper: (path: string) => Promise<void>;
  setWallpaperAudio: (enabled: boolean) => Promise<void>;
  setUiSoundsEnabled: (enabled: boolean) => Promise<void>;
  setUiSoundEntry: (enabled: boolean) => Promise<void>;
  setUiSoundNavigation: (enabled: boolean) => Promise<void>;
  setUiSoundSelection: (enabled: boolean) => Promise<void>;
  setUiSoundVolume: (volume: number) => Promise<void>;
  enterConsole: () => Promise<void>;
  exitConsole: () => Promise<void>;
}

const DEFAULT_VOLUME = 70;

export const useConsoleStore = create<ConsoleStore>((set) => ({
  settingsLoaded: false,
  startupMode: "desktop",
  activeMode: "desktop",
  lastMode: "console",
  cardSize: "large",
  uiStyle: "standard",
  trailerMuted: true,
  trailerLoop: true,
  wallpaperMode: "default",
  staticWallpaperPath: "",
  liveWallpaperPath: "",
  wallpaperAudio: false,
  uiSoundsEnabled: true,
  uiSoundEntry: true,
  uiSoundNavigation: true,
  uiSoundSelection: true,
  uiSoundVolume: DEFAULT_VOLUME,

  loadSettings: async () => {
    const map: Record<string, string> = await invoke("get_all_app_settings");
    const startup = (map[KEY_STARTUP_MODE] as StartupMode | undefined) || "desktop";
    const last = (map[KEY_LAST_MODE] as ActiveMode | undefined) || "desktop";
    const card = (map[KEY_CARD_SIZE] as ConsoleCardSize | undefined) || "large";
    const uiStyle: ConsoleUiStyle = map[KEY_UI_STYLE] === "vertical" ? "vertical" : "standard";
    const wallpaper = normalizeWallpaperMode(map[KEY_WALLPAPER_MODE]);

    const initial: ActiveMode =
      startup === "console" ? "console" : startup === "last" ? last : "desktop";

    set({
      settingsLoaded: true,
      startupMode: startup,
      lastMode: last,
      cardSize: card,
      uiStyle,
      trailerMuted: map[KEY_TRAILER_MUTED] !== "0",
      trailerLoop: map[KEY_TRAILER_LOOP] !== "0",
      wallpaperMode: wallpaper,
      staticWallpaperPath: map[KEY_WALLPAPER_STATIC] ?? "",
      liveWallpaperPath: map[KEY_WALLPAPER_LIVE] ?? "",
      wallpaperAudio: map[KEY_WALLPAPER_AUDIO] === "1",
      uiSoundsEnabled: map[KEY_UI_SOUNDS_ENABLED] !== "0",
      uiSoundEntry: map[KEY_UI_SOUND_ENTRY] !== "0",
      uiSoundNavigation: map[KEY_UI_SOUND_NAVIGATION] !== "0",
      uiSoundSelection: map[KEY_UI_SOUND_SELECTION] !== "0",
      uiSoundVolume: clampVolume(Number(map[KEY_UI_SOUND_VOLUME])),
      activeMode: initial,
    });
  },

  setStartupMode: async (mode) => {
    await invoke("set_app_setting", { key: KEY_STARTUP_MODE, value: mode });
    set({ startupMode: mode });
  },

  setCardSize: async (size) => {
    await invoke("set_app_setting", { key: KEY_CARD_SIZE, value: size });
    set({ cardSize: size });
  },

  setUiStyle: async (style) => {
    await invoke("set_app_setting", { key: KEY_UI_STYLE, value: style });
    set({ uiStyle: style });
  },

  setTrailerMuted: async (muted) => {
    await invoke("set_app_setting", { key: KEY_TRAILER_MUTED, value: muted ? "1" : "0" });
    set({ trailerMuted: muted });
  },

  setTrailerLoop: async (loop) => {
    await invoke("set_app_setting", { key: KEY_TRAILER_LOOP, value: loop ? "1" : "0" });
    set({ trailerLoop: loop });
  },

  setWallpaperMode: async (mode) => {
    await invoke("set_app_setting", { key: KEY_WALLPAPER_MODE, value: mode });
    set({ wallpaperMode: mode });
  },

  setStaticWallpaper: async (path) => {
    await invoke("set_app_setting", { key: KEY_WALLPAPER_STATIC, value: path });
    set({ staticWallpaperPath: path });
  },

  setLiveWallpaper: async (path) => {
    await invoke("set_app_setting", { key: KEY_WALLPAPER_LIVE, value: path });
    set({ liveWallpaperPath: path });
  },

  setWallpaperAudio: async (enabled) => {
    await invoke("set_app_setting", { key: KEY_WALLPAPER_AUDIO, value: enabled ? "1" : "0" });
    set({ wallpaperAudio: enabled });
  },

  setUiSoundsEnabled: async (enabled) => {
    await invoke("set_app_setting", { key: KEY_UI_SOUNDS_ENABLED, value: enabled ? "1" : "0" });
    set({ uiSoundsEnabled: enabled });
  },

  setUiSoundEntry: async (enabled) => {
    await invoke("set_app_setting", { key: KEY_UI_SOUND_ENTRY, value: enabled ? "1" : "0" });
    set({ uiSoundEntry: enabled });
  },

  setUiSoundNavigation: async (enabled) => {
    await invoke("set_app_setting", { key: KEY_UI_SOUND_NAVIGATION, value: enabled ? "1" : "0" });
    set({ uiSoundNavigation: enabled });
  },

  setUiSoundSelection: async (enabled) => {
    await invoke("set_app_setting", { key: KEY_UI_SOUND_SELECTION, value: enabled ? "1" : "0" });
    set({ uiSoundSelection: enabled });
  },

  setUiSoundVolume: async (volume) => {
    const clamped = clampVolume(volume);
    await invoke("set_app_setting", { key: KEY_UI_SOUND_VOLUME, value: String(clamped) });
    set({ uiSoundVolume: clamped });
  },

  enterConsole: async () => {
    await invoke("set_app_setting", { key: KEY_LAST_MODE, value: "console" });
    set({ activeMode: "console", lastMode: "console" });
  },

  exitConsole: async () => {
    await invoke("set_app_setting", { key: KEY_LAST_MODE, value: "desktop" });
    set({ activeMode: "desktop", lastMode: "desktop" });
  },
}));

export function isConsoleActive(): boolean {
  return useConsoleStore.getState().activeMode === "console";
}

function clampVolume(v: number): number {
  if (Number.isNaN(v)) return DEFAULT_VOLUME;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function normalizeWallpaperMode(value: string | undefined): ConsoleWallpaperMode {
  return value === "static" || value === "live" ? value : "default";
}