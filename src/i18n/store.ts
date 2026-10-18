import { create } from "zustand";
import { DEFAULT_LANGUAGE, resolveLanguage, type Language } from "./languages";

const KEY_LANGUAGE = "language";

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

function applyDocumentLanguage(language: Language) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = language;
  }
}

interface I18nStore {
  language: Language;
  loaded: boolean;
  loadLanguage: () => Promise<void>;
  setLanguage: (language: Language) => Promise<void>;
}

export const useI18nStore = create<I18nStore>((set) => ({
  language: DEFAULT_LANGUAGE,
  loaded: false,

  loadLanguage: async () => {
    let language = DEFAULT_LANGUAGE;
    try {
      const map: Record<string, string> = await invoke("get_all_app_settings");
      const stored = map[KEY_LANGUAGE];
      language = stored
        ? resolveLanguage(stored)
        : resolveLanguage(typeof navigator !== "undefined" ? navigator.language : null);
    } catch (err) {
      console.error("Failed to load language:", err);
      language = resolveLanguage(typeof navigator !== "undefined" ? navigator.language : null);
    }
    applyDocumentLanguage(language);
    set({ language, loaded: true });
  },

  setLanguage: async (language) => {
    applyDocumentLanguage(language);
    set({ language });
    try {
      await invoke("set_app_setting", { key: KEY_LANGUAGE, value: language });
    } catch (err) {
      console.error("Failed to save language:", err);
    }
  },
}));
