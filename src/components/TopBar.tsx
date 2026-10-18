import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  Star,
  SlidersHorizontal,
  ArrowUpDown,
  LayoutGrid,
  List,
  PanelLeft,
  Shuffle,
  ChevronDown,
} from "lucide-react";
import { GameHubMenu } from "./menus/GameHubMenu";
import { useStore } from "../store/useStore";
import { useConsoleStore } from "../store/consoleStore";
import { useUpdateStore } from "../store/updateStore";
import { useT } from "../i18n";
import { useFocusableElement } from "../hooks/useFocusableElement";
import type { MenuContext } from "./menus/menuData";
import type { Platform, SortBy } from "../types";

interface TopBarProps {
  onOpenSettings: () => void;
  onOpenScanFolders: () => void;
  onOpenEmulators: () => void;
  onOpenRomFolders: () => void;
  onOpenAddGame: () => void;
  onOpenMetadataProviders: () => void;
  onScanLibraries: () => void;
  onOpenAddons: () => void;
}

const TOOLBAR_BTN =
  "w-10 h-10 flex items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none";

const TOOLBAR_BTN_ACTIVE =
  "w-10 h-10 flex items-center justify-center rounded-lg bg-white/20 text-white transition-colors focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none";

function ToolbarDivider() {
  return <div className="w-px h-5 bg-white/20 shrink-0" />;
}

export function TopBar({
  onOpenSettings,
  onOpenScanFolders,
  onOpenEmulators,
  onOpenRomFolders,
  onOpenAddGame,
  onOpenMetadataProviders,
  onScanLibraries,
  onOpenAddons,
}: TopBarProps) {
  const {
    searchQuery,
    setSearchQuery,
    toggleSidebar,
    isSidebarCollapsed,
    viewMode,
    setViewMode,
    sortBy,
    setSortBy,
    setActivePlatform,
    getFilteredGames,
    setSelectedGame,
  } = useStore();
  const { t } = useT();

  const inputRef = useRef<HTMLInputElement>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const gamepadRef = useRef<HTMLButtonElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isExtraOpen, setIsExtraOpen] = useState(false);
  const extraRef = useRef<HTMLDivElement>(null);

  const pickRandomGame = useCallback(() => {
    const games = getFilteredGames();
    if (games.length > 0) {
      const random = games[Math.floor(Math.random() * games.length)];
      setSelectedGame(random);
    }
  }, [getFilteredGames, setSelectedGame]);

  const menuBtn = useFocusableElement({ id: "toolbar-menu", region: "toolbar", onClick: () => setIsMenuOpen(!isMenuOpen) });
  const searchBtn = useFocusableElement({ id: "toolbar-search", region: "toolbar", onClick: () => { setIsSearchOpen(true); setTimeout(() => inputRef.current?.focus(), 0); } });
  const favBtn = useFocusableElement({ id: "toolbar-fav", region: "toolbar", onClick: () => { const games = getFilteredGames(); const favs = games.filter((g) => g.isFavorite); if (favs.length > 0) { useStore.getState().setFilterType(useStore.getState().filterType === "favorites" ? "all" : "favorites"); } } });
  const sidebarBtn = useFocusableElement({ id: "toolbar-sidebar", region: "toolbar", onClick: toggleSidebar });
  const sortBtn = useFocusableElement({ id: "toolbar-sort", region: "toolbar", onClick: () => { const cycleSort: SortBy[] = ["title", "lastPlayed", "playTime", "platform"]; const idx = cycleSort.indexOf(sortBy); setSortBy(cycleSort[(idx + 1) % cycleSort.length]); } });
  const detailsBtn = useFocusableElement({ id: "toolbar-details", region: "toolbar", onClick: () => setViewMode("details") });
  const gridBtn = useFocusableElement({ id: "toolbar-grid", region: "toolbar", onClick: () => setViewMode("grid") });
  const listBtn = useFocusableElement({ id: "toolbar-list", region: "toolbar", onClick: () => setViewMode("list") });
  const randomBtn = useFocusableElement({ id: "toolbar-random", region: "toolbar", onClick: pickRandomGame });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => {
          if (!prev) setTimeout(() => inputRef.current?.focus(), 0);
          return !prev;
        });
      }
      if (e.key === "F5") {
        e.preventDefault();
        onScanLibraries();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "r") {
        e.preventDefault();
        pickRandomGame();
      }
      if (e.key === "F11") {
        e.preventDefault();
        handleSwitchFullscreen();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "c" && !(e.target as HTMLElement)?.matches("input,textarea")) {
        e.preventDefault();
        useConsoleStore.getState().enterConsole();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onScanLibraries]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (extraRef.current && !extraRef.current.contains(e.target as Node)) {
        setIsExtraOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSwitchFullscreen = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      const isFullscreen = await win.isFullscreen();
      await win.setFullscreen(!isFullscreen);
    } catch (err) {
      console.error("Fullscreen toggle failed:", err);
    }
  };

  const menuContext: MenuContext = useMemo(
    () => ({
      t,
      onOpenAddGame,
      onOpenScanFolder: onOpenScanFolders,
      onOpenEmulatedGame: onOpenRomFolders,
      onOpenEmulators,
      onOpenRomScanners: onOpenRomFolders,
      onOpenLibrarySources: onOpenScanFolders,
      onOpenMetadataProviders,
      onOpenAddons,
      onOpenSettings,
      onCheckForUpdates: () => {
        onOpenSettings();
        void useUpdateStore.getState().check();
      },
      onScanLibraries,
      onPickRandomGame: pickRandomGame,
      onSwitchFullscreen: handleSwitchFullscreen,
      onSwitchConsole: () => { useConsoleStore.getState().enterConsole(); },
      onSetViewMode: setViewMode,
      onSetSortBy: setSortBy,
      onFilterPlatform: (platform: Platform) => {
        setActivePlatform(platform);
        useStore.getState().setFilterType("all");
      },
      onClose: () => setIsMenuOpen(false),
      currentViewMode: viewMode,
      currentSortBy: sortBy,
    }),
    [
      t,
      onOpenAddGame,
      onOpenSettings,
      onOpenScanFolders,
      onOpenEmulators,
      onOpenRomFolders,
      onOpenMetadataProviders,
      onScanLibraries,
      onOpenAddons,
      setViewMode,
      setSortBy,
      setActivePlatform,
      viewMode,
      sortBy,
    ]
  );

  const sortOptions: { value: SortBy; label: string }[] = [
    { value: "title", label: t("settings.sort.title") },
    { value: "lastPlayed", label: t("settings.sort.lastPlayed") },
    { value: "playTime", label: t("settings.sort.playTime") },
    { value: "platform", label: t("settings.sort.platform") },
  ];

  return (
    <header className="h-14 flex items-center gap-3 px-4 bg-primary shrink-0">
      {/* Left: Menu (brand logo) */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          ref={gamepadRef}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={`${TOOLBAR_BTN} ${menuBtn.isFocused ? "is-focused" : ""}`}
          title={t("topbar.menuTitle")}
          {...menuBtn.focusableProps}
        >
          <img
            src="/veylix-logo.png"
            alt=""
            className="h-5 w-5 shrink-0 rounded-full object-cover ring-1 ring-white/15"
          />
        </button>
      </div>

      {/* Center: Search */}
      <div className="flex-1 flex items-center justify-center max-w-xl mx-auto px-4">
        {isSearchOpen ? (
          <div className="flex items-center flex-1 bg-white/15 border border-white/20 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-white/30 focus-within:bg-white/20 transition-all">
            <button
              onClick={() => {
                setIsSearchOpen(false);
                setSearchQuery("");
              }}
              className="pl-3 pr-1 py-2 text-white/50 hover:text-white/80 transition-colors focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none"
            >
              <Search size={16} />
            </button>
            <input
              ref={inputRef}
              type="text"
              placeholder={t("topbar.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setIsSearchOpen(false);
                  setSearchQuery("");
                }
              }}
              className="w-full pl-1 pr-3 py-2 text-sm bg-transparent text-white placeholder:text-white/50 focus:outline-none"
            />
          </div>
        ) : (
          <button
            onClick={() => {
              setIsSearchOpen(true);
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
            title={t("topbar.searchTitle")}
            className={`${TOOLBAR_BTN} ${searchBtn.isFocused ? "is-focused" : ""}`}
            {...searchBtn.focusableProps}
          >
            <Search size={18} />
          </button>
        )}
      </div>

      {/* Right: Utility controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Group A: Filters */}
        <button
          onClick={() => {
            const games = getFilteredGames();
            const favs = games.filter((g) => g.isFavorite);
            if (favs.length > 0) {
              useStore.getState().setFilterType(
                useStore.getState().filterType === "favorites" ? "all" : "favorites"
              );
            }
          }}
          title={t("topbar.favorites")}
          className={
            useStore.getState().filterType === "favorites"
              ? `${TOOLBAR_BTN_ACTIVE} ${favBtn.isFocused ? "is-focused" : ""}`
              : `${TOOLBAR_BTN} ${favBtn.isFocused ? "is-focused" : ""}`
          }
          {...favBtn.focusableProps}
        >
          <Star size={18} />
        </button>

        <button
          onClick={toggleSidebar}
          title={isSidebarCollapsed ? t("topbar.showSidebar") : t("topbar.hideSidebar")}
          className={`${!isSidebarCollapsed ? TOOLBAR_BTN_ACTIVE : TOOLBAR_BTN} ${sidebarBtn.isFocused ? "is-focused" : ""}`}
          {...sidebarBtn.focusableProps}
        >
          <SlidersHorizontal size={18} />
        </button>

        <ToolbarDivider />

        {/* Group B: Sort + Views + Random */}
        <button
          onClick={() => {
            const cycleSort: SortBy[] = ["title", "lastPlayed", "playTime", "platform"];
            const idx = cycleSort.indexOf(sortBy);
            setSortBy(cycleSort[(idx + 1) % cycleSort.length]);
          }}
          title={t("topbar.sortTitle", { value: sortOptions.find((s) => s.value === sortBy)?.label ?? "" })}
          className={`${TOOLBAR_BTN} ${sortBtn.isFocused ? "is-focused" : ""}`}
          {...sortBtn.focusableProps}
        >
          <ArrowUpDown size={18} />
        </button>

        <button
          onClick={() => setViewMode("details")}
          title={t("topbar.detailsView")}
          className={`${viewMode === "details" ? TOOLBAR_BTN_ACTIVE : TOOLBAR_BTN} ${detailsBtn.isFocused ? "is-focused" : ""}`}
          {...detailsBtn.focusableProps}
        >
          <PanelLeft size={18} />
        </button>

        <button
          onClick={() => setViewMode("grid")}
          title={t("topbar.gridView")}
          className={`${viewMode === "grid" ? TOOLBAR_BTN_ACTIVE : TOOLBAR_BTN} ${gridBtn.isFocused ? "is-focused" : ""}`}
          {...gridBtn.focusableProps}
        >
          <LayoutGrid size={18} />
        </button>

        <button
          onClick={() => setViewMode("list")}
          title={t("topbar.listView")}
          className={`${viewMode === "list" ? TOOLBAR_BTN_ACTIVE : TOOLBAR_BTN} ${listBtn.isFocused ? "is-focused" : ""}`}
          {...listBtn.focusableProps}
        >
          <List size={18} />
        </button>

        <button
          onClick={pickRandomGame}
          title={t("topbar.randomTitle")}
          className={`${TOOLBAR_BTN} ${randomBtn.isFocused ? "is-focused" : ""}`}
          {...randomBtn.focusableProps}
        >
          <Shuffle size={18} />
        </button>

        <ToolbarDivider />

        {/* Group C: System */}
        <div className="relative" ref={extraRef}>
          <button
            onClick={() => setIsExtraOpen(!isExtraOpen)}
            title={t("topbar.moreActions")}
            className={TOOLBAR_BTN}
          >
            <ChevronDown size={18} />
          </button>
          {isExtraOpen && (
            <>
              <div className="fixed inset-0 z-[59]" onClick={() => setIsExtraOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-48 bg-bg-card rounded-xl border border-border shadow-xl overflow-hidden z-[60] py-1">
                <button
                  onClick={() => {
                    onScanLibraries();
                    setIsExtraOpen(false);
                  }}
                  className="w-full px-4 py-2 text-sm text-text-primary hover:bg-bg-hover text-left"
                >
                  {t("topbar.updateLibrary")}
                </button>
                <button
                  onClick={() => {
                    handleSwitchFullscreen();
                    setIsExtraOpen(false);
                  }}
                  className="w-full px-4 py-2 text-sm text-text-primary hover:bg-bg-hover text-left"
                >
                  {t("topbar.toggleFullscreen")}
                </button>
                <button
                  onClick={() => {
                    useConsoleStore.getState().enterConsole();
                    setIsExtraOpen(false);
                  }}
                  className="w-full px-4 py-2 text-sm text-text-primary hover:bg-bg-hover text-left"
                >
                  {t("topbar.switchToConsoleMode")}
                </button>
                <div className="my-1 border-t border-border" />
                <button
                  onClick={() => {
                    onOpenSettings();
                    setIsExtraOpen(false);
                  }}
                  className="w-full px-4 py-2 text-sm text-text-primary hover:bg-bg-hover text-left"
                >
                  {t("topbar.settings")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <GameHubMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        anchorRef={gamepadRef}
        context={menuContext}
      />
    </header>
  );
}
