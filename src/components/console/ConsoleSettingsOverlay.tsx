import { useEffect, useState } from "react";
import type { StartupMode, ConsoleCardSize, ConsoleWallpaperMode, ConsoleUiStyle } from "../../types";
import type { GamehubAction } from "../../types/controller";
import { useControllerStore } from "../../store/controllerStore";
import { useConsoleStore } from "../../store/consoleStore";
import { setConsoleOverlayHandler } from "../../utils/consoleInput";
import { uiAudio, type UiSoundName } from "../../utils/uiAudio";
import { fileNameFromPath } from "../../utils/trailer";
import { useT } from "../../i18n";
import { useNavFeedback } from "../../hooks/useNavFeedback";
import clsx from "clsx";

interface ConsoleSettingsOverlayProps {
  onClose: () => void;
  onOpenMetadataProviders?: () => void;
  onOpenStaticWallpaper?: () => void;
  onOpenLiveWallpaper?: () => void;
}

interface SettingsRow {
  id: string;
  label: string;
  value: string;
  section: string;
  sfx?: UiSoundName;
  /** Action rows open something (confirm/click) instead of cycling a value. */
  action?: boolean;
  adjust: (dir: -1 | 1) => void;
  /** Only used by action rows: what confirm/click should do. */
  onActivate?: () => void;
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

const STARTUP_CYCLE: StartupMode[] = ["desktop", "console", "last"];
const CARD_CYCLE: ConsoleCardSize[] = ["small", "medium", "large", "extralarge"];
const WALLPAPER_CYCLE: ConsoleWallpaperMode[] = ["default", "static", "live"];
const UI_STYLE_CYCLE: ConsoleUiStyle[] = ["standard", "vertical"];

function clampVolume(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function ConsoleSettingsOverlay({ onClose, onOpenMetadataProviders, onOpenStaticWallpaper, onOpenLiveWallpaper }: ConsoleSettingsOverlayProps) {
  const [index, setIndex] = useState(0);
  const [sgdbConfigured, setSgdbConfigured] = useState(false);
  const getButtonLabel = useControllerStore((s) => s.getButtonLabel);
  const { t } = useT();
  const {
    startupMode,
    cardSize,
    uiStyle,
    trailerMuted,
    trailerLoop,
    wallpaperMode,
    staticWallpaperPath,
    liveWallpaperPath,
    wallpaperAudio,
    uiSoundsEnabled,
    uiSoundEntry,
    uiSoundNavigation,
    uiSoundSelection,
    uiSoundVolume,
    setStartupMode,
    setCardSize,
    setUiStyle,
    setTrailerMuted,
    setTrailerLoop,
    setWallpaperMode,
    setWallpaperAudio,
    setUiSoundsEnabled,
    setUiSoundEntry,
    setUiSoundNavigation,
    setUiSoundSelection,
    setUiSoundVolume,
  } = useConsoleStore();

  useNavFeedback(index);

  const startupLabels: Record<StartupMode, string> = {
    desktop: t("settings.startup.desktop"),
    console: t("settings.startup.console"),
    last: t("settings.startup.last"),
  };
  const cardSizeLabels: Record<ConsoleCardSize, string> = {
    small: t("console.cardSizeSmall"),
    medium: t("console.cardSizeMedium"),
    large: t("console.cardSizeLarge"),
    extralarge: t("console.cardSizeExtraLarge"),
  };
  const wallpaperModeLabels: Record<ConsoleWallpaperMode, string> = {
    default: t("console.wallpaperDefault"),
    static: t("console.wallpaperStatic"),
    live: t("console.wallpaperLive"),
  };
  const uiStyleLabels: Record<ConsoleUiStyle, string> = {
    standard: t("console.uiStyleStandard"),
    vertical: t("console.uiStyleVertical"),
  };

  useEffect(() => {
    invoke<Record<string, unknown>>("get_plugin_settings", { pluginId: "steamgriddb" })
      .then((settings) => {
        const key = settings.api_key;
        setSgdbConfigured(key === true || (typeof key === "string" && key.length > 0));
      })
      .catch(() => {});
  }, []);

  const rows: SettingsRow[] = [
    {
      id: "startup",
      label: t("console.startupMode"),
      value: startupLabels[startupMode],
      section: t("console.sectionGeneral"),
      adjust: (dir) => {
        const i = STARTUP_CYCLE.indexOf(startupMode);
        setStartupMode(STARTUP_CYCLE[(i + dir + STARTUP_CYCLE.length) % STARTUP_CYCLE.length]);
      },
    },
    {
      id: "cardsize",
      label: t("console.cardSize"),
      value: cardSizeLabels[cardSize],
      section: t("console.sectionGeneral"),
      adjust: (dir) => {
        const i = CARD_CYCLE.indexOf(cardSize);
        setCardSize(CARD_CYCLE[(i + dir + CARD_CYCLE.length) % CARD_CYCLE.length]);
      },
    },
    {
      id: "ui-style",
      label: t("console.consoleUiStyle"),
      value: uiStyleLabels[uiStyle],
      section: t("console.sectionGeneral"),
      adjust: (dir) => {
        const i = UI_STYLE_CYCLE.indexOf(uiStyle);
        setUiStyle(UI_STYLE_CYCLE[(i + dir + UI_STYLE_CYCLE.length) % UI_STYLE_CYCLE.length]);
      },
    },
    {
      id: "trailer-sound",
      label: t("console.trailerSound"),
      value: trailerMuted ? t("common.muted") : t("common.on"),
      section: t("console.sectionGeneral"),
      adjust: () => setTrailerMuted(!trailerMuted),
    },
    {
      id: "trailer-loop",
      label: t("console.loopTrailers"),
      value: trailerLoop ? t("common.on") : t("common.off"),
      section: t("console.sectionGeneral"),
      adjust: () => setTrailerLoop(!trailerLoop),
    },
    {
      id: "wallpaper-mode",
      label: t("console.wallpaperMode"),
      value: wallpaperModeLabels[wallpaperMode],
      section: t("console.sectionWallpaper"),
      adjust: (dir) => {
        const i = WALLPAPER_CYCLE.indexOf(wallpaperMode);
        setWallpaperMode(WALLPAPER_CYCLE[(i + dir + WALLPAPER_CYCLE.length) % WALLPAPER_CYCLE.length]);
      },
    },
    {
      id: "wallpaper-static",
      label: t("console.chooseStaticWallpaper"),
      value: staticWallpaperPath ? fileNameFromPath(staticWallpaperPath) : t("common.notSet"),
      section: t("console.sectionWallpaper"),
      action: true,
      adjust: () => {},
      onActivate: () => onOpenStaticWallpaper?.(),
    },
    {
      id: "wallpaper-live",
      label: t("console.chooseLiveWallpaper"),
      value: liveWallpaperPath ? fileNameFromPath(liveWallpaperPath) : t("common.notSet"),
      section: t("console.sectionWallpaper"),
      action: true,
      adjust: () => {},
      onActivate: () => onOpenLiveWallpaper?.(),
    },
    {
      id: "wallpaper-audio",
      label: t("console.liveWallpaperSound"),
      value: wallpaperAudio ? t("common.on") : t("common.muted"),
      section: t("console.sectionWallpaper"),
      adjust: () => setWallpaperAudio(!wallpaperAudio),
    },
    {
      id: "providers",
      label: t("console.metadataProviders"),
      value: sgdbConfigured ? t("common.configured") : t("common.notSet"),
      section: t("console.sectionMetadata"),
      action: true,
      adjust: () => {},
      onActivate: () => onOpenMetadataProviders?.(),
    },
    {
      id: "ui-sounds",
      label: t("console.uiSounds"),
      value: uiSoundsEnabled ? t("common.on") : t("common.off"),
      section: t("console.sectionAudio"),
      sfx: undefined,
      adjust: () => setUiSoundsEnabled(!uiSoundsEnabled),
    },
    {
      id: "ui-entry",
      label: t("console.consoleEntrySound"),
      value: uiSoundEntry ? t("common.on") : t("common.off"),
      section: t("console.sectionAudio"),
      adjust: () => setUiSoundEntry(!uiSoundEntry),
    },
    {
      id: "ui-navigation",
      label: t("console.navigationSounds"),
      value: uiSoundNavigation ? t("common.on") : t("common.off"),
      section: t("console.sectionAudio"),
      adjust: () => setUiSoundNavigation(!uiSoundNavigation),
    },
    {
      id: "ui-selection",
      label: t("console.selectionConfirmation"),
      value: uiSoundSelection ? t("common.on") : t("common.off"),
      section: t("console.sectionAudio"),
      adjust: () => setUiSoundSelection(!uiSoundSelection),
    },
    {
      id: "ui-volume",
      label: t("console.uiSoundVolume"),
      value: `${uiSoundVolume}%`,
      section: t("console.sectionAudio"),
      sfx: "nav",
      adjust: (dir) => {
        const next = clampVolume(uiSoundVolume + dir * 5);
        void setUiSoundVolume(next);
        uiAudio.setMasterVolume(next);
      },
    },
    {
      id: "ui-preview",
      label: t("console.previewSounds"),
      value: t("common.play"),
      section: t("console.sectionAudio"),
      sfx: undefined,
      adjust: () => uiAudio.preview(),
    },
  ];

  const move = (dir: 1 | -1) =>
    setIndex((i) => (i + dir + rows.length) % rows.length);

  const adjustRow = (row: SettingsRow, dir: -1 | 1) => {
    row.adjust(dir);
    const sfx = row.sfx === undefined ? "confirm" : row.sfx;
    if (sfx) void uiAudio.playUiSound(sfx);
  };

  const activateRow = (row: SettingsRow) => {
    if (row.action) {
      void uiAudio.playUiSound("open");
      row.onActivate?.();
      return;
    }
    adjustRow(row, 1);
  };

  const changeRow = (dir: -1 | 1) => {
    const row = rows[index];
    if (row.action) return;
    adjustRow(row, dir);
  };

  const close = () => {
    void uiAudio.playUiSound("close");
    onClose();
  };

  const handleAction = (a: GamehubAction): boolean => {
    switch (a) {
      case "down": move(1); return true;
      case "up": move(-1); return true;
      case "left": changeRow(-1); return true;
      case "right": changeRow(1); return true;
      case "confirm": activateRow(rows[index]); return true;
      case "cancel": close(); return true;
      default: return false;
    }
  };

  useEffect(() => {
    setIndex(0);
  }, []);

  useEffect(() => {
    setConsoleOverlayHandler(handleAction);
    return () => setConsoleOverlayHandler(null);
  }, [rows, index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); e.stopPropagation(); move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); e.stopPropagation(); move(-1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); e.stopPropagation(); changeRow(-1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); e.stopPropagation(); changeRow(1); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); activateRow(rows[index]); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
      <div
        className="relative w-[460px] max-w-[92vw] max-h-[86vh] overflow-y-auto rounded-2xl bg-[#111827]/95 border border-white/15 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="px-5 pt-4 pb-2 text-xs font-semibold uppercase tracking-widest text-white/40">
          {t("console.settingsTitle")}
        </p>
        <div className="py-1">
          {rows.map((row, i) => {
            const focused = i === index;
            const showHeader = i === 0 || rows[i - 1].section !== row.section;
            return (
              <div key={row.id}>
                {showHeader && (
                  <p className="px-5 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                    {row.section}
                  </p>
                )}
                <div
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => activateRow(row)}
                  className={clsx(
                    "w-full flex items-center justify-between gap-4 px-5 py-3 transition-colors cursor-pointer",
                    focused ? "bg-white text-black" : "text-white/85 hover:bg-white/10"
                  )}
                >
                  <span className="text-sm font-medium">{row.label}</span>
                  <span className={clsx(
                    "text-sm font-semibold tabular-nums",
                    focused ? "text-black" : "text-white/50"
                  )}>
                    {row.value}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="sticky bottom-0 flex items-center gap-4 px-5 py-3 border-t border-white/10 bg-[#111827]/95 text-[11px] text-white/45">
          <span>
            <span className="inline-block w-4 text-center font-bold">{getButtonLabel("left")}</span>
            <span className="inline-block w-4 text-center font-bold">{getButtonLabel("right")}</span> {t("console.hintChange")}
          </span>
          <span>
            <span className="inline-block w-4 text-center font-bold">{getButtonLabel("cancel")}</span> {t("common.back")}
          </span>
        </div>
      </div>
    </div>
  );
}