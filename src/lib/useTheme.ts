import { useState, useLayoutEffect } from 'react';

const THEME_KEY = 'lmu-analyzer-theme';
type Theme = 'dark' | 'light';

function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* localStorage unavailable */ }
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#e4e5ec' : '#0a0a0f');
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* localStorage unavailable */ }
  }, [theme]);

  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return { theme, toggle } as const;
}
