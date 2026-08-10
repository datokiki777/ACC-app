import 'fake-indexeddb/auto';

import { createAccReactDatabase, type AccReactDatabase } from '../db/database';
import { createAppRepository } from '../db/repository';
import { calculateSalary } from '../domain/salary';
import type { PersonDraft } from './app-store';
import { createAppStore } from './app-store';

const NOW = new Date(2026, 7, 6, 12);

function personalDraft(name = 'Alex'): PersonDraft {
  return {
    name,
    currency: 'EUR',
    tagLabel: '',
    tagColor: '',
    salaryEnabled: false,
    salaryAmount: 0,
    salaryStartDate: '',
    salaryEndDate: '',
    salaryPayPeriodWeeks: 2,
    salaryPayDelayMode: 'none',
  };
}

function salaryDraft(): PersonDraft {
  return {
    ...personalDraft('Employee'),
    salaryEnabled: true,
    salaryAmount: 400,
    salaryStartDate: '2026-07-01',
    salaryPayPeriodWeeks: 1,
    salaryPayDelayMode: '2weeks',
  };
}

describe('Zustand application actions', () => {
  let database: AccReactDatabase;
  let ids: string[];

  beforeEach(() => {
    database = createAccReactDatabase(`store-test-${crypto.randomUUID()}`);
    ids = ['person-id', 'entry-id', 'sync-id', 'next-id'];
  });

  afterEach(async () => {
    database.close();
    await database.delete();
  });

  function makeStore() {
    return createAppStore({
      repository: createAppRepository(database),
      now: () => new Date(NOW),
      createId: () => ids.shift() ?? crypto.randomUUID(),
    });
  }

  it('initializes and persists mode, theme, search, filter, and expanded state', async () => {
    const store = makeStore();
    await store.getState().initialize();
    await store.getState().setMode('work');
    await store.getState().setTheme('dark');
    store.getState().setSearch('alex');
    store.getState().setFilter('archived');
    store.getState().setExpandedPerson('person-id');
    expect(store.getState()).toMatchObject({
      initialized: true,
      mode: 'work',
      theme: 'dark',
      search: 'alex',
      filter: 'archived',
      expandedPersonId: 'person-id',
    });
  });

  it('performs person and entry CRUD with undo', async () => {
    const store = makeStore();
    await store.getState().initialize();
    const created = await store.getState().addPerson(personalDraft());
    expect(created.id).toBe('person-id');
    await store.getState().editPerson(created.id, personalDraft('Edited'));
    expect(store.getState().peopleByMode.personal[0]?.name).toBe('Edited');

    const addedEntry = await store.getState().addEntry(created.id, {
      amount: 100.6,
      type: 'Received',
      date: '2026-08-06',
      comment: 'Loan',
    });
    expect(addedEntry).toMatchObject({ id: 'entry-id', amount: 101, type: 'Received' });
    await store.getState().editEntry(created.id, addedEntry.id, {
      amount: 75,
      type: 'Gave',
      date: '2026-08-05',
      comment: 'Edited entry',
    });
    expect(store.getState().peopleByMode.personal[0]?.entries[0]).toMatchObject({
      amount: 75,
      type: 'Gave',
    });
    await store.getState().deleteEntry(created.id, addedEntry.id);
    expect(store.getState().peopleByMode.personal[0]?.entries).toHaveLength(0);
    await store.getState().undoLastDeletion();
    expect(store.getState().peopleByMode.personal[0]?.entries).toHaveLength(1);

    await store.getState().deletePerson(created.id);
    expect(store.getState().peopleByMode.personal).toHaveLength(0);
    await store.getState().undoLastDeletion();
    expect(store.getState().peopleByMode.personal[0]?.id).toBe(created.id);
  });

  it('keeps Personal and Work CRUD isolated', async () => {
    const store = makeStore();
    await store.getState().initialize();
    await store.getState().addPerson(personalDraft('Personal'));
    await store.getState().setMode('work');
    await store.getState().addPerson(personalDraft('Work'));
    expect(store.getState().peopleByMode.personal[0]?.name).toBe('Personal');
    expect(store.getState().peopleByMode.work[0]?.name).toBe('Work');
  });

  it('integrates pay-period banking, salary entries, sync, archive, and unarchive', async () => {
    const store = makeStore();
    await store.getState().initialize();
    await store.getState().setMode('work');
    const employee = await store.getState().addPerson(salaryDraft());
    await store.getState().addEntry(employee.id, {
      amount: 100,
      type: 'Received',
      date: '2026-07-08',
      comment: 'Pay',
      category: 'salary',
    });
    const paid = store.getState().peopleByMode.work[0]!;
    expect(paid.entries[0]?.type).toBe('Received');

    await store.getState().editPerson(employee.id, {
      ...salaryDraft(),
      salaryPayPeriodWeeks: 2,
    });
    const changed = store.getState().peopleByMode.work[0]!;
    expect(changed.salaryPeriodAnchorDate).toBe('2026-08-06');
    expect(changed.salaryAccruedBaseline).toBeGreaterThan(0);

    await store.getState().syncSalary(employee.id, 50, '2026-08-01');
    const synced = store.getState().peopleByMode.work[0]!;
    expect(synced.salaryPeriodAnchorDate).toBe('2026-08-01');
    expect(synced.entries[0]?.category).toBe('salary');

    await store.getState().toggleArchive(employee.id);
    const archived = store.getState().peopleByMode.work[0]!;
    expect(archived.archived).toBe(true);
    expect(archived.salaryEndDate).toBe('2026-08-06');

    await store.getState().toggleArchive(employee.id);
    const unarchived = store.getState().peopleByMode.work[0]!;
    expect(unarchived.archived).toBe(false);
    expect(unarchived.salaryEndDate).toBe('');
    expect(unarchived.salaryPeriodAnchorDate).toBe('2026-08-06');
    expect(calculateSalary(unarchived, NOW).due).toBe(0);
  });

  it('does not overwrite an already-set salary end date when archiving', async () => {
    const store = makeStore();
    await store.getState().initialize();
    await store.getState().setMode('work');
    await store.getState().addPerson(salaryDraft());
    const employee = store.getState().peopleByMode.work[0]!;

    await store.getState().editPerson(employee.id, {
      ...salaryDraft(),
      salaryEndDate: '2026-09-01',
    });
    await store.getState().toggleArchive(employee.id);
    const archived = store.getState().peopleByMode.work[0]!;
    expect(archived.archived).toBe(true);
    expect(archived.salaryEndDate).toBe('2026-09-01');
  });

  it('leaves non-salaried people unaffected by the salary end date logic when archived', async () => {
    const store = makeStore();
    await store.getState().initialize();
    await store.getState().addPerson(personalDraft('Casual'));
    const person = store.getState().peopleByMode.personal[0]!;

    await store.getState().toggleArchive(person.id);
    const archived = store.getState().peopleByMode.personal[0]!;
    expect(archived.archived).toBe(true);
    expect(archived.salaryEndDate).toBeFalsy();
  });

  it('reloads persisted application data in a new store', async () => {
    const first = makeStore();
    await first.getState().initialize();
    await first.getState().addPerson(personalDraft('Persist me'));

    const second = makeStore();
    await second.getState().initialize();
    expect(second.getState().peopleByMode.personal[0]?.name).toBe('Persist me');
  });

  it('records successful JSON exports in backup metadata', async () => {
    const repository = createAppRepository(database);
    const store = createAppStore({ repository, now: () => new Date(NOW) });
    await store.getState().initialize();

    const exported = await store.getState().exportBackup();

    expect(exported.exportDate).toBe(NOW.toISOString());
    expect(await repository.getBackupMetadata()).toMatchObject({
      lastBackup: NOW.toISOString(),
      count: 1,
      entryCount: 0,
    });
    expect(store.getState().backupMetadata.dataSignature).toBeTruthy();
  });
});
