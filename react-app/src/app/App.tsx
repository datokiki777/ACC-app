import { useState } from 'react';

import { ModeSwitch } from '../components/ModeSwitch';
import { StartupScreen } from '../components/StartupScreen';
import { ThemeSelector } from '../components/ThemeSelector';
import { useTheme } from '../hooks/useTheme';
import type { AppMode } from '../types/shell';

export function App() {
  const [mode, setMode] = useState<AppMode>('personal');
  const { setThemeMode, themeMode } = useTheme();

  return (
    <>
      <StartupScreen />
      <div className="app-shell">
        <header className="app-header">
          <a aria-label="ACC home" className="brand" href={import.meta.env.BASE_URL}>
            <img alt="" src={`${import.meta.env.BASE_URL}icons/icon-192x192.png`} />
            <span>ACC</span>
          </a>
          <ThemeSelector onChange={setThemeMode} value={themeMode} />
          <ModeSwitch mode={mode} onChange={setMode} />
        </header>

        <main className="app-content">
          <section aria-labelledby="foundation-title" className="placeholder-card">
            <span className="eyebrow">React foundation</span>
            <h1 id="foundation-title">{mode === 'personal' ? 'Personal' : 'Work'} mode</h1>
            <p>
              The application shell is ready. Financial features and existing data remain untouched
              until the next approved migration phase.
            </p>
          </section>
        </main>
      </div>
    </>
  );
}
