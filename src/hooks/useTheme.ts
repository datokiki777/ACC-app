import { useEffect, useState } from 'react';

import type { ThemeMode } from '../types/shell';

const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

function getSystemTheme(): Exclude<ThemeMode, 'system'> {
  return window.matchMedia(DARK_MEDIA_QUERY).matches ? 'dark' : 'light';
}

export function useTheme() {
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [systemTheme, setSystemTheme] = useState<Exclude<ThemeMode, 'system'>>(getSystemTheme);

  useEffect(() => {
    const media = window.matchMedia(DARK_MEDIA_QUERY);
    const handleChange = () => setSystemTheme(media.matches ? 'dark' : 'light');
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  const effectiveTheme = themeMode === 'system' ? systemTheme : themeMode;

  useEffect(() => {
    document.documentElement.dataset.theme = effectiveTheme;
    document.documentElement.style.colorScheme = effectiveTheme;
  }, [effectiveTheme]);

  return { effectiveTheme, setThemeMode, themeMode };
}
