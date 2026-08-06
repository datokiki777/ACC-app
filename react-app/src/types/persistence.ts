import type { AppMode, Entry, Person, ThemeMode } from './domain';

export type PersistedEntry = Entry & Record<string, unknown>;

export type PersistedPerson = Omit<Person, 'entries'> &
  Record<string, unknown> & {
    entries: PersistedEntry[];
  };

export interface ModeDataRecord {
  mode: AppMode;
  people: PersistedPerson[];
  updatedAt: string;
}

export type SettingKey = 'activeMode' | 'theme';

export interface SettingRecord {
  key: SettingKey;
  value: AppMode | ThemeMode;
}

export interface MetadataRecord {
  key: 'backup' | 'schemaVersion';
  value: unknown;
}

export interface BackupMetadata {
  lastBackup: string;
  count: number;
}

export interface ReactBackupData {
  personal: PersistedPerson[];
  work: PersistedPerson[];
  exportDate: string;
  schemaVersion?: number;
}
