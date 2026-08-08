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

async function longPress(element: HTMLElement) {
  fireEvent.pointerDown(element, {
    button: 0,
    clientX: 160,
    clientY: 20,
    isPrimary: true,
    pointerId: 2,
  });
  await act(async () => new Promise((resolve) => window.setTimeout(resolve, 550)));
  fireEvent.pointerUp(element, {
    clientX: 160,
    clientY: 20,
    isPrimary: true,
    pointerId: 2,
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
    expect(screen.queryByRole('button', { name: 'Open app menu' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Statistics' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add person' })).toBeInTheDocument();
    const navigation = screen.getByRole('navigation', { name: 'Primary navigation' });
    expect(within(navigation).getByRole('button', { name: 'Home' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(navigation).getByRole('button', { name: 'Stats' })).toBeInTheDocument();
    expect(within(navigation).getByRole('button', { name: 'Backup' })).toBeInTheDocument();
    expect(within(navigation).getByRole('button', { name: 'Settings' })).toBeInTheDocument();
  });

  it('uses bottom navigation for existing screens and theme settings', async () => {
    const user = userEvent.setup();
    const store = renderApp();
    await waitFor(() => expect(store.getState().initialized).toBe(true));
    const navigation = screen.getByRole('navigation', { name: 'Primary navigation' });

    await user.click(within(navigation).getByRole('button', { name: 'Stats' }));
    expect(screen.getByRole('dialog', { name: 'Statistics' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Close' }));

    await user.click(within(navigation).getByRole('button', { name: 'Backup' }));
    expect(screen.getByRole('dialog', { name: 'Data & Backup' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Close' }));

    await user.click(within(navigation).getByRole('button', { name: 'Settings' }));
    const settings = screen.getByRole('dialog', { name: 'Settings' });
    expect(settings).toBeVisible();
    await user.click(within(settings).getByRole('button', { name: /Dark/ }));
    expect(store.getState().theme).toBe('dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
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

    const navigation = screen.getByRole('navigation', { name: 'Primary navigation' });
    await user.click(within(navigation).getByRole('button', { name: 'Settings' }));
    const settings = screen.getByRole('dialog', { name: 'Settings' });

    await user.click(within(settings).getByRole('button', { name: 'Dark' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(store.getState().theme).toBe('dark');

    await user.click(within(settings).getByRole('button', { name: 'Light' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(store.getState().theme).toBe('light');

    await user.click(within(settings).getByRole('button', { name: 'System' }));
    expect(store.getState().theme).toBe('system');
  });

  it('keeps system theme preference while reacting to phone theme changes', async () => {
    let systemDark = false;
    const listeners = new Set<() => void>();
    const originalMatchMedia = window.matchMedia.bind(window);
    window.matchMedia = () =>
      ({
        get matches() {
          return systemDark;
        },
        addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
      }) as unknown as MediaQueryList;
    const store = renderApp();
    await waitFor(() => expect(store.getState().initialized).toBe(true));
    expect(store.getState().theme).toBe('system');
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');

    systemDark = true;
    act(() => listeners.forEach((listener) => listener()));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(store.getState().theme).toBe('system');
    window.matchMedia = originalMatchMedia;
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
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 550)));
    expect(secondDelete).toHaveAttribute('tabindex', '-1');
    expect(secondSummary).toHaveStyle({ transform: 'translate3d(0px, 0, 0)' });
    expect(screen.queryByRole('dialog', { name: 'Edit Person' })).not.toBeInTheDocument();
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
    expect(amount).toHaveValue(null);
    expect(amount).toHaveAttribute('placeholder', '0');
    const gave = screen.getByRole('button', { name: /Gave/ });
    const received = screen.getByRole('button', { name: /Received/ });
    expect(gave).toHaveAttribute('aria-pressed', 'true');
    expect(gave).toHaveClass('choice-gave', 'is-selected');
    await user.click(received);
    expect(received).toHaveAttribute('aria-pressed', 'true');
    expect(received).toHaveClass('choice-received', 'is-selected');
    await user.click(gave);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Amount is required');
    await user.type(amount, '75');
    const georgianComment =
      'გრძელი ქართული კომენტარი, რომელიც ბარათში მაქსიმუმ ორ ხაზად უნდა გამოჩნდეს';
    await user.type(screen.getByRole('textbox', { name: /Comment/ }), georgianComment);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const comment = await screen.findByText(georgianComment);
    expect(comment).toHaveClass('entry-comment');
    const entrySurface = comment.closest('.entry-card-surface');
    expect(entrySurface).toBeInstanceOf(HTMLDivElement);
    expect(screen.queryByRole('button', { name: 'Edit entry' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete entry/ })).not.toBeInTheDocument();
    expect(store.getState().peopleByMode.personal[0]?.entries[0]).toMatchObject({
      amount: 75,
      type: 'Gave',
      comment: georgianComment,
    });

    await user.click(entrySurface as HTMLDivElement);
    expect(screen.queryByRole('dialog', { name: 'Edit Entry' })).not.toBeInTheDocument();
    await longPress(entrySurface as HTMLDivElement);
    expect(screen.getByRole('dialog', { name: 'Edit Entry' })).toBeVisible();
    expect(screen.getByRole('spinbutton', { name: 'Amount' })).toHaveValue(75);
    await user.click(screen.getByRole('button', { name: 'Close' }));

    swipe(entrySurface as HTMLDivElement, 240, 120);
    const entryDelete = screen.getByRole('button', { name: /Delete entry dated/ });
    expect(entryDelete).toHaveAttribute('tabindex', '0');
    await user.click(entryDelete);
    let dialog = screen.getByRole('dialog', { name: 'Delete entry?' });
    expect(within(dialog).getByText('Are you sure you want to delete this entry?')).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(store.getState().peopleByMode.personal[0]?.entries).toHaveLength(1);

    swipe(entrySurface as HTMLDivElement, 240, 120);
    await user.click(screen.getByRole('button', { name: /Delete entry dated/ }));
    dialog = screen.getByRole('dialog', { name: 'Delete entry?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(store.getState().peopleByMode.personal[0]?.entries).toHaveLength(0));

    expect(screen.queryByRole('button', { name: /Archive Taylor/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete Taylor/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    await longPress(summary);
    expect(screen.getByRole('dialog', { name: 'Edit Person' })).toBeVisible();
    expect(summary).toHaveAttribute('aria-expanded', 'true');
  }, 15_000);

  it('keeps entry swipes isolated, closes the previous entry, and preserves vertical intent', async () => {
    const user = userEvent.setup();
    const store = renderApp();
    await waitFor(() => expect(store.getState().initialized).toBe(true));
    let personId = '';
    await act(async () => {
      const person = await store.getState().addPerson(draft('Entry swipe target'));
      personId = person.id;
      await store.getState().addEntry(person.id, {
        amount: 10,
        type: 'Gave',
        date: '2026-07-01',
        comment: 'First entry',
      });
      await store.getState().addEntry(person.id, {
        amount: 20,
        type: 'Received',
        date: '2026-07-02',
        comment: 'Second entry',
      });
    });

    const summary = await findPersonSummary('Entry swipe target');
    await user.click(summary);
    const firstSurface = screen.getByText('First entry').closest('.entry-card-surface');
    const secondSurface = screen.getByText('Second entry').closest('.entry-card-surface');
    expect(firstSurface).toBeInstanceOf(HTMLDivElement);
    expect(secondSurface).toBeInstanceOf(HTMLDivElement);
    const firstShell = firstSurface?.closest('.entry-swipe-shell');
    const secondShell = secondSurface?.closest('.entry-swipe-shell');
    const firstDelete = within(firstShell as HTMLElement).getByLabelText(/Delete entry dated/);
    const secondDelete = within(secondShell as HTMLElement).getByLabelText(/Delete entry dated/);

    swipe(firstSurface as HTMLElement, 240, 120);
    await waitFor(() => expect(firstDelete).toHaveAttribute('tabindex', '0'));
    expect(summary).toHaveStyle({ transform: 'translate3d(0px, 0, 0)' });
    expect(screen.queryByRole('dialog', { name: 'Edit Entry' })).not.toBeInTheDocument();

    swipe(secondSurface as HTMLElement, 240, 120);
    await waitFor(() => {
      expect(firstDelete).toHaveAttribute('tabindex', '-1');
      expect(secondDelete).toHaveAttribute('tabindex', '0');
    });

    fireEvent.pointerDown(screen.getByRole('searchbox', { name: 'Search by name' }));
    await waitFor(() => expect(secondDelete).toHaveAttribute('tabindex', '-1'));
    fireEvent.pointerDown(secondSurface as HTMLElement, {
      button: 0,
      clientX: 180,
      clientY: 20,
      isPrimary: true,
      pointerId: 3,
    });
    fireEvent.pointerMove(secondSurface as HTMLElement, {
      clientX: 186,
      clientY: 110,
      isPrimary: true,
      pointerId: 3,
    });
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 550)));
    fireEvent.pointerUp(secondSurface as HTMLElement, {
      clientX: 186,
      clientY: 110,
      isPrimary: true,
      pointerId: 3,
    });
    expect(secondDelete).toHaveAttribute('tabindex', '-1');
    expect(secondSurface).toHaveStyle({ transform: 'translate3d(0px, 0, 0)' });
    expect(screen.queryByRole('dialog', { name: 'Edit Entry' })).not.toBeInTheDocument();
    expect(store.getState().peopleByMode.personal[0]?.id).toBe(personId);
    expect(store.getState().peopleByMode.personal[0]?.entries).toHaveLength(2);
  });

  it('keeps payroll totals inside one summary card with only compact bottom actions', async () => {
    const user = userEvent.setup();
    const store = renderApp();
    await waitFor(() => expect(store.getState().initialized).toBe(true));
    await act(async () => {
      await store.getState().setMode('work');
      const person = await store.getState().addPerson({
        ...draft('Payroll target'),
        salaryEnabled: true,
        salaryAmount: 3000,
        salaryStartDate: '2026-01-01',
      });
      await store.getState().addEntry(person.id, {
        amount: 1500,
        type: 'Gave',
        date: '2026-07-31',
        comment: 'Salary payment',
        category: 'salary',
      });
    });

    const summary = await findPersonSummary('Payroll target');
    await user.click(summary);
    const payroll = screen.getByText('Payroll', { selector: 'strong' }).closest('.payroll-panel');
    expect(payroll).toBeInstanceOf(HTMLElement);
    expect(within(payroll as HTMLElement).getByText('Net')).toBeInTheDocument();
    expect((payroll as HTMLElement).querySelector('.payroll-totals-row')).toBeInTheDocument();
    expect(
      screen.queryByText('Archive', { selector: '.card-actions button' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Delete', { selector: '.card-actions button' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Add Entry' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('uses semantic money pills for positive, negative, zero, entry, and net values', async () => {
    const user = userEvent.setup();
    const store = renderApp();
    await waitFor(() => expect(store.getState().initialized).toBe(true));
    await act(async () => {
      await store.getState().addPerson(draft('Zero balance'));
      const positive = await store
        .getState()
        .addPerson(draft('ძალიან გრძელი ქართული სახელი თანხის ბარათის შესამოწმებლად'));
      await store.getState().addEntry(positive.id, {
        amount: 150,
        type: 'Gave',
        date: '2026-08-07',
        comment: 'ქართული კომენტარი',
      });
      const negative = await store.getState().addPerson(draft('Negative balance'));
      await store.getState().addEntry(negative.id, {
        amount: 100,
        type: 'Received',
        date: '2026-08-07',
        comment: '',
      });
      const large = await store.getState().addPerson(draft('Large balance'));
      await store.getState().addEntry(large.id, {
        amount: 125000,
        type: 'Gave',
        date: '2026-08-07',
        comment: '',
      });
    });

    const zeroSummary = await findPersonSummary('Zero balance');
    expect(zeroSummary.querySelector('.balance-value')).toHaveClass(
      'money-value-pill',
      'money-neutral',
    );
    const positiveSummary = await findPersonSummary(
      'ძალიან გრძელი ქართული სახელი თანხის ბარათის შესამოწმებლად',
    );
    expect(positiveSummary.querySelector('.balance-value')).toHaveClass('money-positive');
    const negativeSummary = await findPersonSummary('Negative balance');
    expect(negativeSummary.querySelector('.balance-value')).toHaveClass('money-negative');
    expect(negativeSummary.querySelector('.balance-value')).toHaveTextContent('100€');
    expect(negativeSummary.querySelector('.balance-value')).not.toHaveTextContent('-');
    const largeSummary = await findPersonSummary('Large balance');
    expect(largeSummary.querySelector('.balance-value')).toHaveClass('money-amount-lg');
    expect(largeSummary.querySelector('.balance-value')).toHaveTextContent('125000€');

    await user.click(positiveSummary);
    expect(screen.getByText('150€', { selector: '.entry-amount' })).toHaveClass('money-positive');
    expect(screen.getByText('150€', { selector: '.money-net-pill' })).toHaveClass('money-positive');
    await user.click(positiveSummary);
    await user.click(negativeSummary);
    expect(screen.getByText('100€', { selector: '.entry-amount' })).toHaveClass('money-negative');
  });
});
