import { useEffect, useState } from 'react';

import type { ThemeMode } from '../types/domain';

export function useThemeEffect(theme: ThemeMode): void {
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const effective = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
    document.documentElement.dataset.theme = effective;
    document.documentElement.style.colorScheme = effective;
  }, [systemDark, theme]);
}
