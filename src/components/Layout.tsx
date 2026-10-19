import { useState, useEffect, useRef } from "react";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { GameGrid } from "./GameGrid";
import { GameIcon } from "./GameIcon";
import { GameDetail } from "./GameDetail";
import { DetailsPane } from "./DetailsPane";
import { AddGameModal } from "./AddGameModal";
import { ScanFoldersModal } from "./ScanFoldersModal";
import { EmulatorModal } from "./EmulatorModal";
import { RomScanFoldersModal } from "./RomScanFoldersModal";
import { MetadataProvidersModal } from "./MetadataProvidersModal";
import { ControllerDiagnostics } from "./ControllerDiagnostics";
import { ControllerSettingsModal } from "./ControllerSettingsModal";
import { SettingsModal } from "./SettingsModal";
import { AddonModal } from "./addons/AddonModal";
import { useStore } from "../store/useStore";
import { useNavigation } from "./NavigationProvider";
import { useT, currentLocale } from "../i18n";
import { formatPlayTime } from "../utils/format";
import { useFocusableElement } from "../hooks/useFocusableElement";
import { Gamepad2, FolderPlus, ScanSearch } from "lucide-react";
import type { Game, SortBy } from "../types";
import clsx from "clsx";

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

export function Layout() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showScanFoldersModal, setShowScanFoldersModal] = useState(false);
  const [showEmulatorModal, setShowEmulatorModal] = useState(false);
  const [showRomScanFoldersModal, setShowRomScanFoldersModal] = useState(false);
  const [showMetadataProvidersModal, setShowMetadataProvidersModal] = useState(false);
  const [showControllerDiagnostics, setShowControllerDiagnostics] = useState(false);
  const [showAddonModal, setShowAddonModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showControllerSettings, setShowControllerSettings] = useState(false);
  const {
    selectedGame,
    setSelectedGame,
    toggleFavorite,
    getFilteredGames,
    setGames,
    searchQuery,
    sortBy,
    setSortBy,
    viewMode,
    setIsLoading,
    removeGame,
  } = useStore();
  const { t, tp } = useT();

  const { goBack, setActiveRegion, setFocus, pushStack } = useNavigation();
  const prevViewMode = useRef(viewMode);
  const isScanningRef = useRef(false);

  useEffect(() => {
    if (viewMode === "grid" && !selectedGame) {
      setActiveRegion("gamegrid");
    }
  }, [viewMode, selectedGame, setActiveRegion]);

  useEffect(() => {
    if (viewMode === "details" && prevViewMode.current !== "details") {
      setActiveRegion("library");
      const target = selectedGame
        ? `detail-lib-${selectedGame.id}`
        : filteredGames.length > 0
          ? `detail-lib-${filteredGames[0].id}`
          : null;
      if (target) setFocus(target);
    }
    prevViewMode.current = viewMode;
  }, [viewMode, selectedGame, setActiveRegion, setFocus]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Try navigation manager first (for controller-triggered escapes)
        if (goBack()) return;
        // Fallback: keyboard escape handling
        if (showControllerDiagnostics) { setShowControllerDiagnostics(false); return; }
        if (showAddonModal) { setShowAddonModal(false); return; }
        if (showMetadataProvidersModal) { setShowMetadataProvidersModal(false); return; }
        if (showRomScanFoldersModal) { setShowRomScanFoldersModal(false); return; }
        if (showEmulatorModal) { setShowEmulatorModal(false); return; }
        if (showControllerSettings) { setShowControllerSettings(false); return; }
        if (showScanFoldersModal) { setShowScanFoldersModal(false); return; }
        if (showAddModal) { setShowAddModal(false); return; }
        if (showSettingsModal) { setShowSettingsModal(false); return; }
        if (selectedGame && viewMode !== "details") { setSelectedGame(null); return; }
      }
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault();
        setShowControllerDiagnostics((v) => !v);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showControllerDiagnostics, showAddonModal, showMetadataProvidersModal, showRomScanFoldersModal, showEmulatorModal, showScanFoldersModal, showAddModal, showSettingsModal, showControllerSettings, selectedGame, viewMode, setSelectedGame, goBack]);

  const filteredGames = getFilteredGames();

  const handlePlay = (game: Game) => {
    if (game.launchCommand) {
      invoke("launch_game", {
        gameId: game.id,
        launchCommand: game.launchCommand,
        executablePath: game.executablePath,
      }).catch((err) => {
        console.error("Launch failed:", err);
        alert(`Failed to launch ${game.title}: ${err}`);
      });
    } else if (game.executablePath) {
      invoke("launch_game", {
        gameId: game.id,
        launchCommand: game.executablePath,
        executablePath: null,
      }).catch((err) => {
        console.error("Launch failed:", err);
        alert(`Failed to launch ${game.title}: ${err}`);
      });
    } else {
      console.warn("No launch command or executable path for game:", game.title);
      alert(`Cannot launch ${game.title}: no executable found. Try re-scanning your library.`);
    }
  };

  const handleScan = async () => {
    if (isScanningRef.current) return;
    isScanningRef.current = true;
    setIsLoading(true);
    try {
      await invoke<Game[]>("scan_libraries");
      const allGames = await invoke<Game[]>("get_games");
      setGames(allGames);
    } catch (err) {
      console.error("Scan failed:", err);
    } finally {
      isScanningRef.current = false;
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col">
        <TopBar
          onOpenSettings={() => setShowSettingsModal(true)}
          onOpenScanFolders={() => setShowScanFoldersModal(true)}
          onOpenEmulators={() => setShowEmulatorModal(true)}
          onOpenRomFolders={() => setShowRomScanFoldersModal(true)}
          onOpenAddGame={() => setShowAddModal(true)}
          onOpenMetadataProviders={() => setShowMetadataProvidersModal(true)}
          onScanLibraries={handleScan}
          onOpenAddons={() => setShowAddonModal(true)}
        />
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {viewMode === "grid" && (
            <>
              <HeroSection
                gameCount={filteredGames.length}
                searchQuery={searchQuery}
                sortBy={sortBy}
                onSortChange={setSortBy}
                onScan={handleScan}
                onAddGame={() => setShowAddModal(true)}
              />

              {filteredGames.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-text-muted">
                  <Gamepad2 size={64} className="mb-4 opacity-30" />
                  <h3 className="text-lg font-medium text-text-secondary mb-1">{t("library.noGames")}</h3>
                  <p className="text-sm text-center max-w-md">
                    {t("library.noGamesHint1")}
                    <br />
                    {t("library.noGamesHint2")}
                  </p>
                </div>
              ) : (
                <GameGrid
                  games={filteredGames}
                  onGameClick={(game) => setSelectedGame(game)}
                  onToggleFavorite={toggleFavorite}
                />
              )}
            </>
          )}

          {viewMode === "list" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-6 pt-4 pb-2">
                <div>
                  <h1 className="text-xl font-bold text-text-primary">{t("library.title")}</h1>
                  <p className="text-sm text-text-muted">
                    {tp("library.gameCount", filteredGames.length)}
                    {searchQuery && ` ${t("library.matching", { query: searchQuery })}`}
                  </p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto overflow-x-auto overscroll-contain px-6">
                <table className="w-full">
                  <thead className="sticky top-0 bg-bg-main">
                    <tr className="text-left text-xs text-text-muted border-b border-border">
                      <th className="pb-2 font-medium">{t("library.colTitle")}</th>
                      <th className="pb-2 font-medium">{t("library.colPlatform")}</th>
                      <th className="pb-2 font-medium">{t("library.colPlayTime")}</th>
                      <th className="pb-2 font-medium">{t("library.colLastPlayed")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGames.map((game) => (
                      <tr
                        key={game.id}
                        tabIndex={0}
                        onClick={() => setSelectedGame(game)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedGame(game);
                          }
                        }}
                        className="cursor-pointer hover:bg-bg-hover border-b border-border-light transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                      >
                        <td className="py-3 text-sm text-text-primary font-medium">
                          <div className="flex items-center gap-2.5">
                            <GameIcon
                              game={game}
                              className="w-6 h-6 rounded bg-bg-hover overflow-hidden shrink-0"
                              fallbackClassName="text-[10px] text-text-muted"
                            />
                            <span className="truncate">{game.title}</span>
                          </div>
                        </td>
                        <td className="py-3 text-sm text-text-secondary">{game.platform}</td>
                        <td className="py-3 text-sm text-text-secondary">
                          {game.playTime > 0 ? formatPlayTime(game.playTime) : "-"}
                        </td>
                        <td className="py-3 text-sm text-text-secondary">
                          {game.lastPlayed ? new Date(game.lastPlayed).toLocaleDateString(currentLocale()) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {viewMode === "details" && (
            <div className="flex h-full overflow-hidden">
              <div className="w-64 lg:w-96 border-r border-border overflow-y-auto overscroll-contain shrink-0 flex flex-col">
                <div className="px-4 pt-4 pb-2 shrink-0">
                  <h1 className="text-lg font-bold text-text-primary">{t("library.title")}</h1>
                  <p className="text-xs text-text-muted">
                    {tp("library.gameCount", filteredGames.length)}
                  </p>
                </div>
                {filteredGames.map((game) => (
                  <DetailsLibraryRow
                    key={game.id}
                    game={game}
                    isSelected={selectedGame?.id === game.id}
                    onClick={() => {
                      pushStack("library", `detail-lib-${game.id}`, game.id);
                      setSelectedGame(game);
                    }}
                  />
                ))}
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                <DetailsPane
                  game={selectedGame}
                  onToggleFavorite={() => selectedGame && toggleFavorite(selectedGame.id)}
                  onPlay={() => selectedGame && handlePlay(selectedGame)}
                  onDelete={async () => {
                    if (!selectedGame) return;
                    try {
                      await invoke("delete_game", { gameId: selectedGame.id });
                      removeGame(selectedGame.id);
                      setSelectedGame(null);
                    } catch (err) {
                      console.error("Failed to delete game:", err);
                    }
                  }}
                />
              </div>
            </div>
          )}
        </main>
      </div>

      {selectedGame && viewMode !== "details" && (
        <GameDetail
          key={selectedGame.id}
          game={selectedGame}
          onClose={() => setSelectedGame(null)}
          onToggleFavorite={() => toggleFavorite(selectedGame.id)}
          onPlay={() => handlePlay(selectedGame)}
          onDelete={async () => {
            try {
              await invoke("delete_game", { gameId: selectedGame.id });
              removeGame(selectedGame.id);
              setSelectedGame(null);
            } catch (err) {
              console.error("Failed to delete game:", err);
            }
          }}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          onClose={() => setShowSettingsModal(false)}
          onOpenScanFolders={() => setShowScanFoldersModal(true)}
          onOpenRomFolders={() => setShowRomScanFoldersModal(true)}
          onOpenEmulators={() => setShowEmulatorModal(true)}
          onOpenMetadataProviders={() => setShowMetadataProvidersModal(true)}
          onOpenAddons={() => setShowAddonModal(true)}
          onOpenControllerSettings={() => setShowControllerSettings(true)}
          onOpenControllerDiagnostics={() => {
            setShowSettingsModal(false);
            setShowControllerDiagnostics(true);
          }}
        />
      )}
      {showAddModal && <AddGameModal onClose={() => setShowAddModal(false)} />}
      {showControllerSettings && <ControllerSettingsModal onClose={() => setShowControllerSettings(false)} />}
      {showScanFoldersModal && <ScanFoldersModal onClose={() => setShowScanFoldersModal(false)} />}
      {showEmulatorModal && <EmulatorModal onClose={() => setShowEmulatorModal(false)} />}
      {showRomScanFoldersModal && (
        <RomScanFoldersModal onClose={() => setShowRomScanFoldersModal(false)} />
      )}
      {showMetadataProvidersModal && (
        <MetadataProvidersModal onClose={() => setShowMetadataProvidersModal(false)} />
      )}
      {showControllerDiagnostics && (
        <ControllerDiagnostics onClose={() => setShowControllerDiagnostics(false)} />
      )}
      {showAddonModal && <AddonModal onClose={() => setShowAddonModal(false)} />}
    </div>
  );
}

interface HeroSectionProps {
  gameCount: number;
  searchQuery: string;
  sortBy: SortBy;
  onSortChange: (sort: SortBy) => void;
  onScan: () => void;
  onAddGame: () => void;
}

function HeroSection({ gameCount, searchQuery, sortBy, onSortChange, onScan, onAddGame }: HeroSectionProps) {
  const sortBtn = useFocusableElement({ id: "hero-sort", region: "hero" });
  const scanBtn = useFocusableElement({ id: "hero-scan", region: "hero", onClick: onScan });
  const addBtn = useFocusableElement({ id: "hero-add", region: "hero", onClick: onAddGame });
  const { t, tp } = useT();

  return (
    <div data-nav-region="hero" className="flex items-center justify-between px-6 pt-4 pb-2">
      <div>
        <h1 className="text-xl font-bold text-text-primary">{t("library.title")}</h1>
        <p className="text-sm text-text-muted">
          {tp("library.gameCount", gameCount)}
          {searchQuery && ` ${t("library.matching", { query: searchQuery })}`}
        </p>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <select
          ref={sortBtn.ref as React.RefObject<HTMLSelectElement>}
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortBy)}
          className="text-sm px-3 py-1.5 rounded-lg border border-border bg-bg-card text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/30"
          {...sortBtn.focusableProps}
        >
          <option value="title">{t("settings.sort.title")}</option>
          <option value="lastPlayed">{t("settings.sort.lastPlayed")}</option>
          <option value="playTime">{t("settings.sort.playTime")}</option>
          <option value="platform">{t("settings.sort.platform")}</option>
        </select>
        <button
          ref={scanBtn.ref as React.RefObject<HTMLButtonElement>}
          onClick={onScan}
          className="flex items-center gap-2 px-4 py-1.5 border border-border rounded-lg text-text-secondary hover:bg-bg-hover text-sm font-medium transition-colors"
          {...scanBtn.focusableProps}
        >
          <ScanSearch size={16} />
          {t("library.scan")}
        </button>
        <button
          ref={addBtn.ref as React.RefObject<HTMLButtonElement>}
          onClick={onAddGame}
          className="flex items-center gap-2 px-4 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium transition-colors"
          {...addBtn.focusableProps}
        >
          <FolderPlus size={16} />
          {t("library.addGame")}
        </button>
      </div>
    </div>
  );
}

function DetailsLibraryRow({ game, isSelected, onClick }: { game: Game; isSelected: boolean; onClick: () => void }) {
  const { ref, isFocused, focusableProps } = useFocusableElement({
    id: `detail-lib-${game.id}`,
    region: "library",
    onClick,
  });

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      role="button"
      onClick={onClick}
      {...focusableProps}
      className={clsx(
        "px-4 py-3 cursor-pointer border-b border-border-light transition-colors focus-visible:outline-none",
        isSelected ? "bg-primary/10 border-l-3 border-l-primary" : "hover:bg-bg-hover",
        isFocused && "ring-1 ring-inset ring-primary/40"
      )}
    >
      <div className="flex items-center gap-2.5">
        <GameIcon
          game={game}
          className="w-8 h-8 rounded-md bg-bg-hover overflow-hidden shrink-0"
          fallbackClassName="text-xs text-text-muted"
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">{game.title}</p>
          <p className="text-xs text-text-muted truncate">{game.platform}</p>
        </div>
      </div>
    </div>
  );
}
