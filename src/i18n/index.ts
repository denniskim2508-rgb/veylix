import { useMemo } from "react";
import en, { type Messages } from "./locales/en";
import ja from "./locales/ja";
import fr from "./locales/fr";
import es from "./locales/es";
import de from "./locales/de";
import ptBR from "./locales/pt-BR";
import ru from "./locales/ru";
import ko from "./locales/ko";
import zhCN from "./locales/zh-CN";
import {
  DEFAULT_LANGUAGE,
  getLanguageInfo,
  type Language,
  type PluralForms,
} from "./languages";
import { useI18nStore } from "./store";

export * from "./languages";
export type { Messages };
export { useI18nStore };

export type TranslateParams = Record<string, string | number>;
export type TFn = (key: string, params?: TranslateParams) => string;
export type TPluralFn = (key: string, count: number, params?: TranslateParams) => string;

const catalogs: Record<Language, Messages> = {
  en,
  ja,
  fr,
  es,
  de,
  "pt-BR": ptBR,
  ru,
  ko,
  "zh-CN": zhCN,
};

function lookup(catalog: Messages, key: string): unknown {
  let node: unknown = catalog;
  for (const part of key.split(".")) {
    if (node && typeof node === "object" && Object.prototype.hasOwnProperty.call(node, part)) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return node;
}

function resolveValue(language: Language, key: string): unknown {
  const value = lookup(catalogs[language], key);
  if (value !== undefined) return value;
  return lookup(catalogs[DEFAULT_LANGUAGE], key);
}

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

export function translate(language: Language, key: string, params?: TranslateParams): string {
  const value = resolveValue(language, key);
  if (typeof value === "string") return interpolate(value, params);
  return key;
}

export function translatePlural(
  language: Language,
  key: string,
  count: number,
  params?: TranslateParams
): string {
  const value = resolveValue(language, key);
  const allParams = { count, ...params };
  if (typeof value === "string") return interpolate(value, allParams);
  if (value && typeof value === "object") {
    const forms = value as PluralForms;
    const category = new Intl.PluralRules(getLanguageInfo(language).bcp47).select(count);
    const formsRecord = forms as unknown as Record<string, string | undefined>;
    const template = formsRecord[category] ?? forms.other ?? "";
    return interpolate(template, allParams);
  }
  return key;
}

/** Translation helpers bound to the active language; re-renders on language change. */
export function useT(): { t: TFn; tp: TPluralFn; language: Language } {
  const language = useI18nStore((s) => s.language);
  return useMemo(
    () => ({
      t: (key: string, params?: TranslateParams) => translate(language, key, params),
      tp: (key: string, count: number, params?: TranslateParams) =>
        translatePlural(language, key, count, params),
      language,
    }),
    [language]
  );
}

/** For non-React modules (e.g. formatting utils). Components should prefer useT(). */
export function tGlobal(key: string, params?: TranslateParams): string {
  return translate(useI18nStore.getState().language, key, params);
}

export function tpGlobal(key: string, count: number, params?: TranslateParams): string {
  return translatePlural(useI18nStore.getState().language, key, count, params);
}

/** BCP-47 tag of the active language, for Intl formatting. */
export function currentLocale(): string {
  return getLanguageInfo(useI18nStore.getState().language).bcp47;
}
