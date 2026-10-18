import { create } from "zustand";
import type { Game, Drive, Category, Platform, FilterType, SortBy, ViewMode, PlaySession, ScanFolder } from "../types";

const KEY_VIEW_MODE = "view_mode";
const KEY_SORT_BY = "sort_by";

const VIEW_MODES: ViewMode[] = ["grid", "list", "details"];
const SORT_OPTIONS: SortBy[] = ["title", "lastPlayed", "playTime", "platform"];

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

interface AppState {
  games: Game[];
  drives: Drive[];
  categories: Category[];
  playSessions: PlaySession[];
  scanFolders: ScanFolder[];
  selectedGame: Game | null;
  searchQuery: string;
  activePlatform: Platform | "all";
  filterType: FilterType;
  sortBy: SortBy;
  viewMode: ViewMode;
  isDarkMode: boolean;
  isSidebarCollapsed: boolean;
  isLoading: boolean;

  setGames: (games: Game[]) => void;
  setDrives: (drives: Drive[]) => void;
  setCategories: (categories: Category[]) => void;
  setPlaySessions: (sessions: PlaySession[]) => void;
  setScanFolders: (folders: ScanFolder[]) => void;
  setSelectedGame: (game: Game | null) => void;
  setSearchQuery: (query: string) => void;
  setActivePlatform: (platform: Platform | "all") => void;
  setFilterType: (filter: FilterType) => void;
  setSortBy: (sort: SortBy) => void;
  setViewMode: (mode: ViewMode) => void;
  loadPreferences: () => Promise<void>;
  toggleSidebar: () => void;
  setIsLoading: (loading: boolean) => void;
  addGame: (game: Game) => void;
  removeGame: (id: number) => void;
  updateGame: (id: number, updates: Partial<Game>) => void;
  toggleFavorite: (id: number) => void;
  getFilteredGames: () => Game[];
}

export const useStore = create<AppState>((set, get) => ({
  games: [],
  drives: [],
  categories: [],
  playSessions: [],
  scanFolders: [],
  selectedGame: null,
  searchQuery: "",
  activePlatform: "all",
  filterType: "all",
  sortBy: "title",
  viewMode: "grid",
  isDarkMode: true,
  isSidebarCollapsed: false,
  isLoading: false,

  setGames: (games) => set({ games }),
  setDrives: (drives) => set({ drives }),
  setCategories: (categories) => set({ categories }),
  setPlaySessions: (sessions) => set({ playSessions: sessions }),
  setScanFolders: (folders) => set({ scanFolders: folders }),
  setSelectedGame: (game) => set({ selectedGame: game }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setActivePlatform: (platform) => set({ activePlatform: platform }),
  setFilterType: (filter) => set({ filterType: filter }),
  setSortBy: (sort) => {
    set({ sortBy: sort });
    void invoke("set_app_setting", { key: KEY_SORT_BY, value: sort });
  },
  setViewMode: (mode) => {
    set({ viewMode: mode });
    void invoke("set_app_setting", { key: KEY_VIEW_MODE, value: mode });
  },
  loadPreferences: async () => {
    try {
      const map: Record<string, string> = await invoke("get_all_app_settings");
      const view = map[KEY_VIEW_MODE] as ViewMode | undefined;
      const sort = map[KEY_SORT_BY] as SortBy | undefined;
      set({
        viewMode: view && VIEW_MODES.includes(view) ? view : get().viewMode,
        sortBy: sort && SORT_OPTIONS.includes(sort) ? sort : get().sortBy,
      });
    } catch (err) {
      console.error("Failed to load preferences:", err);
    }
  },
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  setIsLoading: (loading) => set({ isLoading: loading }),
  addGame: (game) => set((state) => ({ games: [...state.games, game] })),
  removeGame: (id) => set((state) => ({ games: state.games.filter((g) => g.id !== id) })),
  updateGame: (id, updates) =>
    set((state) => ({
      games: state.games.map((g) => (g.id === id ? { ...g, ...updates } : g)),
    })),
  toggleFavorite: (id) =>
    set((state) => ({
      games: state.games.map((g) => (g.id === id ? { ...g, isFavorite: !g.isFavorite } : g)),
    })),
  getFilteredGames: () => {
    const state = get();
    let filtered = [...state.games];

    if (state.activePlatform !== "all") {
      filtered = filtered.filter((g) => g.platform === state.activePlatform);
    }

    if (state.filterType === "installed") {
      filtered = filtered.filter((g) => g.isInstalled);
    } else if (state.filterType === "favorites") {
      filtered = filtered.filter((g) => g.isFavorite);
    } else if (state.filterType === "recent") {
      filtered = filtered.filter((g) => g.lastPlayed);
    }

    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (g) =>
          g.title.toLowerCase().includes(q) ||
          g.platform.toLowerCase().includes(q) ||
          g.genre?.toLowerCase().includes(q)
      );
    }

    switch (state.sortBy) {
      case "title":
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "lastPlayed":
        filtered.sort((a, b) => {
          if (!a.lastPlayed) return 1;
          if (!b.lastPlayed) return -1;
          return new Date(b.lastPlayed).getTime() - new Date(a.lastPlayed).getTime();
        });
        break;
      case "playTime":
        filtered.sort((a, b) => b.playTime - a.playTime);
        break;
      case "platform":
        filtered.sort((a, b) => a.platform.localeCompare(b.platform));
        break;
    }

    return filtered;
  },
}));
