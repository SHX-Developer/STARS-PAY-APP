import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { translate, type Lang, type TKey, LANGS } from './i18n';

const STORAGE_KEY = 'stars_pay_lang';

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
}

const LangContext = createContext<LangCtx | null>(null);

function readPersistedLang(): Lang {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && LANGS.some((l) => l.code === raw)) return raw as Lang;
  } catch {
    /* noop */
  }
  // Эвристика по languageCode из Telegram WebApp
  const tgLang = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
  if (tgLang === 'ru') return 'ru';
  if (tgLang === 'uz') return 'uz';
  return 'en';
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => readPersistedLang());

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);

  const value = useMemo<LangCtx>(
    () => ({
      lang,
      setLang,
      t: (key, vars) => translate(lang, key, vars),
    }),
    [lang, setLang],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangCtx {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used inside <LangProvider>');
  return ctx;
}

// Шорткат для самого частого случая — нужен только перевод
export function useT() {
  return useLang().t;
}
