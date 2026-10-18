import { useState, useEffect } from "react";
import { X, Settings, ChevronRight } from "lucide-react";
import type { StartupMode, ViewMode, SortBy } from "../types";
import { useStore } from "../store/useStore";
import { useConsoleStore } from "../store/consoleStore";
import { useUpdateStore } from "../store/updateStore";
import { useT, useI18nStore, LANGUAGES, type Language } from "../i18n";
import { useFocusableElement } from "../hooks/useFocusableElement";
import clsx from "clsx";

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

const STARTUP_CYCLE: StartupMode[] = ["desktop", "console", "last"];
const VIEW_CYCLE: ViewMode[] = ["grid", "list", "details"];
const SORT_CYCLE: SortBy[] = ["title", "lastPlayed", "playTime", "platform"];

function cycle<T>(list: T[], current: T): T {
  const i = list.indexOf(current);
  return list[(i + 1) % list.length];
}

interface SettingsModalProps {
  onClose: () => void;
  onOpenScanFolders: () => void;
  onOpenRomFolders: () => void;
  onOpenEmulators: () => void;
  onOpenMetadataProviders: () => void;
  onOpenAddons: () => void;
  onOpenControllerSettings: () => void;
  onOpenControllerDiagnostics: () => void;
}

function SettingRow({
  id,
  label,
  value,
  chevron,
  onClick,
}: {
  id: string;
  label: string;
  value: React.ReactNode;
  chevron?: boolean;
  onClick: () => void;
}) {
  const { ref, isFocused, focusableProps } = useFocusableElement({ id, region: "modal", onClick });

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      role="button"
      onClick={onClick}
      className={clsx(
        "px-6 py-3 cursor-pointer transition-colors focus-visible:outline-none",
        isFocused ? "is-focused bg-bg-hover" : "hover:bg-bg-hover"
      )}
      {...focusableProps}
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-text-primary">{label}</span>
        <span className="flex items-center gap-1.5 text-sm font-medium text-text-muted">
          {value}
          {chevron && <ChevronRight size={14} className="text-text-muted/60" />}
        </span>
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-6 pt-5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
      {children}
    </p>
  );
}

function SettingSelectRow({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const { ref, focusableProps } = useFocusableElement({ id, region: "modal" });

  return (
    <div className="px-6 py-3">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-text-primary">{label}</span>
        <select
          ref={ref as React.RefObject<HTMLSelectElement>}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="text-sm px-3 py-1.5 rounded-lg border border-border bg-bg-card text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/30"
          {...focusableProps}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function SettingsModal({
  onClose,
  onOpenScanFolders,
  onOpenRomFolders,
  onOpenEmulators,
  onOpenMetadataProviders,
  onOpenAddons,
  onOpenControllerSettings,
  onOpenControllerDiagnostics,
}: SettingsModalProps) {
  const viewMode = useStore((s) => s.viewMode);
  const setViewMode = useStore((s) => s.setViewMode);
  const sortBy = useStore((s) => s.sortBy);
  const setSortBy = useStore((s) => s.setSortBy);

  const { t } = useT();
  const language = useI18nStore((s) => s.language);
  const setLanguage = useI18nStore((s) => s.setLanguage);

  const startupLabels: Record<StartupMode, string> = {
    desktop: t("settings.startup.desktop"),
    console: t("settings.startup.console"),
    last: t("settings.startup.last"),
  };
  const viewLabels: Record<ViewMode, string> = {
    grid: t("settings.view.grid"),
    list: t("settings.view.list"),
    details: t("settings.view.details"),
  };
  const sortLabels: Record<SortBy, string> = {
    title: t("settings.sort.title"),
    lastPlayed: t("settings.sort.lastPlayed"),
    playTime: t("settings.sort.playTime"),
    platform: t("settings.sort.platform"),
  };
  const languageOptions = LANGUAGES.map((l) => ({
    value: l.code,
    label: `${l.nativeName} — ${l.englishName}`,
  }));

  const startupMode = useConsoleStore((s) => s.startupMode);
  const setStartupMode = useConsoleStore((s) => s.setStartupMode);
  const trailerMuted = useConsoleStore((s) => s.trailerMuted);
  const setTrailerMuted = useConsoleStore((s) => s.setTrailerMuted);
  const trailerLoop = useConsoleStore((s) => s.trailerLoop);
  const setTrailerLoop = useConsoleStore((s) => s.setTrailerLoop);

  const [appVersion, setAppVersion] = useState<string | null>(null);

  const updateStatus = useUpdateStore((s) => s.status);
  const latestVersion = useUpdateStore((s) => s.latestVersion);
  const updateNotes = useUpdateStore((s) => s.notes);
  const updateProgress = useUpdateStore((s) => s.progress);
  const checkUpdate = useUpdateStore((s) => s.check);
  const installUpdate = useUpdateStore((s) => s.install);
  const resetUpdate = useUpdateStore((s) => s.reset);

  useEffect(() => () => resetUpdate(), [resetUpdate]);

  useEffect(() => {
    let cancelled = false;
    import("@tauri-apps/api/app")
      .then(({ getVersion }) => getVersion())
      .then((v) => {
        if (!cancelled) setAppVersion(v);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const { ref: closeRef, isFocused: closeFocused, focusableProps: closeProps } = useFocusableElement({
    id: "settings-close",
    region: "modal",
    onClick: onClose,
  });
  const { ref: doneRef, isFocused: doneFocused, focusableProps: doneProps } = useFocusableElement({
    id: "settings-done",
    region: "modal",
    onClick: onClose,
  });

  const handleFullscreen = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      const isFullscreen = await win.isFullscreen();
      await win.setFullscreen(!isFullscreen);
    } catch (err) {
      console.error("Fullscreen toggle failed:", err);
    }
  };

  const handleEnterConsole = async () => {
    await useConsoleStore.getState().enterConsole();
    onClose();
  };

  const handleOpenDataFolder = async () => {
    try {
      const dir = await invoke<string>("get_app_data_dir");
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(dir);
    } catch (err) {
      console.error("Failed to open data folder:", err);
    }
  };

  const handleCheckUpdates = () => {
    void checkUpdate();
  };

  const handleInstallUpdate = () => {
    void installUpdate();
  };

  const updateStatusLabel = {
    idle: "",
    checking: t("settings.checkingForUpdates"),
    uptodate: t("settings.upToDate"),
    available: latestVersion ?? "",
    downloading: `${updateProgress}%`,
    installing: t("settings.installingUpdate"),
    error: t("settings.updateFailed"),
  }[updateStatus];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-xl max-h-[85vh] bg-bg-card rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Settings size={20} className="text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-text-primary">{t("settings.title")}</h2>
          </div>
          <button
            ref={closeRef as React.RefObject<HTMLButtonElement>}
            onClick={onClose}
            className={`p-2 rounded-lg hover:bg-bg-hover text-text-muted transition-colors ${closeFocused ? "is-focused" : ""}`}
            {...closeProps}
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain pb-2">
          <SectionHeader>{t("settings.sections.general")}</SectionHeader>
          <SettingSelectRow
            id="settings-language"
            label={t("settings.language")}
            value={language}
            options={languageOptions}
            onChange={(v) => setLanguage(v as Language)}
          />
          <SettingRow
            id="settings-startup"
            label={t("settings.startupMode")}
            value={startupLabels[startupMode]}
            onClick={() => setStartupMode(cycle(STARTUP_CYCLE, startupMode))}
          />
          <SettingRow
            id="settings-view"
            label={t("settings.defaultView")}
            value={viewLabels[viewMode]}
            onClick={() => setViewMode(cycle(VIEW_CYCLE, viewMode))}
          />
          <SettingRow
            id="settings-sort"
            label={t("settings.defaultSort")}
            value={sortLabels[sortBy]}
            onClick={() => setSortBy(cycle(SORT_CYCLE, sortBy))}
          />
          <SettingRow id="settings-fullscreen" label={t("settings.switchToFullscreen")} value="" chevron onClick={handleFullscreen} />
          <SettingRow id="settings-console" label={t("settings.switchToConsoleMode")} value="" chevron onClick={handleEnterConsole} />

          <SectionHeader>{t("settings.sections.library")}</SectionHeader>
          <SettingRow id="settings-scan" label={t("settings.scanFolders")} value="" chevron onClick={onOpenScanFolders} />
          <SettingRow id="settings-rom" label={t("settings.romScanFolders")} value="" chevron onClick={onOpenRomFolders} />
          <SettingRow id="settings-emulators" label={t("settings.configureEmulators")} value="" chevron onClick={onOpenEmulators} />
          <SettingRow id="settings-providers" label={t("settings.metadataProviders")} value="" chevron onClick={onOpenMetadataProviders} />
          <SettingRow id="settings-addons" label={t("settings.addons")} value="" chevron onClick={onOpenAddons} />

          <SectionHeader>{t("settings.sections.controller")}</SectionHeader>
          <SettingRow id="settings-controller" label={t("settings.controllerSettings")} value="" chevron onClick={onOpenControllerSettings} />
          <SettingRow id="settings-diagnostics" label={t("settings.controllerDiagnostics")} value="" chevron onClick={onOpenControllerDiagnostics} />

          <SectionHeader>{t("settings.sections.media")}</SectionHeader>
          <SettingRow
            id="settings-trailer-sound"
            label={t("settings.trailerSound")}
            value={trailerMuted ? t("common.muted") : t("common.on")}
            onClick={() => setTrailerMuted(!trailerMuted)}
          />
          <SettingRow
            id="settings-trailer-loop"
            label={t("settings.loopTrailers")}
            value={trailerLoop ? t("common.on") : t("common.off")}
            onClick={() => setTrailerLoop(!trailerLoop)}
          />

          <SectionHeader>{t("settings.sections.about")}</SectionHeader>
          <div className="px-6 py-3">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-text-primary">{t("settings.version")}</span>
              <span className="text-sm font-medium text-text-muted tabular-nums">
                {appVersion ?? "…"}
              </span>
            </div>
          </div>
          <SettingRow
            id="settings-check-updates"
            label={t("menu.checkForUpdates")}
            value={updateStatusLabel}
            chevron={updateStatus === "idle"}
            onClick={handleCheckUpdates}
          />
          {updateStatus === "available" && (
            <div className="px-6 pb-3 space-y-3">
              {updateNotes && (
                <p className="text-xs leading-relaxed text-text-muted whitespace-pre-wrap line-clamp-4">
                  {updateNotes}
                </p>
              )}
              <button
                onClick={handleInstallUpdate}
                className="w-full px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors"
              >
                {t("settings.downloadUpdate")}
              </button>
            </div>
          )}
          {updateStatus === "downloading" && (
            <div className="px-6 pb-3">
              <div className="h-1 w-full overflow-hidden rounded-full bg-bg-hover">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${updateProgress}%` }}
                />
              </div>
            </div>
          )}
          <SettingRow id="settings-data-folder" label={t("settings.openDataFolder")} value="" chevron onClick={handleOpenDataFolder} />
        </div>

        <div className="px-6 py-4 border-t border-border shrink-0">
          <button
            ref={doneRef as React.RefObject<HTMLButtonElement>}
            onClick={onClose}
            className={`w-full px-4 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white font-medium transition-colors ${doneFocused ? "is-focused" : ""}`}
            {...doneProps}
          >
            {t("common.done")}
          </button>
        </div>
      </div>
    </div>
  );
}
