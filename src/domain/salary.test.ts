import {
  calculateSalary,
  earliestUnpaidPayDate,
  getSalarySettings,
  giftSummary,
  salaryPaid,
} from './salary';
import {
  applyPayPeriodChange,
  endSalaryWhenArchiving,
  resetSalaryWhenUnarchiving,
  syncPayDate,
} from './salary-workflows';
import { date, entry, weeklySalaryPerson, workPerson } from '../test/fixtures/golden';

describe('salary calculation parity', () => {
  it('returns a disabled result without amount and start date', () => {
    expect(calculateSalary(weeklySalaryPerson({ salaryAmount: 0 }), date(2026, 3, 8)).enabled).toBe(
      false,
    );
  });

  it('calculates period amount and exact completed-period boundary', () => {
    const result = calculateSalary(weeklySalaryPerson(), date(2026, 3, 8));
    expect(result.periodAmount).toBe(100);
    expect(result.completedPeriods).toBe(1);
    expect(result.accrued).toBe(100);
    expect(result.upcoming).toBe(100);
    expect(result.nextPayDate).toBe('2026-03-08');
  });

  it.each([
    [date(2026, 3, 7), 0, 100, '2026-03-08', 1, true],
    [date(2026, 3, 8), 0, 100, '2026-03-08', 0, true],
    [date(2026, 3, 9), 0, 200, '2026-03-08', -1, true],
    [date(2026, 3, 10), 100, 100, '2026-03-15', 5, false],
  ] as const)(
    'preserves grace and upcoming behavior at %s',
    (referenceDate, due, upcoming, nextPayDate, until, paySoon) => {
      const result = calculateSalary(weeklySalaryPerson(), referenceDate);
      expect(result.due).toBe(due);
      expect(result.upcoming).toBe(upcoming);
      expect(result.nextPayDate).toBe(nextPayDate);
      expect(result.daysUntilNextPay).toBe(until);
      expect(result.paySoon).toBe(paySoon);
    },
  );

  it.each([
    ['2weeks', '2026-03-22'],
    ['4weeks', '2026-04-05'],
    ['firstOfMonth', '2026-04-01'],
  ] as const)('uses the earliest unpaid delayed pay date for %s', (mode, payDate) => {
    const result = calculateSalary(
      weeklySalaryPerson({ salaryPayDelayMode: mode }),
      date(2026, 3, 8),
    );
    expect(result.due).toBe(0);
    expect(result.nextPayDate).toBe(payDate);
  });

  it('caps accrual and forecasts at the salary end date', () => {
    const result = calculateSalary(
      weeklySalaryPerson({ salaryEndDate: '2026-03-15' }),
      date(2026, 4, 1),
    );
    expect(result.ended).toBe(true);
    expect(result.days).toBe(14);
    expect(result.completedPeriods).toBe(2);
    expect(result.accrued).toBe(200);
    expect(result.due).toBe(200);
    expect(result.upcoming).toBe(0);
    expect(result.daysUntilNextPay).toBeNull();
  });

  it('nets Received salary entries against Gave salary entries when counting what is paid', () => {
    const person = weeklySalaryPerson({
      entries: [
        entry({ id: 'one', amount: 40, category: 'salary' }),
        entry({ id: 'two', amount: 20, comment: '[Salary] Legacy' }),
        entry({ id: 'three', amount: 15, type: 'Received', category: 'salary' }),
      ],
    });
    expect(salaryPaid(person)).toBe(45);
  });

  it('lets a Received salary entry represent a refund/clawback that reduces what is owed', () => {
    // Real scenario: an earlier personal loan (not salary) was partly paid back, and the net
    // remaining balance should count against an upcoming salary payment. Rather than fabricating
    // a new entry, the original Gave and Received entries are simply re-categorized as salary.
    const person = weeklySalaryPerson({
      salaryAmount: 3000,
      salaryStartDate: '2026-07-01',
      salaryPayPeriodWeeks: 2,
      entries: [
        entry({ id: 'loan', amount: 1500, category: 'salary', date: '2026-08-09' }),
        entry({
          id: 'partial-refund',
          amount: 300,
          type: 'Received',
          category: 'salary',
          date: '2026-08-10',
        }),
      ],
    });
    expect(salaryPaid(person)).toBe(1200);
  });

  it('identifies the earliest unpaid completed period behind a paid period', () => {
    const salariedPerson = weeklySalaryPerson({
      entries: [entry({ amount: 100, category: 'salary' })],
    });
    const settings = getSalarySettings(salariedPerson);
    expect(settings).not.toBeNull();
    if (!settings) throw new Error('Expected salary settings');
    expect(earliestUnpaidPayDate(settings, 2, 100, 100)).toBe('2026-03-15');
  });

  it('continues salary calculation while a person is archived', () => {
    const active = calculateSalary(weeklySalaryPerson(), date(2026, 3, 10));
    const archived = calculateSalary(weeklySalaryPerson({ archived: true }), date(2026, 3, 10));
    expect(archived).toEqual(active);
  });

  it('does not resurface a paid period as due soon when settled exactly on its boundary', () => {
    const person = weeklySalaryPerson({
      salaryAmount: 3000,
      salaryStartDate: '2026-07-01',
      salaryPayPeriodWeeks: 2,
      entries: [
        entry({ id: 'e1', amount: 1500, category: 'salary', date: '2026-07-15' }),
        entry({ id: 'e2', amount: 1500, category: 'salary', date: '2026-07-29' }),
        entry({ id: 'e3', amount: 1500, category: 'salary', date: '2026-08-09' }),
      ],
    });
    // referenceDate lands exactly on the 3rd period boundary (14-day cycle from 2026-07-01),
    // which was just paid in advance on 2026-08-09.
    const result = calculateSalary(person, date(2026, 8, 12));
    expect(result.due).toBe(0);
    expect(result.upcoming).toBe(0);
    expect(result.paySoon).toBe(false);
    expect(result.nextPayDate).toBe('2026-08-26');
  });

  it('does not resurface a paid period as due soon when paid a few days before its boundary', () => {
    const person = weeklySalaryPerson({
      salaryAmount: 3000,
      salaryStartDate: '2026-07-01',
      salaryPayPeriodWeeks: 2,
      entries: [
        entry({ id: 'e1', amount: 1500, category: 'salary', date: '2026-07-15' }),
        entry({ id: 'e2', amount: 1500, category: 'salary', date: '2026-07-29' }),
        entry({ id: 'e3', amount: 1500, category: 'salary', date: '2026-08-09' }),
      ],
    });
    // referenceDate is 3 days before the 3rd period boundary (2026-08-12), which was already
    // paid in full on 2026-08-09 — nothing should be flagged as due or upcoming yet.
    const result = calculateSalary(person, date(2026, 8, 9));
    expect(result.due).toBe(0);
    expect(result.upcoming).toBe(0);
    expect(result.nextPayDate).toBe('2026-08-12');
  });

  it('calculates the Work gift summary independently', () => {
    expect(giftSummary(workPerson)).toMatchObject({ gave: 50, received: 20, total: 70, net: 30 });
  });
});

describe('salary workflow parity', () => {
  it('banks accrued salary when the pay period changes', () => {
    const changed = applyPayPeriodChange(weeklySalaryPerson(), 2, date(2026, 3, 10));
    expect(changed.salaryAccruedBaseline).toBe(100);
    expect(changed.salaryPeriodAnchorDate).toBe('2026-03-10');
    expect(changed.salaryPayPeriodWeeks).toBe(2);
  });

  it('does not re-anchor when the period is unchanged', () => {
    const changed = applyPayPeriodChange(weeklySalaryPerson(), 1, date(2026, 3, 10));
    expect(changed.salaryAccruedBaseline).toBeUndefined();
    expect(changed.salaryPeriodAnchorDate).toBeUndefined();
  });

  it('adds the sync adjustment before setting the paid baseline', () => {
    const synced = syncPayDate(
      weeklySalaryPerson({ entries: [entry({ amount: 40, category: 'salary' })] }),
      {
        adjustmentAmount: 60,
        newAnchorDate: '2026-03-10',
        adjustmentEntryId: 'sync-entry',
        referenceDate: date(2026, 3, 10),
      },
    );
    expect(synced.entries[0]).toMatchObject({
      id: 'sync-entry',
      amount: 60,
      category: 'salary',
      date: '2026-03-10',
    });
    expect(synced.salaryAccruedBaseline).toBe(100);
    expect(synced.salaryPeriodAnchorDate).toBe('2026-03-10');
  });

  it('resets a salaried unarchive to paid salary and today', () => {
    const reset = resetSalaryWhenUnarchiving(
      weeklySalaryPerson({
        archived: true,
        expanded: true,
        entries: [entry({ amount: 100, category: 'salary' })],
      }),
      date(2026, 4, 5),
    );
    expect(reset).toMatchObject({
      archived: false,
      expanded: false,
      salaryAccruedBaseline: 100,
      salaryPeriodAnchorDate: '2026-04-05',
      salaryEndDate: '',
    });
  });

  it('sets the salary end date to today when archiving, unless one is already set', () => {
    const ended = endSalaryWhenArchiving(weeklySalaryPerson(), date(2026, 4, 5));
    expect(ended.salaryEndDate).toBe('2026-04-05');

    const unchanged = endSalaryWhenArchiving(
      weeklySalaryPerson({ salaryEndDate: '2026-06-01' }),
      date(2026, 4, 5),
    );
    expect(unchanged.salaryEndDate).toBe('2026-06-01');
  });
});
