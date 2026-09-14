import { create } from 'zustand';

export type ThemePref = 'system' | 'light' | 'dark';

function applyTheme(theme: ThemePref) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
  if (isDark) root.classList.add('dark');
  else root.classList.remove('dark');
}

type ThemeState = {
  theme: ThemePref;
  setTheme: (t: ThemePref) => void;
  toggleTheme: () => void;
  init: () => void;
};

const KEY = 'wikicat:theme';

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'system',
  setTheme: (t: ThemePref) => {
    try { localStorage.setItem(KEY, t); } catch { /* ignore */ }
    applyTheme(t);
    set({ theme: t });
  },
  toggleTheme: () => {
    const cur = get().theme;
    const next: ThemePref = cur === 'light' ? 'dark' : cur === 'dark' ? 'system' : 'light';
    get().setTheme(next);
  },
  init: () => {
    let stored: ThemePref = 'system';
    try {
      const raw = localStorage.getItem(KEY);
      if (raw === 'light' || raw === 'dark' || raw === 'system') stored = raw;
    } catch { /* ignore */ }
    applyTheme(stored);
    set({ theme: stored });
    try {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) {
        mq.addEventListener('change', () => {
          if (get().theme === 'system') applyTheme('system');
        });
      }
    } catch { /* ignore */ }
  },
}));
