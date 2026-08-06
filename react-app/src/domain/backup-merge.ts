import type { LegacyEntry, LegacyPerson } from '../types/domain';
import { flattenLegacyStages } from './legacy-normalization';

function isNonEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
}

function cloneUnknown<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function entryFingerprint(entry: LegacyEntry): string {
  return [entry.type ?? '', Number(entry.amount ?? 0), entry.date ?? '', entry.comment ?? ''].join(
    '|',
  );
}

export function personFingerprint(person: LegacyPerson): string {
  return [(person.name ?? '').trim().toLowerCase(), (person.note ?? '').trim().toLowerCase()].join(
    '|',
  );
}

export function mergeEntryObjects(
  currentEntry: LegacyEntry,
  incomingEntry: LegacyEntry,
): LegacyEntry {
  const base: LegacyEntry = { ...currentEntry };

  Object.keys(incomingEntry).forEach((key) => {
    const incomingValue = incomingEntry[key];
    const currentValue = base[key];
    if (Array.isArray(incomingValue)) {
      base[key] = cloneUnknown(incomingValue);
      return;
    }
    if (typeof incomingValue === 'object' && incomingValue !== null) {
      base[key] = cloneUnknown(incomingValue);
      return;
    }
    if (!isNonEmptyValue(currentValue) && isNonEmptyValue(incomingValue)) {
      base[key] = incomingValue;
      return;
    }
  });
  return base;
}

export function mergeEntries(
  currentEntries: readonly LegacyEntry[] = [],
  incomingEntries: readonly LegacyEntry[] = [],
): LegacyEntry[] {
  const result = currentEntries.map((entry) => ({ ...entry }));
  const usedIndexes = new Set<number>();

  incomingEntries.forEach((incomingEntry) => {
    const matchIndex = incomingEntry.id
      ? result.findIndex((entry) => entry.id === incomingEntry.id)
      : result.findIndex((entry, index) => {
          const fingerprint = entryFingerprint(incomingEntry);
          return !usedIndexes.has(index) && !entry.id && entryFingerprint(entry) === fingerprint;
        });

    if (matchIndex === -1) {
      result.push({ ...incomingEntry });
    } else {
      const currentEntry = result[matchIndex];
      if (currentEntry) {
        result[matchIndex] = mergeEntryObjects(currentEntry, incomingEntry);
        usedIndexes.add(matchIndex);
      }
    }
  });
  return result;
}

export function mergePersonObjects(
  currentPerson: LegacyPerson,
  incomingPerson: LegacyPerson,
): LegacyPerson {
  const merged: LegacyPerson = { ...currentPerson };

  Object.keys(incomingPerson).forEach((key) => {
    if (key === 'entries' || key === 'expanded') return;
    const incomingValue = incomingPerson[key];
    const currentValue = merged[key];
    if (Array.isArray(incomingValue)) return;
    if (typeof incomingValue === 'object' && incomingValue !== null) {
      merged[key] = cloneUnknown(incomingValue);
      return;
    }
    if (!isNonEmptyValue(currentValue) && isNonEmptyValue(incomingValue)) {
      merged[key] = incomingValue;
      return;
    }
    if (key === 'archived' && incomingValue === true) merged.archived = true;
  });

  merged.expanded = false;
  merged.entries = mergeEntries(currentPerson.entries ?? [], incomingPerson.entries ?? []);
  return merged;
}

export function mergePeople(
  currentPeople: readonly LegacyPerson[] = [],
  incomingPeople: readonly LegacyPerson[] = [],
): LegacyPerson[] {
  const result: LegacyPerson[] = currentPeople.map((person) => ({
    ...flattenLegacyStages(person),
    expanded: false,
  }));
  const usedIndexes = new Set<number>();

  incomingPeople.map(flattenLegacyStages).forEach((incomingPerson) => {
    const matchIndex = incomingPerson.id
      ? result.findIndex((person) => person.id === incomingPerson.id)
      : result.findIndex((person, index) => {
          const fingerprint = personFingerprint(incomingPerson);
          return !usedIndexes.has(index) && !person.id && personFingerprint(person) === fingerprint;
        });

    if (matchIndex === -1) {
      result.push({ ...incomingPerson, expanded: false });
    } else {
      const currentPerson = result[matchIndex];
      if (currentPerson) {
        result[matchIndex] = mergePersonObjects(currentPerson, incomingPerson);
        usedIndexes.add(matchIndex);
      }
    }
  });
  return result;
}
