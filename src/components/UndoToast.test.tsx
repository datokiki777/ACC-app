import 'fake-indexeddb/auto';

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

import { createAccReactDatabase, type AccReactDatabase } from '../db/database';
import { createAppRepository } from '../db/repository';
import { createAppStore, type PersonDraft } from '../store/app-store';
import { AppStoreProvider } from '../store/provider';
import { UndoToast } from './UndoToast';

const personDraft: PersonDraft = {
  name: 'Undo target',
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

describe('UndoToast', () => {
  let database: AccReactDatabase;

  afterEach(async () => {
    vi.useRealTimers();
    cleanup();
    database.close();
    await database.delete();
  });

  async function setupDeletedPerson() {
    database = createAccReactDatabase(`undo-toast-${crypto.randomUUID()}`);
    const store = createAppStore({ repository: createAppRepository(database) });
    await store.getState().initialize();
    const person = await store.getState().addPerson(personDraft);
    await store.getState().deletePerson(person.id);
    return { person, store };
  }

  it('auto-dismisses and resets the timer when a new undo action replaces the first', async () => {
    const { store } = await setupDeletedPerson();
    const firstAction = store.getState().undoAction;
    expect(firstAction?.kind).toBe('person');
    vi.useFakeTimers();
    render(
      <AppStoreProvider store={store}>
        <UndoToast />
      </AppStoreProvider>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Person deleted');
    await act(() => vi.advanceTimersByTime(3000));
    if (firstAction?.kind !== 'person') throw new Error('Expected person undo action');
    act(() => {
      store.setState({
        undoAction: {
          ...firstAction,
          person: { ...firstAction.person, id: 'replacement-person' },
        },
      });
    });

    await act(() => vi.advanceTimersByTime(1700));
    expect(screen.getByRole('status')).not.toHaveClass('is-exiting');
    expect(store.getState().undoAction).not.toBeNull();

    await act(() => vi.advanceTimersByTime(2800));
    expect(screen.getByRole('status')).toHaveClass('is-exiting');
    await act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(store.getState().undoAction).toBeNull();
  });

  it('restores the deleted person and closes immediately when Undo is pressed', async () => {
    const { person, store } = await setupDeletedPerson();
    render(
      <AppStoreProvider store={store}>
        <UndoToast />
      </AppStoreProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(store.getState().peopleByMode.personal.map((item) => item.id)).toContain(person.id);
    expect(store.getState().undoAction).toBeNull();
  });
});
