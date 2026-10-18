import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Game } from "../../types";
import type { GamehubAction } from "../../types/controller";
import { useStore } from "../../store/useStore";
import { useConsoleStore } from "../../store/consoleStore";
import { useControllerStore } from "../../store/controllerStore";
import { subscribeConsoleInput } from "../../utils/consoleInput";
import { uiAudio } from "../../utils/uiAudio";
import { useT } from "../../i18n";
import { useNavFeedback } from "../../hooks/useNavFeedback";
import { ConsoleBackground } from "./ConsoleBackground";
import { ConsoleNavBar } from "./ConsoleNavBar";
import { GameCarousel } from "./GameCarousel";
import { ConsoleInfoPanel, type ConsoleActionControl } from "./ConsoleInfoPanel";
import { VerticalLogoUi } from "./VerticalLogoUi";
import { ConsoleQuickMenu } from "./ConsoleQuickMenu";
import { ConsoleSearchOverlay } from "./ConsoleSearchOverlay";
import { ConsoleSettingsOverlay } from "./ConsoleSettingsOverlay";
import { WallpaperPickerModal } from "./WallpaperPickerModal";
import { ConsoleMoreMenu } from "./ConsoleMoreMenu";
import { TrailerManagerModal } from "../TrailerManagerModal";
import { MetadataProvidersModal } from "../MetadataProvidersModal";

type FocusArea = "nav" | "carousel" | "actions";
type Overlay = "quick" | "search" | "settings" | "more" | "trailer" | "providers" | "wallpaper-static" | "wallpaper-live" | null;

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

export function ConsoleMode() {
  const games = useStore((s) => s.games);
  const removeGame = useStore((s) => s.removeGame);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const setViewMode = useStore((s) => s.setViewMode);
  const setSelectedGame = useStore((s) => s.setSelectedGame);
  const cardSize = useConsoleStore((s) => s.cardSize);
  const uiStyle = useConsoleStore((s) => s.uiStyle);
  const trailerMuted = useConsoleStore((s) => s.trailerMuted);
  const trailerLoop = useConsoleStore((s) => s.trailerLoop);
  const wallpaperMode = useConsoleStore((s) => s.wallpaperMode);
  const staticWallpaperPath = useConsoleStore((s) => s.staticWallpaperPath);
  const liveWallpaperPath = useConsoleStore((s) => s.liveWallpaperPath);
  const wallpaperAudio = useConsoleStore((s) => s.wallpaperAudio);
  const setWallpaperMode = useConsoleStore((s) => s.setWallpaperMode);
  const setStaticWallpaper = useConsoleStore((s) => s.setStaticWallpaper);
  const setLiveWallpaper = useConsoleStore((s) => s.setLiveWallpaper);
  const exitConsole = useConsoleStore((s) => s.exitConsole);
  const getButtonLabel = useControllerStore((s) => s.getButtonLabel);
  const { t, tp } = useT();

  const [section, setSection] = useState<string>("all");
  const [navIndex, setNavIndex] = useState(0);
  const [focusArea, setFocusArea] = useState<FocusArea>("carousel");
  const [actionIndex, setActionIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [overlay, setOverlay] = useState<Overlay>(null);
  // Bumped after the provider settings close so the hero logo re-resolves
  // (picking up a newly added SteamGridDB key) without leaving Console Mode.
  const [logoEpoch, setLogoEpoch] = useState(0);

  // Navigation ticks — fire on real focus moves (controller + keyboard both
  // funnel through these indices, so duplicates are naturally prevented).
  // A section change resets the carousel without a nav tick (it plays the
  // distinct selection sound instead).
  useNavFeedback(navIndex);
  useNavFeedback(selectedIndex, { resetKey: section });
  useNavFeedback(actionIndex);

  const navItems = useMemo(() => {
    return [
      {
        id: "all",
        label:
          games.length === 0
            ? t("sidebar.allGames")
            : tp("console.navAllGames", games.length),
      },
      { id: "search", label: t("common.search") },
      { id: "settings", label: t("settings.title") },
      { id: "favorites", label: t("sidebar.favorites") },
      { id: "exit", label: t("console.navExit") },
    ];
  }, [games, t, tp]);

  const sectionGames = useMemo(() => {
    if (!games.length) return [];
    if (section === "all") return games;
    if (section === "favorites") return games.filter((g) => g.isFavorite);
    return games.filter((g) => g.platform === section);
  }, [games, section]);

  const selectedGame = sectionGames[selectedIndex] ?? null;

  // Keep the selection valid when the filtered list changes.
  useEffect(() => {
    setSelectedIndex((i) => {
      if (sectionGames.length === 0) return 0;
      return Math.min(i, sectionGames.length - 1);
    });
  }, [sectionGames.length]);

  const changeSection = useCallback((next: string) => {
    setSection(next);
    setSelectedIndex(0);
    void uiAudio.playUiSound("select");
  }, []);

  // Console entry chime — plays once when the mode mounts (~150ms in, timed
  // with the background fade). The ref survives React StrictMode's dev
  // double-mount so the chime never double-plays, and remounts do not happen
  // when overlays open/close, so it never replays mid-session.
  const entryPlayedRef = useRef(false);
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (entryPlayedRef.current) return;
      entryPlayedRef.current = true;
      void uiAudio.playUiSound("entry");
    }, 150);
    return () => window.clearTimeout(t);
  }, []);

  // ── Fullscreen window handling ─────────────────────────────────────────
  useEffect(() => {
    let restored = false;
    (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const win = getCurrentWindow();
        if (!(await win.isFullscreen())) {
          await win.setFullscreen(true);
        }
      } catch (err) {
        console.warn("Console fullscreen failed:", err);
      }
    })();
    return () => {
      if (restored) return;
      restored = true;
      (async () => {
        try {
          const { getCurrentWindow } = await import("@tauri-apps/api/window");
          await getCurrentWindow().setFullscreen(false);
        } catch (err) {
          console.warn("Fullscreen restore failed:", err);
        }
      })();
    };
  }, []);

  const handlePlay = useCallback(async (game: Game | null) => {
    if (!game) return;
    if (!game.launchCommand && !game.executablePath) {
      console.warn("No executable for game:", game.title);
      void uiAudio.playUiSound("error");
      return;
    }
    try {
      if (game.launchCommand) {
        await invoke("launch_game", {
          launchCommand: game.launchCommand,
          executablePath: game.executablePath,
        });
      } else {
        await invoke("launch_game", {
          launchCommand: game.executablePath,
          executablePath: null,
        });
      }
      void uiAudio.playUiSound("launch");
    } catch (err) {
      console.error(`Launch failed: ${game.title}`, err);
      void uiAudio.playUiSound("error");
    }
  }, []);

  const openFolder = useCallback(async (game: Game | null) => {
    if (!game) return;
    const dir = game.installPath || (game.executablePath ? game.executablePath.replace(/[\\/][^\\/]*$/, "") : null);
    if (!dir) return;
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(dir);
    } catch (err) {
      console.error("Open folder failed:", err);
    }
  }, []);

  const removeFromLibrary = useCallback(async (game: Game | null) => {
    if (!game) return;
    try {
      await invoke("delete_game", { gameId: game.id });
      removeGame(game.id);
    } catch (err) {
      console.error("Delete failed:", err);
    }
  }, [removeGame]);

  const viewDetails = useCallback(async (game: Game | null) => {
    if (!game) return;
    void uiAudio.playUiSound("close");
    setSelectedGame(game);
    setViewMode("details");
    await exitConsole();
  }, [setSelectedGame, setViewMode, exitConsole]);

  // ── Main navigation reducer ────────────────────────────────────────────
  const reduceMain = useCallback((action: GamehubAction) => {
    const n = navItems.length;

    if (focusArea === "nav") {
      switch (action) {
        case "left": setNavIndex((i) => (i - 1 + n) % n); break;
        case "right": setNavIndex((i) => (i + 1) % n); break;
        case "down": setFocusArea("carousel"); break;
        case "up": setFocusArea("actions"); break;
        case "confirm": {
          const item = navItems[navIndex];
          if (item.id === "search") { void uiAudio.playUiSound("open"); setOverlay("search"); }
          else if (item.id === "settings") { void uiAudio.playUiSound("open"); setOverlay("settings"); }
          else if (item.id === "exit") { void uiAudio.playUiSound("close"); exitConsole(); }
          else { changeSection(item.id); setFocusArea("carousel"); }
          break;
        }
        case "cancel": setFocusArea("carousel"); break;
        case "menu": setOverlay("quick"); break;
        default: break;
      }
    } else if (focusArea === "actions") {
      switch (action) {
        case "left": setActionIndex((i) => Math.max(0, i - 1)); break;
        case "right": setActionIndex((i) => Math.min(2, i + 1)); break;
        case "up": setFocusArea("carousel"); break;
        case "down": setFocusArea("nav"); break;
        case "confirm": {
          if (actionIndex === 0) handlePlay(selectedGame);
          else if (actionIndex === 1) { void uiAudio.playUiSound("open"); setOverlay("more"); }
          else if (actionIndex === 2 && selectedGame) { void uiAudio.playUiSound("confirm"); toggleFavorite(selectedGame.id); }
          break;
        }
        case "cancel": setFocusArea("carousel"); break;
        case "menu": setOverlay("quick"); break;
        default: break;
      }
    } else if (uiStyle === "vertical") {
      // Vertical Logo UI: up/down walk the logo list, left/right hop to nav or actions.
      switch (action) {
        case "up": setSelectedIndex((i) => (sectionGames.length ? Math.max(0, i - 1) : 0)); break;
        case "down": setSelectedIndex((i) => (sectionGames.length ? Math.min(sectionGames.length - 1, i + 1) : 0)); break;
        case "left": setFocusArea("nav"); break;
        case "right": setFocusArea("actions"); break;
        case "leftShoulder": setSelectedIndex((i) => Math.max(0, i - 6)); break;
        case "rightShoulder": setSelectedIndex((i) => Math.min(sectionGames.length - 1, i + 6)); break;
        case "confirm": void uiAudio.playUiSound("select"); setFocusArea("actions"); break;
        case "cancel": void uiAudio.playUiSound("open"); setOverlay("quick"); break;
        case "secondaryAction": void uiAudio.playUiSound("open"); setOverlay("quick"); break;
        case "menu": void uiAudio.playUiSound("open"); setOverlay("quick"); break;
        default: break;
      }
    } else {
      // carousel (Standard Console UI)
      switch (action) {
        case "left":
          setSelectedIndex((i) => (sectionGames.length ? Math.max(0, i - 1) : 0));
          break;
        case "right":
          setSelectedIndex((i) => (sectionGames.length ? Math.min(sectionGames.length - 1, i + 1) : 0));
          break;
        case "leftShoulder":
          setSelectedIndex((i) => Math.max(0, i - 12));
          break;
        case "rightShoulder":
          setSelectedIndex((i) => Math.min(sectionGames.length - 1, i + 12));
          break;
        case "up": setFocusArea("nav"); break;
        case "down": setFocusArea("actions"); break;
        case "confirm": void uiAudio.playUiSound("select"); setOverlay("more"); break;
        case "cancel": void uiAudio.playUiSound("open"); setOverlay("quick"); break;
        case "secondaryAction": void uiAudio.playUiSound("open"); setOverlay("quick"); break;
        case "menu": void uiAudio.playUiSound("open"); setOverlay("quick"); break;
        default: break;
      }
    }
  }, [focusArea, overlay, navItems, navIndex, sectionGames.length, actionIndex, selectedGame, handlePlay, toggleFavorite, changeSection, exitConsole, uiStyle]);

  useEffect(() => subscribeConsoleInput(reduceMain), [reduceMain]);

  // ── Physical keyboard → same reducer ───────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (overlay) return;
      const map: Partial<Record<string, GamehubAction>> = {
        ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
        Enter: "confirm", " ": "confirm", Escape: "cancel",
      };
      const action = map[e.key];
      if (action) {
        e.preventDefault();
        reduceMain(action);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overlay, reduceMain]);

  // Closing provider settings re-resolves the current hero logo so a newly
  // added SteamGridDB key takes effect immediately. The providers panel owns
  // its own controller input while it is open.
  const closeProviders = useCallback(() => {
    setOverlay(null);
    setLogoEpoch((e) => e + 1);
  }, []);

  // Applying a wallpaper saves the referenced file path AND switches the mode so
  // it shows immediately. Removing clears the path and reverts to Default only
  // if that mode was active. A game's own trailer assignment is never touched.
  const applyStaticWallpaper = useCallback(
    async (path: string) => {
      await setStaticWallpaper(path);
      await setWallpaperMode("static");
    },
    [setStaticWallpaper, setWallpaperMode],
  );

  const removeStaticWallpaper = useCallback(async () => {
    await setStaticWallpaper("");
    if (useConsoleStore.getState().wallpaperMode === "static") await setWallpaperMode("default");
  }, [setStaticWallpaper, setWallpaperMode]);

  const applyLiveWallpaper = useCallback(
    async (path: string) => {
      await setLiveWallpaper(path);
      await setWallpaperMode("live");
    },
    [setLiveWallpaper, setWallpaperMode],
  );

  const removeLiveWallpaper = useCallback(async () => {
    await setLiveWallpaper("");
    if (useConsoleStore.getState().wallpaperMode === "live") await setWallpaperMode("default");
  }, [setLiveWallpaper, setWallpaperMode]);

  let focusedAction: ConsoleActionControl | null = null;
  if (focusArea === "actions") {
    focusedAction = actionIndex === 0 ? "play" : actionIndex === 1 ? "more" : "favorite";
  }

  const handleMoreClose = () => setOverlay(null);
  const handleOverlayClose = () => setOverlay(null);

  return (
    <div className="fixed inset-0 z-[80] bg-black overflow-hidden select-none">
      <ConsoleBackground
        game={selectedGame}
        muted={trailerMuted}
        loop={trailerLoop}
        wallpaperMode={wallpaperMode}
        staticWallpaperPath={staticWallpaperPath}
        liveWallpaperPath={liveWallpaperPath}
        liveAudio={wallpaperAudio}
      />

      <ConsoleNavBar
        items={navItems}
        activeSection={section}
        focusedIndex={navIndex}
        isFocused={focusArea === "nav"}
        onSelect={(i) => {
          setNavIndex(i);
          const item = navItems[i];
          if (item.id === "search") { void uiAudio.playUiSound("open"); setOverlay("search"); }
          else if (item.id === "settings") { void uiAudio.playUiSound("open"); setOverlay("settings"); }
          else if (item.id === "exit") { void uiAudio.playUiSound("close"); exitConsole(); }
          else changeSection(item.id);
        }}
        onHover={(i) => setNavIndex(i)}
      />

      {/* Bottom stack: featured info (title + controls) directly above the
          carousel, which stays anchored to the bottom edge. */}
      {uiStyle === "vertical" ? (
        <VerticalLogoUi
          games={sectionGames}
          selectedIndex={selectedIndex}
          isFocused={focusArea === "carousel"}
          actionFocused={focusArea === "actions"}
          focusedAction={focusedAction}
          onSelect={setSelectedIndex}
          onActivate={() => { void uiAudio.playUiSound("select"); setFocusArea("actions"); }}
          onPlay={() => handlePlay(selectedGame)}
          onToggleFavorite={() => {
            if (!selectedGame) return;
            void uiAudio.playUiSound("confirm");
            toggleFavorite(selectedGame.id);
          }}
          onOpenMore={() => { void uiAudio.playUiSound("open"); setOverlay("more"); }}
          logoEpoch={logoEpoch}
          hints={
            <>
              <span><b className="text-white/70">{getButtonLabel("up")}{getButtonLabel("down")}</b> {t("console.hintBrowse")}</span>
              <span><b className="text-white/70">{getButtonLabel("confirm")}</b> {t("console.hintSelect")}</span>
              <span><b className="text-white/70">{getButtonLabel("cancel")}</b> {t("console.hintMenu")}</span>
            </>
          }
        />
      ) : (
        <div className="absolute inset-x-0 bottom-0 pb-5 lg:pb-7">
          <div className="flex flex-col gap-3">
            {selectedGame && (
              <ConsoleInfoPanel
                key={`${selectedGame.id}-${logoEpoch}`}
                game={selectedGame}
                focusArea={focusArea === "actions" || focusArea === "carousel" ? focusArea : "carousel"}
                focusedAction={focusedAction}
                onPlay={() => handlePlay(selectedGame)}
                onToggleFavorite={() => { void uiAudio.playUiSound("confirm"); toggleFavorite(selectedGame.id); }}
                onOpenMore={() => { void uiAudio.playUiSound("open"); setOverlay("more"); }}
                hints={
                  <>
                    <span><b className="text-white/70">{getButtonLabel("left")}{getButtonLabel("right")}</b> {t("console.hintBrowse")}</span>
                    <span><b className="text-white/70">{getButtonLabel("confirm")}</b> {t("console.hintSelect")}</span>
                    <span><b className="text-white/70">{getButtonLabel("cancel")}</b> {t("console.hintMenu")}</span>
                  </>
                }
              />
            )}
            <GameCarousel
              games={sectionGames}
              selectedIndex={selectedIndex}
              cardSize={cardSize}
              isFocused={focusArea === "carousel"}
              onSelect={setSelectedIndex}
              onActivate={() => { void uiAudio.playUiSound("select"); setOverlay("more"); }}
            />
          </div>
        </div>
      )}

      {overlay === "quick" && (
        <ConsoleQuickMenu
          onClose={handleOverlayClose}
          onOpenSearch={() => setOverlay("search")}
          onOpenSettings={() => setOverlay("settings")}
          onExitToDesktop={() => exitConsole()}
        />
      )}
      {overlay === "search" && (
        <ConsoleSearchOverlay
          games={games}
          onClose={handleOverlayClose}
          onSelect={(game) => {
            if (section === "all") {
              const idx = sectionGames.findIndex((g) => g.id === game.id);
              setSelectedIndex(Math.max(0, idx));
            } else {
              setSection("all");
              setSelectedIndex(Math.max(0, games.findIndex((g) => g.id === game.id)));
            }
            setSelectedGame(game);
            setOverlay(null);
          }}
        />
      )}
      {overlay === "settings" && (
        <ConsoleSettingsOverlay
          onClose={handleOverlayClose}
          onOpenMetadataProviders={() => setOverlay("providers")}
          onOpenStaticWallpaper={() => setOverlay("wallpaper-static")}
          onOpenLiveWallpaper={() => setOverlay("wallpaper-live")}
        />
      )}
      {overlay === "wallpaper-static" && (
        <WallpaperPickerModal
          kind="static"
          assignedPath={staticWallpaperPath}
          onApply={(path) => { void applyStaticWallpaper(path); }}
          onRemove={() => { void removeStaticWallpaper(); }}
          onClose={() => setOverlay("settings")}
        />
      )}
      {overlay === "wallpaper-live" && (
        <WallpaperPickerModal
          kind="live"
          assignedPath={liveWallpaperPath}
          audioEnabled={wallpaperAudio}
          onApply={(path) => { void applyLiveWallpaper(path); }}
          onRemove={() => { void removeLiveWallpaper(); }}
          onClose={() => setOverlay("settings")}
        />
      )}
      {overlay === "more" && selectedGame && (
        <ConsoleMoreMenu
          game={selectedGame}
          onClose={handleMoreClose}
          onPlay={() => handlePlay(selectedGame)}
          onToggleFavorite={() => toggleFavorite(selectedGame.id)}
          onManageTrailer={() => setOverlay("trailer")}
          onViewDetails={() => viewDetails(selectedGame)}
          onOpenFolder={() => openFolder(selectedGame)}
          onRemove={() => removeFromLibrary(selectedGame)}
        />
      )}
      {overlay === "providers" && (
        <MetadataProvidersModal onClose={closeProviders} />
      )}
      {overlay === "trailer" && selectedGame && (
        <TrailerManagerModal
          game={selectedGame}
          onClose={handleMoreClose}
          onGameUpdated={(updated) => {
            useStore.setState((s) => ({ games: s.games.map((g) => (g.id === updated.id ? updated : g)) }));
          }}
        />
      )}
    </div>
  );
}