import { create } from "zustand";
import type {
  AddonCatalog,
  AddonCatalogEntry,
  AddonState,
  InstalledAddon,
} from "../types/addon";

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

interface AddonStore {
  catalog: AddonCatalog | null;
  installedAddons: InstalledAddon[];
  selectedAddonId: string | null;
  searchQuery: string;
  activeCategory: string;
  isLoading: boolean;
  error: string | null;
  catalogUrl: string;

  loadCatalog: (url: string) => Promise<void>;
  loadLocalCatalog: (path: string) => Promise<void>;
  loadDefaultCatalog: () => Promise<void>;
  loadInstalled: () => Promise<void>;
  selectAddon: (id: string | null) => void;
  setSearchQuery: (q: string) => void;
  setActiveCategory: (cat: string) => void;
  setCatalogUrl: (url: string) => void;
  installAddon: (entry: AddonCatalogEntry, version: string) => Promise<void>;
  uninstallAddon: (id: string) => Promise<void>;
  enableAddon: (id: string) => Promise<void>;
  disableAddon: (id: string) => Promise<void>;

  filteredAddons: () => AddonCatalogEntry[];
  getSelectedAddon: () => AddonCatalogEntry | null;
  getAddonState: (id: string) => AddonState;
}

export const useAddonStore = create<AddonStore>((set, get) => ({
  catalog: null,
  installedAddons: [],
  selectedAddonId: null,
  searchQuery: "",
  activeCategory: "all",
  isLoading: false,
  error: null,
  catalogUrl: "",

  loadCatalog: async (url: string) => {
    set({ isLoading: true, error: null, catalogUrl: url });
    try {
      const catalog = await invoke<AddonCatalog>("fetch_addon_catalog", { url });
      set({ catalog, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  loadLocalCatalog: async (path: string) => {
    set({ isLoading: true, error: null });
    try {
      const catalog = await invoke<AddonCatalog>("load_local_addon_catalog", { path });
      set({ catalog, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  loadDefaultCatalog: async () => {
    try {
      const dataDir = await invoke<string>("get_app_data_dir");
      const candidates = ["test-catalog.json", "catalog.json"];
      for (const name of candidates) {
        const path = `${dataDir}\\${name}`;
        try {
          const catalog = await invoke<AddonCatalog>("load_local_addon_catalog", { path });
          set({ catalog, error: null });
          return;
        } catch {
          // try next candidate
        }
      }
    } catch {
      // get_app_data_dir failed, silently ignore
    }
  },

  loadInstalled: async () => {
    try {
      const installedAddons = await invoke<InstalledAddon[]>("get_installed_addons");
      set({ installedAddons });
    } catch (err) {
      set({ error: String(err) });
    }
  },

  selectAddon: (id) => set({ selectedAddonId: id }),

  setSearchQuery: (q) => set({ searchQuery: q }),

  setActiveCategory: (cat) => set({ activeCategory: cat, selectedAddonId: null }),

  setCatalogUrl: (url) => set({ catalogUrl: url }),

  installAddon: async (entry: AddonCatalogEntry, version: string) => {
    set({ isLoading: true, error: null });
    try {
      const entryJson = JSON.stringify(entry);
      await invoke<InstalledAddon>("install_addon", { entryJson, version });
      const installedAddons = await invoke<InstalledAddon[]>("get_installed_addons");
      set({ installedAddons, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
      throw err;
    }
  },

  uninstallAddon: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await invoke("uninstall_addon", { addonId: id });
      const installedAddons = await invoke<InstalledAddon[]>("get_installed_addons");
      set({ installedAddons, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
      throw err;
    }
  },

  enableAddon: async (id: string) => {
    try {
      await invoke("enable_addon", { addonId: id });
      const installedAddons = await invoke<InstalledAddon[]>("get_installed_addons");
      set({ installedAddons });
    } catch (err) {
      set({ error: String(err) });
      throw err;
    }
  },

  disableAddon: async (id: string) => {
    try {
      await invoke("disable_addon", { addonId: id });
      const installedAddons = await invoke<InstalledAddon[]>("get_installed_addons");
      set({ installedAddons });
    } catch (err) {
      set({ error: String(err) });
      throw err;
    }
  },

  filteredAddons: () => {
    const { catalog, activeCategory, searchQuery } = get();
    if (!catalog) return [];

    let addons = catalog.addons;

    if (activeCategory !== "all") {
      if (activeCategory === "installed") {
        const { installedAddons } = get();
        const installedIds = new Set(installedAddons.map((a) => a.id));
        addons = addons.filter((a) => installedIds.has(a.id));
      } else if (activeCategory === "updates") {
        const { installedAddons } = get();
        const installedMap = new Map(installedAddons.map((a) => [a.id, a]));
        addons = addons.filter((a) => {
          const installed = installedMap.get(a.id);
          return installed && installed.version !== a.version;
        });
      } else {
        addons = addons.filter((a) => a.category === activeCategory);
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      addons = addons.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.author.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return addons;
  },

  getSelectedAddon: () => {
    const { catalog, selectedAddonId } = get();
    if (!catalog || !selectedAddonId) return null;
    return catalog.addons.find((a) => a.id === selectedAddonId) ?? null;
  },

  getAddonState: (id: string): AddonState => {
    const { installedAddons, catalog } = get();
    const installed = installedAddons.find((a) => a.id === id);

    if (!installed) return "not-installed";

    if (!installed.enabled) return "disabled";

    if (catalog) {
      const catalogEntry = catalog.addons.find((a) => a.id === id);
      if (catalogEntry && catalogEntry.version !== installed.version) {
        return "update-available";
      }
    }

    return "enabled";
  },
}));
