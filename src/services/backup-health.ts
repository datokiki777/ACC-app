import type { Person } from '../types/domain';
import type { BackupMetadata } from '../types/persistence';

type BackupPeople = { personal: readonly Person[]; work: readonly Person[] };

export interface BackupSnapshot {
  dataSignature: string;
  entrySignatures: string[];
  entryCount: number;
}

export type BackupHealthTone = 'safe' | 'warning' | 'danger';

export interface BackupHealth {
  tone: BackupHealthTone;
  label: string;
  detail: string;
  pendingEntryCount: number;
  hasPendingChanges: boolean;
  ageDays: number | null;
  trackingAvailable: boolean;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }
  return value;
}

function signature(value: unknown): string {
  const text = JSON.stringify(stableValue(value));
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function peopleFrom(data: BackupPeople) {
  return [
    ...data.personal.map((person) => ({ mode: 'personal' as const, person })),
    ...data.work.map((person) => ({ mode: 'work' as const, person })),
  ];
}

export function createBackupSnapshot(data: BackupPeople): BackupSnapshot {
  const entrySignatures = peopleFrom(data).flatMap(({ mode, person }) =>
    person.entries.map((entry) => `${mode}:${person.id}:${entry.id}:${signature(entry)}`),
  );
  return {
    dataSignature: signature({ personal: data.personal, work: data.work }),
    entrySignatures,
    entryCount: entrySignatures.length,
  };
}

function wholeDaysBetween(earlier: Date, later: Date): number {
  return Math.max(0, Math.floor((later.getTime() - earlier.getTime()) / 86_400_000));
}

function entrySignatureKey(value: string): string {
  const separator = value.lastIndexOf(':');
  return separator < 0 ? value : value.slice(0, separator);
}

export function analyzeBackupHealth(
  metadata: BackupMetadata,
  data: BackupPeople,
  referenceDate = new Date(),
): BackupHealth {
  if (!metadata.lastBackup) {
    return {
      tone: 'danger',
      label: 'No backup yet',
      detail: 'Export a JSON backup to protect this device data.',
      pendingEntryCount: data.personal
        .concat(data.work)
        .reduce((sum, person) => sum + person.entries.length, 0),
      hasPendingChanges: true,
      ageDays: null,
      trackingAvailable: true,
    };
  }

  if (!metadata.dataSignature || !metadata.entrySignatures) {
    return {
      tone: 'warning',
      label: 'Refresh your backup',
      detail: 'Create one new JSON backup to start precise change tracking.',
      pendingEntryCount: 0,
      hasPendingChanges: true,
      ageDays: null,
      trackingAvailable: false,
    };
  }

  const current = createBackupSnapshot(data);
  const savedEntries = new Map(
    metadata.entrySignatures.map((item) => [entrySignatureKey(item), item]),
  );
  const currentEntries = new Map(
    current.entrySignatures.map((item) => [entrySignatureKey(item), item]),
  );
  const pendingEntryCount =
    [...currentEntries].filter(([key, value]) => savedEntries.get(key) !== value).length +
    [...savedEntries.keys()].filter((key) => !currentEntries.has(key)).length;
  const hasPendingChanges = metadata.dataSignature
    ? current.dataSignature !== metadata.dataSignature
    : pendingEntryCount > 0;
  const parsedBackupDate = new Date(metadata.lastBackup);
  const ageDays = Number.isNaN(parsedBackupDate.getTime())
    ? null
    : wholeDaysBetween(parsedBackupDate, referenceDate);

  if (pendingEntryCount >= 10 || (ageDays !== null && ageDays > 30)) {
    return {
      tone: 'danger',
      label: 'Backup overdue',
      detail:
        pendingEntryCount > 0
          ? `${pendingEntryCount} entry changes are not in the last backup.`
          : `The last backup is ${ageDays} days old.`,
      pendingEntryCount,
      hasPendingChanges,
      ageDays,
      trackingAvailable: true,
    };
  }

  if (hasPendingChanges || (ageDays !== null && ageDays > 14)) {
    return {
      tone: 'warning',
      label: 'Backup recommended',
      detail:
        pendingEntryCount > 0
          ? `${pendingEntryCount} entry changes are not in the last backup.`
          : hasPendingChanges
            ? 'Profile or archive changes are not in the last backup.'
            : `The last backup is ${ageDays} days old.`,
      pendingEntryCount,
      hasPendingChanges,
      ageDays,
      trackingAvailable: true,
    };
  }

  return {
    tone: 'safe',
    label: 'Backup is current',
    detail: 'All current data is included in the latest JSON backup.',
    pendingEntryCount: 0,
    hasPendingChanges: false,
    ageDays,
    trackingAvailable: true,
  };
}

export interface DataInsights {
  people: number;
  teams: number;
  archived: number;
  entries: number;
  currencies: string[];
  dataBytes: number;
  oldestEntryDate: string | null;
  newestEntryDate: string | null;
}

export function collectDataInsights(data: BackupPeople): DataInsights {
  const allPeople: Person[] = [...data.personal, ...data.work];
  const dates = allPeople.flatMap((person) => person.entries.map((entry) => entry.date)).sort();
  return {
    people: data.personal.length,
    teams: data.work.length,
    archived: allPeople.filter((person) => person.archived).length,
    entries: allPeople.reduce((sum, person) => sum + person.entries.length, 0),
    currencies: [...new Set(allPeople.map((person) => person.currency))].sort(),
    dataBytes: new Blob([JSON.stringify(data)]).size,
    oldestEntryDate: dates[0] ?? null,
    newestEntryDate: dates.at(-1) ?? null,
  };
}
