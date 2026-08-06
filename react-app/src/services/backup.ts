import { mergePeople } from '../domain/backup-merge';
import { normalizeAmount } from '../domain/entries';
import { flattenLegacyStages } from '../domain/legacy-normalization';
import { exportedBackupSchema } from '../domain/schemas';
import type { AppRepository } from '../db/repository';
import type {
  Currency,
  EntryType,
  ExportedBackupData,
  LegacyEntry,
  LegacyPerson,
} from '../types/domain';
import type { PersistedEntry, PersistedPerson, ReactBackupData } from '../types/persistence';
import {
  type ModePeopleData,
  type RestoreVerificationReport,
  verifyRestoredData,
} from './restore-verification';

export type ImportMode = 'replace' | 'merge';

export interface BackupCounts {
  personalPeople: number;
  workPeople: number;
  entries: number;
}

export type BackupInspection =
  | {
      valid: true;
      filename: string;
      exportDate: string;
      counts: BackupCounts;
      legacy: ExportedBackupData;
      normalized: ModePeopleData;
    }
  | {
      valid: false;
      filename: string;
      exportDate: '';
      counts: BackupCounts;
      errors: string[];
    };

export class RestoreVerificationError extends Error {
  public constructor(public readonly report: RestoreVerificationReport) {
    super(`Restore verification failed: ${report.failures.join(', ')}`);
    this.name = 'RestoreVerificationError';
  }
}

type IdFactory = () => string;

function defaultIdFactory(): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? `acc-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function normalizeEntry(entry: LegacyEntry, createId: IdFactory): PersistedEntry {
  const amountNumber = Number(entry.amount);
  if (!Number.isFinite(amountNumber)) throw new Error('Entry amount must be a finite number');
  if (entry.type !== 'Gave' && entry.type !== 'Received') {
    throw new Error('Entry type must be Gave or Received');
  }
  if (typeof entry.date !== 'string') throw new Error('Entry date must be a string');
  const id = typeof entry.id === 'string' && entry.id ? entry.id : createId();
  const type: EntryType = entry.type;
  return {
    ...entry,
    id,
    amount: normalizeAmount(amountNumber),
    type,
    date: entry.date,
    ...(typeof entry.comment === 'string' ? { comment: entry.comment } : {}),
    ...(entry.category === 'salary' || entry.category === 'gift'
      ? { category: entry.category }
      : {}),
  };
}

export function normalizeLegacyPerson(
  person: LegacyPerson,
  createId: IdFactory = defaultIdFactory,
): PersistedPerson {
  const flattened = flattenLegacyStages(person);
  if (typeof flattened.name !== 'string' || !flattened.name.trim()) {
    throw new Error('Every person must have a name');
  }
  const id = typeof flattened.id === 'string' && flattened.id ? flattened.id : createId();
  const currency: Currency = flattened.currency ?? 'EUR';
  const entries = (flattened.entries ?? []).map((entry) => normalizeEntry(entry, createId));
  const knownKeys = new Set([
    'id',
    'name',
    'currency',
    'entries',
    'stages',
    'note',
    'tagLabel',
    'tagColor',
    'archived',
    'expanded',
    'createdAt',
    'salaryAmount',
    'salaryStartDate',
    'salaryEndDate',
    'salaryPayPeriodWeeks',
    'salaryPayDay',
    'salaryPayDelayMode',
    'salaryCurrency',
    'salaryPeriodAnchorDate',
    'salaryAccruedBaseline',
  ]);
  const unknownFields = Object.fromEntries(
    Object.entries(flattened).filter(([key]) => !knownKeys.has(key)),
  );
  const normalized: PersistedPerson = {
    ...unknownFields,
    id,
    name: flattened.name,
    currency,
    entries,
    archived: Boolean(flattened.archived),
    expanded: false,
    ...(typeof flattened.note === 'string' ? { note: flattened.note } : {}),
    ...(typeof flattened.tagLabel === 'string' ? { tagLabel: flattened.tagLabel } : {}),
    ...(typeof flattened.tagColor === 'string' ? { tagColor: flattened.tagColor } : {}),
    ...(typeof flattened.createdAt === 'string' ? { createdAt: flattened.createdAt } : {}),
    ...(flattened.salaryAmount === undefined
      ? {}
      : { salaryAmount: normalizeAmount(flattened.salaryAmount) }),
    ...(typeof flattened.salaryStartDate === 'string'
      ? { salaryStartDate: flattened.salaryStartDate }
      : {}),
    ...(typeof flattened.salaryEndDate === 'string'
      ? { salaryEndDate: flattened.salaryEndDate }
      : {}),
    ...(flattened.salaryPayPeriodWeeks === undefined && flattened.salaryPayDay === undefined
      ? {}
      : {
          salaryPayPeriodWeeks: Math.min(
            52,
            Math.max(1, Number(flattened.salaryPayPeriodWeeks ?? flattened.salaryPayDay ?? 1)),
          ),
        }),
    ...(flattened.salaryPayDelayMode ? { salaryPayDelayMode: flattened.salaryPayDelayMode } : {}),
    ...(flattened.salaryCurrency ? { salaryCurrency: flattened.salaryCurrency } : {}),
    ...(typeof flattened.salaryPeriodAnchorDate === 'string'
      ? { salaryPeriodAnchorDate: flattened.salaryPeriodAnchorDate }
      : {}),
    ...(flattened.salaryAccruedBaseline === undefined
      ? {}
      : { salaryAccruedBaseline: normalizeAmount(flattened.salaryAccruedBaseline) }),
  };
  return normalized;
}

export function normalizeLegacyBackup(
  backup: ExportedBackupData,
  createId: IdFactory = defaultIdFactory,
): ModePeopleData {
  return {
    personal: backup.personal.map((person) => normalizeLegacyPerson(person, createId)),
    work: backup.work.map((person) => normalizeLegacyPerson(person, createId)),
  };
}

function emptyCounts(): BackupCounts {
  return { personalPeople: 0, workPeople: 0, entries: 0 };
}

export function inspectBackupText(
  text: string,
  filename: string,
  createId: IdFactory = defaultIdFactory,
): BackupInspection {
  try {
    const json: unknown = JSON.parse(text);
    const result = exportedBackupSchema.safeParse(json);
    if (!result.success) {
      return {
        valid: false,
        filename,
        exportDate: '',
        counts: emptyCounts(),
        errors: result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
      };
    }
    const legacy = result.data as unknown as ExportedBackupData;
    const normalized = normalizeLegacyBackup(legacy, createId);
    return {
      valid: true,
      filename,
      exportDate: typeof legacy.exportDate === 'string' ? legacy.exportDate : '',
      counts: {
        personalPeople: normalized.personal.length,
        workPeople: normalized.work.length,
        entries: [...normalized.personal, ...normalized.work].reduce(
          (sum, person) => sum + person.entries.length,
          0,
        ),
      },
      legacy,
      normalized,
    };
  } catch (error) {
    return {
      valid: false,
      filename,
      exportDate: '',
      counts: emptyCounts(),
      errors: [error instanceof Error ? error.message : 'Backup could not be read'],
    };
  }
}

function persistedAsLegacy(people: readonly PersistedPerson[]): LegacyPerson[] {
  return structuredClone(people) as LegacyPerson[];
}

export async function applyInspectedBackup(
  repository: AppRepository,
  inspection: Extract<BackupInspection, { valid: true }>,
  mode: ImportMode,
  referenceDate: Date,
  createId: IdFactory = defaultIdFactory,
): Promise<RestoreVerificationReport> {
  return repository.transactAll(async (transactionRepository) => {
    let expected = inspection.normalized;
    if (mode === 'merge') {
      const currentPersonal = await transactionRepository.getPeople('personal');
      const currentWork = await transactionRepository.getPeople('work');
      expected = {
        personal: mergePeople(persistedAsLegacy(currentPersonal), inspection.legacy.personal).map(
          (person) => normalizeLegacyPerson(person, createId),
        ),
        work: mergePeople(persistedAsLegacy(currentWork), inspection.legacy.work).map((person) =>
          normalizeLegacyPerson(person, createId),
        ),
      };
    }

    await transactionRepository.replaceAll(expected.personal, expected.work);
    const actual = {
      personal: await transactionRepository.getPeople('personal'),
      work: await transactionRepository.getPeople('work'),
    };
    const report = verifyRestoredData(expected, actual, referenceDate);
    if (!report.success) throw new RestoreVerificationError(report);
    return report;
  });
}

export async function createBackupExport(
  repository: AppRepository,
  referenceDate = new Date(),
): Promise<ReactBackupData> {
  return {
    personal: await repository.getPeople('personal'),
    work: await repository.getPeople('work'),
    exportDate: referenceDate.toISOString(),
  };
}

export function downloadBackup(backup: ReactBackupData): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `acc-backup-${backup.exportDate.slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
