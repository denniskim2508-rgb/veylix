import { useEffect, useCallback, useRef, useState } from "react";
import { useStore } from "./store/useStore";
import { useControllerStore } from "./store/controllerStore";
import { useConsoleStore } from "./store/consoleStore";
import { useI18nStore } from "./i18n";
import { Layout } from "./components/Layout";
import { SplashScreen } from "./components/SplashScreen";
import { ConsoleMode } from "./components/console/ConsoleMode";
import { GamepadProvider } from "./components/GamepadProvider";
import { NavigationProvider, useNavigation } from "./components/NavigationProvider";
import { useControllerInput } from "./hooks/useControllerInput";
import { usePlaytimeTracking } from "./hooks/usePlaytimeTracking";
import { emitConsoleAction } from "./utils/consoleInput";
import type { GamehubAction } from "./types/controller";
import type { Game, Drive } from "./types";

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

function dispatchKey(key: string) {
  window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

function ControllerInputBridge() {
  const { handleAction } = useNavigation();
  const isMenuOpenRef = useRef(false);
  const repeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastAxisDir = useRef<string | null>(null);
  const settings = useControllerStore((s) => s.settings);
  const setInputMethod = useControllerStore((s) => s.setInputMethod);
  const activeMode = useConsoleStore((s) => s.activeMode);

  useEffect(() => {
    const check = () => {
      isMenuOpenRef.current = !!document.querySelector("[data-menu-root]");
    };
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const clearRepeat = useCallback(() => {
    if (repeatTimerRef.current) { clearTimeout(repeatTimerRef.current); repeatTimerRef.current = null; }
    if (repeatIntervalRef.current) { clearInterval(repeatIntervalRef.current); repeatIntervalRef.current = null; }
    lastAxisDir.current = null;
  }, []);

  const startRepeat = useCallback((action: GamehubAction) => {
    clearRepeat();
    if (activeMode === "console") {
      emitConsoleAction(action);
    } else {
      const key = action === "left" ? "ArrowLeft" : "ArrowRight";
      dispatchKey(key);
    }
    repeatTimerRef.current = setTimeout(() => {
      repeatIntervalRef.current = setInterval(() => {
        if (activeMode === "console") {
          emitConsoleAction(action);
        } else {
          dispatchKey(action === "left" ? "ArrowLeft" : "ArrowRight");
        }
      }, settings.repeatRate);
    }, settings.repeatDelay);
  }, [clearRepeat, activeMode, settings.repeatDelay, settings.repeatRate]);

  const onAction = useCallback((action: GamehubAction, pressed: boolean) => {
    if (!pressed) { return; }

    setInputMethod("controller");

    if (activeMode === "console") {
      emitConsoleAction(action);
      return;
    }

    if (isMenuOpenRef.current) {
      const menuMap: Record<string, string> = {
        up: "ArrowDown", down: "ArrowUp", left: "ArrowLeft", right: "ArrowRight",
        confirm: "Enter", cancel: "Escape", secondaryAction: "Escape",
      };
      if (menuMap[action]) {
        dispatchKey(menuMap[action]);
        return;
      }
    }

    handleAction(action);
  }, [handleAction, activeMode, setInputMethod]);

  const onAxis = useCallback((_axis: string, value: number) => {
    if (isMenuOpenRef.current && activeMode === "desktop") return;

    const threshold = settings.stickThreshold;
    let dir: GamehubAction | null = null;
    if (Math.abs(value) > threshold) {
      dir = value > 0 ? "right" : "left";
    }

    if (dir && dir !== lastAxisDir.current) {
      startRepeat(dir);
    } else if (!dir) {
      clearRepeat();
    }
  }, [settings.stickThreshold, startRepeat, clearRepeat, activeMode]);

  useControllerInput(onAction, onAxis);

  useEffect(() => {
    return () => clearRepeat();
  }, [clearRepeat]);

  return null;
}

function KeyboardNavigation() {
  const { handleAction } = useNavigation();
  const setInputMethod = useControllerStore((s) => s.setInputMethod);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.isTrusted) return;

      // Don't intercept when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const actionMap: Partial<Record<string, GamehubAction>> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
        Enter: "confirm",
        " ": "confirm",
        Escape: "cancel",
      };

      if (actionMap[e.key]) {
        e.preventDefault();
        setInputMethod("keyboard");
        const action = actionMap[e.key];
        if (action) handleAction(action);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleAction, setInputMethod]);

  return null;
}

function AppInner() {
  const { setGames, setDrives, setIsLoading } = useStore();
  const activeMode = useConsoleStore((s) => s.activeMode);
  const settingsLoaded = useConsoleStore((s) => s.settingsLoaded);
  const loadSettings = useConsoleStore((s) => s.loadSettings);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const i18nLoaded = useI18nStore((s) => s.loaded);
  const language = useI18nStore((s) => s.language);
  const [dataReady, setDataReady] = useState(false);
  const [splashElapsed, setSplashElapsed] = useState(false);
  const [splashPhase, setSplashPhase] = useState<"show" | "out" | "done">("show");

  usePlaytimeTracking();

  useEffect(() => {
    loadSettings();
    useStore.getState().loadPreferences().finally(() => setPrefsLoaded(true));
    useI18nStore.getState().loadLanguage();
  }, [loadSettings]);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const drives = await invoke<Drive[]>("get_drives");
        setDrives(drives);

        const games = await invoke<Game[]>("get_games");
        setGames(games);
      } catch (err) {
        console.error("Failed to load data:", err);
      } finally {
        setIsLoading(false);
        setDataReady(true);
      }
    }
    loadData();
  }, [setGames, setDrives, setIsLoading]);

  // Hold the splash long enough for the intro + hold to actually be seen, then
  // fade out only once the real work (settings, i18n, library data) has finished.
  useEffect(() => {
    const t = setTimeout(() => setSplashElapsed(true), 1000);
    return () => clearTimeout(t);
  }, []);

  const splashReady =
    settingsLoaded && prefsLoaded && i18nLoaded && dataReady && splashElapsed;

  // Each completed startup gate moves the bar forward; the minimum-display
  // timer completes it. If a gate stalls, the bar stalls with it — it never
  // claims progress that hasn't happened.
  const splashProgress =
    ((settingsLoaded ? 1 : 0) +
      (prefsLoaded ? 1 : 0) +
      (i18nLoaded ? 1 : 0) +
      (dataReady ? 1 : 0)) *
      22.5 +
    (splashElapsed ? 10 : 0);

  useEffect(() => {
    if (!splashReady) return;
    // Start the fade and unmount on the next tick so the state update is not
    // applied synchronously inside the effect body.
    const fade = setTimeout(() => setSplashPhase("out"), 0);
    const hide = setTimeout(() => setSplashPhase("done"), 420);
    return () => {
      clearTimeout(fade);
      clearTimeout(hide);
    };
  }, [splashReady]);

  if (splashPhase === "show") {
    return (
      <>
        <ControllerInputBridge />
        <SplashScreen lang={language} progress={splashProgress} className="veylix-splash-in" />
      </>
    );
  }

  return (
    <>
      <ControllerInputBridge />
      {activeMode === "console" ? <ConsoleMode /> : <><KeyboardNavigation /><Layout /></>}
      {splashPhase === "out" && (
        <SplashScreen lang={language} progress={splashProgress} className="veylix-splash-out" />
      )}
    </>
  );
}

function App() {
  return (
    <GamepadProvider>
      <NavigationProvider>
        <AppInner />
      </NavigationProvider>
    </GamepadProvider>
  );
}

export default App;
