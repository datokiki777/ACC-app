import 'fake-indexeddb/auto';

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createAccReactDatabase, type AccReactDatabase } from '../db/database';
import { createAppRepository } from '../db/repository';
import { createAppStore, type PersonDraft } from '../store/app-store';
import { AppStoreProvider } from '../store/provider';
import { App } from './App';

function draft(name: string): PersonDraft {
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

function swipe(element: HTMLElement, startX: number, endX: number, endY = 20) {
  fireEvent.pointerDown(element, {
    button: 0,
    clientX: startX,
    clientY: 20,
    isPrimary: true,
    pointerId: 1,
  });
  fireEvent.pointerMove(element, {
    clientX: endX,
    clientY: endY,
    isPrimary: true,
    pointerId: 1,
  });
  fireEvent.pointerUp(element, {
    clientX: endX,
    clientY: endY,
    isPrimary: true,
    pointerId: 1,
  });
}

async function findPersonSummary(name: string) {
  const label = await screen.findByText(name, { selector: '.person-name-row strong' });
  const summary = label.closest('button');
  expect(summary).toBeInstanceOf(HTMLButtonElement);
  return summary as HTMLButtonElement;
}

describe('ACC application', () => {
  let database: AccReactDatabase;

  beforeEach(() => {
    database = createAccReactDatabase(`app-test-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    cleanup();
    database.close();
    await database.delete();
  });

  function renderApp() {
    const store = createAppStore({ repository: createAppRepository(database) });
    render(
      <AppStoreProvider store={store}>
        <App />
      </AppStoreProvider>,
    );
    return store;
  }

  it('renders the initialized application shell', async () => {
    const store = renderApp();

    await waitFor(() => expect(store.getState().initialized).toBe(true), { timeout: 3000 });
    expect(screen.getByRole('heading', { name: 'No records yet' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Data and backup' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Statistics' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add person' })).toBeInTheDocument();
  });

  it('keeps Personal and Work data isolated when switching modes', async () => {
    const user = userEvent.setup();
    const store = renderApp();
    await waitFor(() => expect(store.getState().initialized).toBe(true));
    await waitForElementToBeRemoved(() => screen.queryByRole('status', { name: 'ACC is loading' }));
    await act(async () => store.getState().addPerson(draft('Personal contact')));

    expect(await screen.findByText('Personal contact')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Work' }));

    expect(screen.getByRole('button', { name: 'Work' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('Personal contact')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No records yet' })).toBeInTheDocument();
  });

  it('applies and persists an explicitly selected theme', async () => {
    const user = userEvent.setup();
    const store = renderApp();
    await waitFor(() => expect(store.getState().initialized).toBe(true));

    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(store.getState().theme).toBe('dark');

    await user.click(screen.getByRole('button', { name: 'Switch to light theme' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(store.getState().theme).toBe('light');
  });

  it('configures mobile text inputs without personal autofill', async () => {
    const user = userEvent.setup();
    const store = renderApp();
    await waitFor(() => expect(store.getState().initialized).toBe(true));

    const search = screen.getByRole('searchbox', { name: 'Search by name' });
    expect(search).toHaveAttribute('autocomplete', 'off');
    expect(search).toHaveAttribute('autocapitalize', 'none');
    expect(search).toHaveAttribute('inputmode', 'search');

    await user.click(screen.getByRole('button', { name: 'Add person' }));
    const name = screen.getByRole('textbox', { name: /^Name$/ });
    const tag = screen.getByRole('textbox', { name: 'Tag optional' });
    expect(name).toHaveAttribute('autocomplete', 'off');
    expect(name).toHaveAttribute('autocapitalize', 'words');
    expect(tag).toHaveAttribute('autocomplete', 'off');
    expect(tag).toHaveAttribute('spellcheck', 'false');
  });

  it('reveals swipe actions, snaps back small swipes, and preserves normal expansion', async () => {
    const user = userEvent.setup();
    const store = renderApp();
    await waitFor(() => expect(store.getState().initialized).toBe(true));
    await act(async () => store.getState().addPerson(draft('Swipe target')));

    const summary = await findPersonSummary('Swipe target');
    const deleteAction = screen.getByLabelText('Delete Swipe target');
    swipe(summary, 220, 190);
    expect(deleteAction).toHaveAttribute('tabindex', '-1');
    expect(summary).toHaveStyle({ transform: 'translate3d(0px, 0, 0)' });

    await new Promise((resolve) => window.setTimeout(resolve, 0));
    await user.click(summary);
    expect(summary).toHaveAttribute('aria-expanded', 'true');

    await user.click(summary);
    swipe(summary, 240, 120);
    await waitFor(() => expect(deleteAction).toHaveAttribute('tabindex', '0'));
    expect(summary).toHaveStyle({ transform: 'translate3d(-92px, 0, 0)' });
  });

  it('archives and unarchives through intentional right swipes', async () => {
    const user = userEvent.setup();
    const store = renderApp();
    await waitFor(() => expect(store.getState().initialized).toBe(true));
    await act(async () => store.getState().addPerson(draft('Archive target')));

    let summary = await findPersonSummary('Archive target');
    swipe(summary, 100, 220);
    const archiveAction = screen.getByRole('button', { name: 'Archive Archive target' });
    await waitFor(() => expect(archiveAction).toHaveAttribute('tabindex', '0'));
    await user.click(archiveAction);
    await waitFor(() => expect(store.getState().peopleByMode.personal[0]?.archived).toBe(true));

    await user.click(screen.getByRole('button', { name: /Archived 1/ }));
    summary = await findPersonSummary('Archive target');
    swipe(summary, 100, 220);
    const unarchiveAction = screen.getByRole('button', { name: 'Unarchive Archive target' });
    await waitFor(() => expect(unarchiveAction).toHaveAttribute('tabindex', '0'));
    await user.click(unarchiveAction);
    await waitFor(() => expect(store.getState().peopleByMode.personal[0]?.archived).toBe(false));
  });

  it('keeps only one swipe open and ignores vertical scroll gestures', async () => {
    const store = renderApp();
    await waitFor(() => expect(store.getState().initialized).toBe(true));
    await act(async () => {
      await store.getState().addPerson(draft('First target'));
      await store.getState().addPerson(draft('Second target'));
    });

    const firstSummary = await findPersonSummary('First target');
    const secondSummary = await findPersonSummary('Second target');
    const firstDelete = screen.getByLabelText('Delete First target');
    const secondDelete = screen.getByLabelText('Delete Second target');

    swipe(firstSummary, 240, 120);
    await waitFor(() => expect(firstDelete).toHaveAttribute('tabindex', '0'));
    swipe(secondSummary, 240, 120);
    await waitFor(() => {
      expect(firstDelete).toHaveAttribute('tabindex', '-1');
      expect(secondDelete).toHaveAttribute('tabindex', '0');
    });

    fireEvent.pointerDown(screen.getByRole('searchbox', { name: 'Search by name' }));
    await waitFor(() => expect(secondDelete).toHaveAttribute('tabindex', '-1'));
    swipe(secondSummary, 180, 186, 110);
    expect(secondDelete).toHaveAttribute('tabindex', '-1');
    expect(secondSummary).toHaveStyle({ transform: 'translate3d(0px, 0, 0)' });
  });

  it('requires the custom ACC dialog before swipe deletion', async () => {
    const user = userEvent.setup();
    const store = renderApp();
    await waitFor(() => expect(store.getState().initialized).toBe(true));
    await act(async () => store.getState().addPerson(draft('Delete target')));

    const summary = await findPersonSummary('Delete target');
    swipe(summary, 240, 120);
    await user.click(screen.getByRole('button', { name: 'Delete Delete target' }));

    let dialog = screen.getByRole('dialog', { name: 'Delete?' });
    expect(
      within(dialog).getByText('Are you sure you want to delete Delete target?'),
    ).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(store.getState().peopleByMode.personal).toHaveLength(1);

    swipe(summary, 240, 120);
    await user.click(screen.getByRole('button', { name: 'Delete Delete target' }));
    dialog = screen.getByRole('dialog', { name: 'Delete?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(store.getState().peopleByMode.personal).toHaveLength(0));
  });

  it('creates a person and an entry through the touch UI', async () => {
    const user = userEvent.setup();
    const store = renderApp();
    await waitFor(() => expect(store.getState().initialized).toBe(true));
    await waitForElementToBeRemoved(() => screen.queryByRole('status', { name: 'ACC is loading' }));

    await user.click(screen.getByRole('button', { name: 'Add person' }));
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Taylor');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const summary = await findPersonSummary('Taylor');
    await user.click(summary);
    await user.click(screen.getByRole('button', { name: /Add Entry/ }));
    const amount = screen.getByRole('spinbutton', { name: 'Amount' });
    await user.clear(amount);
    await user.type(amount, '75');
    await user.type(screen.getByRole('textbox', { name: /Comment/ }), 'Lunch');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Lunch')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit entry' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete entry' })).toBeInTheDocument();
    expect(store.getState().peopleByMode.personal[0]?.entries[0]).toMatchObject({
      amount: 75,
      type: 'Gave',
      comment: 'Lunch',
    });

    await user.click(screen.getByRole('button', { name: 'Delete entry' }));
    let dialog = screen.getByRole('dialog', { name: 'Delete?' });
    expect(within(dialog).getByText('Are you sure you want to delete this entry?')).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(store.getState().peopleByMode.personal[0]?.entries).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Delete entry' }));
    dialog = screen.getByRole('dialog', { name: 'Delete?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(store.getState().peopleByMode.personal[0]?.entries).toHaveLength(0));
  }, 10_000);
});
