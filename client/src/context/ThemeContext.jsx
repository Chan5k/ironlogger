import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'ironlog_theme';
const VALID = new Set(['light', 'dark', 'system']);

function getSystemDark() {
  if (typeof window === 'undefined') return true;
  return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? true;
}

function readStored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (VALID.has(v)) return v;
  } catch {
    /* ignore */
  }
  return 'dark';
}

function applyDomTheme(mode, systemDark) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const effectiveDark = mode === 'dark' || (mode === 'system' && systemDark);
  root.classList.toggle('dark', effectiveDark);
  root.style.colorScheme = effectiveDark ? 'dark' : 'light';

  const themeColor = effectiveDark ? '#0b0e14' : '#f8fafc';
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute('content', themeColor);

  const appleStatus = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (appleStatus) {
    appleStatus.setAttribute('content', effectiveDark ? 'black-translucent' : 'default');
  }
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(() => readStored());
  const [systemDark, setSystemDark] = useState(() => getSystemDark());

  useEffect(() => {
    applyDomTheme(mode, systemDark);
  }, [mode, systemDark]);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return undefined;
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const setMode = useCallback((next) => {
    if (!VALID.has(next)) return;
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const effectiveDark = mode === 'dark' || (mode === 'system' && systemDark);

  const value = useMemo(
    () => ({
      mode,
      setMode,
      effectiveDark,
      systemDark,
    }),
    [mode, setMode, effectiveDark, systemDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

/** Optional: use in places outside provider (e.g. rare edge cases). */
export function useThemeOptional() {
  return useContext(ThemeContext);
}
