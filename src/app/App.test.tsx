import 'fake-indexeddb/auto';

import {
  cleanup,
  render,
  screen,
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
    await store.getState().addPerson(draft('Personal contact'));

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

  it('creates a person and an entry through the touch UI', async () => {
    const user = userEvent.setup();
    const store = renderApp();
    await waitFor(() => expect(store.getState().initialized).toBe(true));
    await waitForElementToBeRemoved(() => screen.queryByRole('status', { name: 'ACC is loading' }));

    await user.click(screen.getByRole('button', { name: 'Add person' }));
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Taylor');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const summary = await screen.findByRole('button', { name: /Taylor/ });
    await user.click(summary);
    await user.click(screen.getByRole('button', { name: /Add Entry/ }));
    const amount = screen.getByRole('spinbutton', { name: 'Amount' });
    await user.clear(amount);
    await user.type(amount, '75');
    await user.type(screen.getByRole('textbox', { name: /Comment/ }), 'Lunch');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Lunch')).toBeInTheDocument();
    expect(store.getState().peopleByMode.personal[0]?.entries[0]).toMatchObject({
      amount: 75,
      type: 'Gave',
      comment: 'Lunch',
    });
  }, 10_000);
});
