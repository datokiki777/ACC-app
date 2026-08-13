import { createStore, type StoreApi } from 'zustand/vanilla';

import type { AppRepository } from '../db/repository';
import {
  applyPayPeriodChange,
  applySalaryAmountChange,
  endSalaryWhenArchiving,
  resetSalaryWhenUnarchiving,
  syncPayDate,
} from '../domain/salary-workflows';
import type {
  AppMode,
  Currency,
  EntryCategory,
  EntryType,
  PayDelayMode,
  Person,
  ThemeMode,
} from '../types/domain';
import type {
  BackupMetadata,
  PersistedEntry,
  PersistedPerson,
  ReactBackupData,
} from '../types/persistence';
import {
  applyInspectedBackup,
  type BackupInspection,
  createBackupExport,
  type ImportMode,
  RestoreVerificationError,
} from '../services/backup';
import { createBackupSnapshot } from '../services/backup-health';
import type { RestoreVerificationReport } from '../services/restore-verification';

export type PeopleFilter = 'active' | 'archived';
export type SheetName =
  'none' | 'person-form' | 'entry-form' | 'statistics' | 'backup' | 'salary-sync';

export interface TransientUiState {
  sheet: SheetName;
  personId: string | null;
  entryId: string | null;
}

export interface PersonDraft {
  name: string;
  currency: Currency;
  tagLabel: string;
  tagColor: string;
  salaryEnabled: boolean;
  salaryAmount: number;
  salaryStartDate: string;
  salaryEndDate: string;
  salaryPayPeriodWeeks: number;
  salaryPayDelayMode: PayDelayMode;
  salaryAmountEffectiveDate?: string;
}

export interface EntryDraft {
  amount: number;
  type: EntryType;
  date: string;
  comment: string;
  category?: EntryCategory;
}

type UndoAction =
  | { kind: 'person'; mode: AppMode; index: number; person: PersistedPerson }
  | { kind: 'entry'; mode: AppMode; personId: string; index: number; entry: PersistedEntry };

export interface AppStoreState {
  initialized: boolean;
  loading: boolean;
  error: string | null;
  mode: AppMode;
  peopleByMode: Record<AppMode, PersistedPerson[]>;
  search: string;
  filter: PeopleFilter;
  expandedPersonId: string | null;
  theme: ThemeMode;
  ui: TransientUiState;
  undoAction: UndoAction | null;
  lastRestoreReport: RestoreVerificationReport | null;
  backupMetadata: BackupMetadata;
  initialize: () => Promise<void>;
  setMode: (mode: AppMode) => Promise<void>;
  setTheme: (theme: ThemeMode) => Promise<void>;
  setSearch: (search: string) => void;
  setFilter: (filter: PeopleFilter) => void;
  setExpandedPerson: (personId: string | null) => void;
  openSheet: (sheet: SheetName, personId?: string | null, entryId?: string | null) => void;
  closeSheet: () => void;
  addPerson: (draft: PersonDraft) => Promise<PersistedPerson>;
  editPerson: (personId: string, draft: PersonDraft) => Promise<void>;
  deletePerson: (personId: string) => Promise<void>;
  toggleArchive: (personId: string) => Promise<void>;
  addEntry: (personId: string, draft: EntryDraft) => Promise<PersistedEntry>;
  editEntry: (personId: string, entryId: string, draft: EntryDraft) => Promise<void>;
  deleteEntry: (personId: string, entryId: string) => Promise<void>;
  undoLastDeletion: () => Promise<void>;
  dismissUndo: () => void;
  syncSalary: (personId: string, adjustmentAmount: number, newAnchorDate: string) => Promise<void>;
  importBackup: (
    inspection: Extract<BackupInspection, { valid: true }>,
    mode: ImportMode,
  ) => Promise<RestoreVerificationReport>;
  exportBackup: () => Promise<ReactBackupData>;
  clearError: () => void;
}

export interface StoreDependencies {
  repository: AppRepository;
  now?: () => Date;
  createId?: () => string;
}

const EMPTY_UI: TransientUiState = { sheet: 'none', personId: null, entryId: null };

function defaultId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? `acc-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected application error';
}

function retainPersistedFields(original: PersistedPerson, updated: Person): PersistedPerson {
  return {
    ...original,
    ...updated,
    entries: updated.entries.map((entry) => ({ ...entry })),
  };
}

function personFromDraft(draft: PersonDraft, id: string, createdAt: string): PersistedPerson {
  return {
    id,
    name: draft.name.trim(),
    currency: draft.currency,
    tagLabel: draft.tagLabel.trim(),
    tagColor: draft.tagColor,
    archived: false,
    expanded: false,
    createdAt,
    entries: [],
    ...(draft.salaryEnabled
      ? {
          salaryAmount: draft.salaryAmount,
          salaryStartDate: draft.salaryStartDate,
          salaryEndDate: draft.salaryEndDate,
          salaryPayPeriodWeeks: draft.salaryPayPeriodWeeks,
          salaryPayDelayMode: draft.salaryPayDelayMode,
          salaryCurrency: draft.currency,
        }
      : {}),
  };
}

function parseDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d), 12);
}

function applyDraftToPerson(
  original: PersistedPerson,
  draft: PersonDraft,
  referenceDate: Date,
): PersistedPerson {
  let next = structuredClone(original);
  const wasConfigured = Boolean(original.salaryAmount && original.salaryStartDate);
  const amountChanged =
    wasConfigured && draft.salaryEnabled && original.salaryAmount !== draft.salaryAmount;
  const periodWeeksChanged =
    wasConfigured &&
    Number(original.salaryPayPeriodWeeks ?? original.salaryPayDay ?? 1) !==
      draft.salaryPayPeriodWeeks;
  const startDateChanged =
    wasConfigured && draft.salaryEnabled && original.salaryStartDate !== draft.salaryStartDate;

  if (draft.salaryEnabled && amountChanged && draft.salaryAmountEffectiveDate) {
    next = retainPersistedFields(
      next,
      applySalaryAmountChange(
        next,
        draft.salaryAmount,
        parseDateInput(draft.salaryAmountEffectiveDate) ?? referenceDate,
      ),
    );
  } else if (draft.salaryEnabled && periodWeeksChanged) {
    next = retainPersistedFields(
      next,
      applyPayPeriodChange(next, draft.salaryPayPeriodWeeks, referenceDate),
    );
  } else if (startDateChanged) {
    next.salaryPeriodAnchorDate = draft.salaryStartDate;
    next.salaryAccruedBaseline = 0;
  }
  next.name = draft.name.trim();
  next.tagLabel = draft.tagLabel.trim();
  next.tagColor = draft.tagColor;
  if (draft.salaryEnabled) {
    next.salaryAmount = draft.salaryAmount;
    next.salaryStartDate = draft.salaryStartDate;
    next.salaryEndDate = draft.salaryEndDate;
    next.salaryPayPeriodWeeks = draft.salaryPayPeriodWeeks;
    next.salaryPayDelayMode = draft.salaryPayDelayMode;
    next.salaryCurrency = next.salaryCurrency ?? next.currency;
  } else {
    delete next.salaryAmount;
    delete next.salaryStartDate;
    delete next.salaryEndDate;
    delete next.salaryPayPeriodWeeks;
    delete next.salaryPayDay;
    delete next.salaryPayDelayMode;
    delete next.salaryCurrency;
    delete next.salaryPeriodAnchorDate;
    delete next.salaryAccruedBaseline;
  }
  return next;
}

function entryFromDraft(draft: EntryDraft, id: string): PersistedEntry {
  const category = draft.category;
  return {
    id,
    amount: Math.round(draft.amount),
    type: draft.type,
    date: draft.date,
    comment: draft.comment.trim(),
    ...(category ? { category } : {}),
  };
}

export function createAppStore(dependencies: StoreDependencies): StoreApi<AppStoreState> {
  const repository = dependencies.repository;
  const now = dependencies.now ?? (() => new Date());
  const createId = dependencies.createId ?? defaultId;

  return createStore<AppStoreState>()((set, get) => {
    const persistModePeople = async (mode: AppMode, people: PersistedPerson[]) => {
      await repository.replacePeople(mode, people);
      set((state) => ({ peopleByMode: { ...state.peopleByMode, [mode]: people } }));
    };

    const withError = async <T>(operation: () => Promise<T>): Promise<T> => {
      try {
        set({ error: null });
        return await operation();
      } catch (error) {
        set({ error: messageFrom(error) });
        throw error;
      }
    };

    return {
      initialized: false,
      loading: false,
      error: null,
      mode: 'personal',
      peopleByMode: { personal: [], work: [] },
      search: '',
      filter: 'active',
      expandedPersonId: null,
      theme: 'system',
      ui: EMPTY_UI,
      undoAction: null,
      lastRestoreReport: null,
      backupMetadata: { lastBackup: '', count: 0 },

      async initialize() {
        if (get().initialized || get().loading) return;
        set({ loading: true, error: null });
        try {
          await repository.initialize();
          const [personal, work, mode, theme, backupMetadata] = await Promise.all([
            repository.getPeople('personal'),
            repository.getPeople('work'),
            repository.getMode(),
            repository.getTheme(),
            repository.getBackupMetadata(),
          ]);
          set({
            initialized: true,
            loading: false,
            peopleByMode: { personal, work },
            mode,
            theme,
            backupMetadata,
          });
        } catch (error) {
          set({ loading: false, error: messageFrom(error) });
        }
      },

      async setMode(mode) {
        await withError(async () => {
          await repository.setMode(mode);
          set({ mode, search: '', filter: 'active', expandedPersonId: null });
        });
      },

      async setTheme(theme) {
        await withError(async () => {
          await repository.setTheme(theme);
          set({ theme });
        });
      },

      setSearch(search) {
        set({ search });
      },
      setFilter(filter) {
        set({ filter, expandedPersonId: null });
      },
      setExpandedPerson(personId) {
        set({ expandedPersonId: personId });
      },
      openSheet(sheet, personId = null, entryId = null) {
        set({ ui: { sheet, personId, entryId } });
      },
      closeSheet() {
        set({ ui: EMPTY_UI });
      },

      async addPerson(draft) {
        return withError(async () => {
          const state = get();
          const created = personFromDraft(draft, createId(), now().toISOString());
          await persistModePeople(state.mode, [created, ...state.peopleByMode[state.mode]]);
          return created;
        });
      },

      async editPerson(personId, draft) {
        await withError(async () => {
          const state = get();
          const people = state.peopleByMode[state.mode].map((person) =>
            person.id === personId ? applyDraftToPerson(person, draft, now()) : person,
          );
          await persistModePeople(state.mode, people);
        });
      },

      async deletePerson(personId) {
        await withError(async () => {
          const state = get();
          const people = state.peopleByMode[state.mode];
          const index = people.findIndex((person) => person.id === personId);
          if (index < 0) return;
          const removed = people[index];
          if (!removed) return;
          await persistModePeople(
            state.mode,
            people.filter((person) => person.id !== personId),
          );
          set({ undoAction: { kind: 'person', mode: state.mode, index, person: removed } });
        });
      },

      async toggleArchive(personId) {
        await withError(async () => {
          const state = get();
          const people = state.peopleByMode[state.mode].map((person) => {
            if (person.id !== personId) return person;
            const isSalaried =
              state.mode === 'work' && person.salaryAmount && person.salaryStartDate;
            if (person.archived && isSalaried) {
              return retainPersistedFields(person, resetSalaryWhenUnarchiving(person, now()));
            }
            if (!person.archived && isSalaried) {
              return retainPersistedFields(
                person,
                endSalaryWhenArchiving({ ...person, archived: true, expanded: false }, now()),
              );
            }
            return { ...person, archived: !person.archived, expanded: false };
          });
          await persistModePeople(state.mode, people);
          set({ expandedPersonId: null });
        });
      },

      async addEntry(personId, draft) {
        return withError(async () => {
          const state = get();
          const created = entryFromDraft(draft, createId());
          const people = state.peopleByMode[state.mode].map((person) =>
            person.id === personId ? { ...person, entries: [created, ...person.entries] } : person,
          );
          await persistModePeople(state.mode, people);
          return created;
        });
      },

      async editEntry(personId, entryId, draft) {
        await withError(async () => {
          const state = get();
          const people = state.peopleByMode[state.mode].map((person) =>
            person.id === personId
              ? {
                  ...person,
                  entries: person.entries.map((entry) =>
                    entry.id === entryId ? { ...entry, ...entryFromDraft(draft, entryId) } : entry,
                  ),
                }
              : person,
          );
          await persistModePeople(state.mode, people);
        });
      },

      async deleteEntry(personId, entryId) {
        await withError(async () => {
          const state = get();
          let removed: PersistedEntry | undefined;
          let removedIndex = -1;
          const people = state.peopleByMode[state.mode].map((person) => {
            if (person.id !== personId) return person;
            removedIndex = person.entries.findIndex((entry) => entry.id === entryId);
            removed = person.entries[removedIndex];
            return { ...person, entries: person.entries.filter((entry) => entry.id !== entryId) };
          });
          if (!removed || removedIndex < 0) return;
          await persistModePeople(state.mode, people);
          set({
            undoAction: {
              kind: 'entry',
              mode: state.mode,
              personId,
              index: removedIndex,
              entry: removed,
            },
          });
        });
      },

      async undoLastDeletion() {
        const undo = get().undoAction;
        if (!undo) return;
        await withError(async () => {
          const people = [...get().peopleByMode[undo.mode]];
          if (undo.kind === 'person') {
            people.splice(Math.min(undo.index, people.length), 0, undo.person);
          } else {
            const personIndex = people.findIndex((person) => person.id === undo.personId);
            const target = people[personIndex];
            if (!target) return;
            const entries = [...target.entries];
            entries.splice(Math.min(undo.index, entries.length), 0, undo.entry);
            people[personIndex] = { ...target, entries };
          }
          await persistModePeople(undo.mode, people);
          set({ undoAction: null });
        });
      },

      dismissUndo() {
        set({ undoAction: null });
      },

      async syncSalary(personId, adjustmentAmount, newAnchorDate) {
        await withError(async () => {
          const state = get();
          const people = state.peopleByMode[state.mode].map((person) =>
            person.id === personId
              ? retainPersistedFields(
                  person,
                  syncPayDate(person, {
                    adjustmentAmount,
                    newAnchorDate,
                    adjustmentEntryId: createId(),
                    referenceDate: now(),
                  }),
                )
              : person,
          );
          await persistModePeople(state.mode, people);
        });
      },

      async importBackup(inspection, importMode) {
        return withError(async () => {
          let report: RestoreVerificationReport;
          try {
            report = await applyInspectedBackup(
              repository,
              inspection,
              importMode,
              now(),
              createId,
            );
          } catch (error) {
            if (error instanceof RestoreVerificationError) {
              set({ lastRestoreReport: error.report });
            }
            throw error;
          }
          const [personal, work] = await Promise.all([
            repository.getPeople('personal'),
            repository.getPeople('work'),
          ]);
          set({ peopleByMode: { personal, work }, lastRestoreReport: report });
          return report;
        });
      },

      async exportBackup() {
        return withError(async () => {
          const backup = await createBackupExport(repository, now());
          const metadata = await repository.getBackupMetadata();
          const snapshot = createBackupSnapshot(backup);
          const nextMetadata: BackupMetadata = {
            lastBackup: backup.exportDate,
            count: metadata.count + 1,
            ...snapshot,
          };
          await repository.setBackupMetadata(nextMetadata);
          set({ backupMetadata: nextMetadata });
          return backup;
        });
      },

      clearError() {
        set({ error: null });
      },
    };
  });
}
