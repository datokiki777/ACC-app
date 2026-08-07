import { useEffect, useState } from 'react';

import { ConfirmDialog } from '../components/ConfirmDialog';
import { InstallPrompt } from '../components/InstallPrompt';
import { ModeSwitch } from '../components/ModeSwitch';
import { StartupScreen } from '../components/StartupScreen';
import { ThemeSelector } from '../components/ThemeSelector';
import { UndoToast } from '../components/UndoToast';
import { BackupSheet } from '../features/import-export/BackupSheet';
import { PeopleList } from '../features/people/PeopleList';
import { PersonFormSheet } from '../features/people/PersonFormSheet';
import { SalarySyncSheet } from '../features/salary/SalarySyncSheet';
import { StatisticsSheet } from '../features/statistics/StatisticsSheet';
import { EntryFormSheet } from '../features/transactions/EntryFormSheet';
import { useThemeEffect } from '../hooks/useThemeEffect';
import { useAppStore } from '../store/hooks';
import type { PersistedPerson } from '../types/persistence';

interface Confirmation {
  title: string;
  message: string;
  action: () => Promise<void>;
}

export function App() {
  const initialize = useAppStore((state) => state.initialize);
  const initialized = useAppStore((state) => state.initialized);
  const loading = useAppStore((state) => state.loading);
  const error = useAppStore((state) => state.error);
  const clearError = useAppStore((state) => state.clearError);
  const mode = useAppStore((state) => state.mode);
  const setMode = useAppStore((state) => state.setMode);
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const people = useAppStore((state) => state.peopleByMode[state.mode]);
  const search = useAppStore((state) => state.search);
  const setSearch = useAppStore((state) => state.setSearch);
  const filter = useAppStore((state) => state.filter);
  const setFilter = useAppStore((state) => state.setFilter);
  const openSheet = useAppStore((state) => state.openSheet);
  const sheet = useAppStore((state) => state.ui.sheet);
  const deletePerson = useAppStore((state) => state.deletePerson);
  const deleteEntry = useAppStore((state) => state.deleteEntry);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  useThemeEffect(theme);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const activeCount = people.filter((person) => !person.archived).length;
  const archivedCount = people.filter((person) => person.archived).length;

  function confirmPersonDelete(person: PersistedPerson) {
    setConfirmation({
      title: 'Delete?',
      message: `Are you sure you want to delete ${person.name}?`,
      action: () => deletePerson(person.id),
    });
  }

  function confirmEntryDelete(person: PersistedPerson, entryId: string) {
    setConfirmation({
      title: 'Delete?',
      message: 'Are you sure you want to delete this entry?',
      action: () => deleteEntry(person.id, entryId),
    });
  }

  return (
    <>
      <StartupScreen />
      <div className="app-shell">
        <header className="app-header real-header">
          <button
            aria-label="Data and backup"
            className="icon-button header-action"
            onClick={() => openSheet('backup')}
            type="button"
          >
            ⇄
          </button>
          <ModeSwitch mode={mode} onChange={(next) => void setMode(next)} />
          <ThemeSelector onChange={(next) => void setTheme(next)} value={theme} />
          <div className="filter-row">
            <div className="filter-switch">
              <button
                className={filter === 'active' ? 'is-selected' : ''}
                onClick={() => setFilter('active')}
                type="button"
              >
                Active <span>{activeCount}</span>
              </button>
              <button
                className={filter === 'archived' ? 'is-selected' : ''}
                onClick={() => setFilter('archived')}
                type="button"
              >
                Archived <span>{archivedCount}</span>
              </button>
            </div>
            <button
              aria-label="Statistics"
              className="icon-button"
              onClick={() => openSheet('statistics')}
              type="button"
            >
              ▥
            </button>
          </div>
          <label className="search-field">
            <span>⌕</span>
            <input
              aria-label="Search by name"
              autoCapitalize="none"
              autoComplete="off"
              enterKeyHint="search"
              inputMode="search"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name…"
              spellCheck={false}
              type="search"
              value={search}
            />
          </label>
        </header>

        <main className="app-content real-content">
          {(loading || !initialized) && (
            <section className="empty-card">
              <div className="loading-spinner" />
              <h1>Loading ACC</h1>
            </section>
          )}
          {initialized && (
            <PeopleList onDeleteEntry={confirmEntryDelete} onDeletePerson={confirmPersonDelete} />
          )}
        </main>
      </div>

      {initialized && (
        <button
          aria-label={`Add ${mode === 'work' ? 'team' : 'person'}`}
          className="fab"
          onClick={() => openSheet('person-form')}
          type="button"
        >
          +
        </button>
      )}
      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button onClick={clearError} type="button">
            ×
          </button>
        </div>
      )}
      <UndoToast />
      <InstallPrompt />

      {sheet === 'person-form' && <PersonFormSheet />}
      {sheet === 'entry-form' && <EntryFormSheet />}
      {sheet === 'salary-sync' && <SalarySyncSheet />}
      {sheet === 'statistics' && <StatisticsSheet />}
      {sheet === 'backup' && <BackupSheet />}
      {confirmation && (
        <ConfirmDialog
          message={confirmation.message}
          onCancel={() => setConfirmation(null)}
          onConfirm={async () => {
            await confirmation.action();
            setConfirmation(null);
          }}
          title={confirmation.title}
        />
      )}
    </>
  );
}
