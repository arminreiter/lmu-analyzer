import { useState, useLayoutEffect } from 'react';
import { KEYS, lsGet, lsSet } from './storage';

const THEME_KEY = KEYS.theme;
type Theme = 'dark' | 'light';

function getInitialTheme(): Theme {
  const saved = lsGet(THEME_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#e4e5ec' : '#0a0a0f');
    lsSet(THEME_KEY, theme);
  }, [theme]);

  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return { theme, toggle } as const;
}
