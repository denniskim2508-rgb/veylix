export type Language =
  | "en"
  | "ja"
  | "fr"
  | "es"
  | "de"
  | "pt-BR"
  | "ru"
  | "ko"
  | "zh-CN";

export interface LanguageInfo {
  code: Language;
  nativeName: string;
  englishName: string;
  /** BCP-47 tag used for Intl date/number formatting. */
  bcp47: string;
}

export const LANGUAGES: LanguageInfo[] = [
  { code: "en", nativeName: "English", englishName: "English", bcp47: "en-US" },
  { code: "ja", nativeName: "日本語", englishName: "Japanese", bcp47: "ja-JP" },
  { code: "fr", nativeName: "Français", englishName: "French", bcp47: "fr-FR" },
  { code: "es", nativeName: "Español", englishName: "Spanish", bcp47: "es-ES" },
  { code: "de", nativeName: "Deutsch", englishName: "German", bcp47: "de-DE" },
  {
    code: "pt-BR",
    nativeName: "Português (Brasil)",
    englishName: "Portuguese (Brazil)",
    bcp47: "pt-BR",
  },
  { code: "ru", nativeName: "Русский", englishName: "Russian", bcp47: "ru-RU" },
  { code: "ko", nativeName: "한국어", englishName: "Korean", bcp47: "ko-KR" },
  {
    code: "zh-CN",
    nativeName: "中文（简体）",
    englishName: "Chinese (Simplified)",
    bcp47: "zh-CN",
  },
];

export const DEFAULT_LANGUAGE: Language = "en";

const LANGUAGE_CODES = new Set<string>(LANGUAGES.map((l) => l.code));

/** Resolve an arbitrary locale string (e.g. navigator.language) to a supported language. */
export function resolveLanguage(input: string | null | undefined): Language {
  if (!input) return DEFAULT_LANGUAGE;
  const normalized = input.replace("_", "-").toLowerCase();

  for (const info of LANGUAGES) {
    if (
      info.code.toLowerCase() === normalized ||
      info.bcp47.toLowerCase() === normalized
    ) {
      return info.code;
    }
  }

  const base = normalized.split("-")[0];
  if (LANGUAGE_CODES.has(base)) {
    return base as Language;
  }
  for (const info of LANGUAGES) {
    if (info.code.toLowerCase().split("-")[0] === base) {
      return info.code;
    }
  }
  return DEFAULT_LANGUAGE;
}

export function getLanguageInfo(code: Language): LanguageInfo {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

export interface PluralForms {
  one?: string;
  few?: string;
  many?: string;
  other: string;
}

/** Identity helper that types a plural group (allows locales to omit unused categories). */
export function plural(forms: PluralForms): PluralForms {
  return forms;
}
