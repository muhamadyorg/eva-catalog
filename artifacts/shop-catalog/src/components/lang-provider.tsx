import { createContext, useContext, useState, useCallback } from "react";
import { translations, type Lang, type TranslationKey } from "@/i18n/translations";

const STORAGE_KEY = "shop-lang";

function getSavedLang(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "uz" || v === "ru" || v === "en") return v;
  } catch { /* */ }
  return "uz";
}

interface LangContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey) => string;
  getName: (item: { name: string; nameRu?: string | null; nameEn?: string | null }) => string;
}

const LangContext = createContext<LangContextType>({
  lang: "uz",
  setLang: () => {},
  t: (key) => translations.uz[key],
  getName: (item) => item.name,
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getSavedLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* */ }
  }, []);

  const t = useCallback((key: TranslationKey): string => {
    return translations[lang][key];
  }, [lang]);

  const getName = useCallback(
    (item: { name: string; nameRu?: string | null; nameEn?: string | null }): string => {
      if (lang === "ru") return item.nameRu || item.name;
      if (lang === "en") return item.nameEn || item.name;
      return item.name;
    },
    [lang]
  );

  return (
    <LangContext.Provider value={{ lang, setLang, t, getName }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
