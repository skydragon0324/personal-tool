import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { LANGUAGE_STORAGE_KEY, setActiveLanguage, type Language } from "./index";

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: "en",
  setLanguage: () => undefined,
});

/** The saved choice, else the browser's language (Chinese if it starts with "zh"), else English. */
function preferredLanguage(): Language {
  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === "en" || saved === "zh") return saved;
  } catch {
    // Storage can be blocked; fall back to the browser language.
  }
  return window.navigator.language?.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function applyLanguage(language: Language) {
  setActiveLanguage(language);
  dayjs.locale(language === "zh" ? "zh-cn" : "en");
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
}

/**
 * Picks the language on the client and re-renders the app when it changes. Nothing renders until
 * the language is known, so a Chinese user never sees an English first paint.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language | null>(null);

  useEffect(() => {
    const initial = preferredLanguage();
    applyLanguage(initial);
    setLanguageState(initial);
  }, []);

  const setLanguage = useCallback((next: Language) => {
    applyLanguage(next);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {
      // Not remembered across visits when storage is blocked.
    }
    setLanguageState(next);
  }, []);

  const value = useMemo(() => ({ language: language ?? "en", setLanguage }), [language, setLanguage]);

  if (language === null) return null;
  return (
    <LanguageContext.Provider value={value}>
      {/* A new key remounts the tree so every text, date and picker uses the new language. */}
      <Fragment key={language}>{children}</Fragment>
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
