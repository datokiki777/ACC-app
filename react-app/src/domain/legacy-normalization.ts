import type { LegacyEntry, LegacyPerson } from '../types/domain';

function legacyEntryTimestamp(entry: LegacyEntry): number {
  if (!entry.date) return 0;
  const timestamp = new Date(entry.date).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function flattenLegacyStages(person: LegacyPerson): LegacyPerson {
  if (!Array.isArray(person.stages)) {
    return {
      ...person,
      currency: person.currency ?? 'EUR',
      entries: Array.isArray(person.entries) ? person.entries.map((entry) => ({ ...entry })) : [],
    };
  }

  const stages = person.stages;
  const openStage = stages.find((stage) => !stage.closed);
  const lastStage = stages.at(-1);
  const currency = openStage?.currency ?? lastStage?.currency ?? 'EUR';
  const entries = stages.flatMap((stage) => (stage.entries ?? []).map((entry) => ({ ...entry })));
  entries.sort((first, second) => legacyEntryTimestamp(second) - legacyEntryTimestamp(first));

  const migrated: LegacyPerson = { ...person, currency, entries };
  delete migrated.stages;
  return migrated;
}

export function normalizeImportedPeople(people: readonly LegacyPerson[]): LegacyPerson[] {
  return people.map((person) => flattenLegacyStages({ ...person, expanded: false }));
}
