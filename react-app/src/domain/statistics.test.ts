import { balanceTotalsByCurrency, calculateStatistics } from './statistics';
import { date, entry, person } from '../test/fixtures/golden';

describe('statistics parity', () => {
  const people = [
    person({
      id: 'eur',
      name: 'Euro person',
      currency: 'EUR',
      entries: [entry({ id: 'eur-1', amount: 100, date: '2026-02-10' })],
    }),
    person({
      id: 'usd',
      name: 'Dollar person',
      currency: 'USD',
      entries: [
        entry({ id: 'usd-1', amount: 70, date: '2026-03-01' }),
        entry({ id: 'usd-2', amount: 20, type: 'Received', date: '2026-03-02' }),
      ],
    }),
    person({
      id: 'archived',
      name: 'Archived person',
      currency: 'EUR',
      archived: true,
      entries: [entry({ id: 'archived-1', amount: 25, date: '2026-03-02' })],
    }),
  ];

  it('groups balances by currency without conversion', () => {
    expect(balanceTotalsByCurrency(people, 'personal')).toEqual({ EUR: 125, USD: 50 });
  });

  it('applies active scope and reproduces monthly and insight totals', () => {
    const result = calculateStatistics(people, 'personal', 'active', date(2026, 3, 15));
    expect(result.peopleCount).toBe(2);
    expect(result.balancesByCurrency).toEqual({ EUR: 100, USD: 50 });
    expect(result.entryCount).toBe(3);
    expect(result.averageEntry).toBe(63);
    expect(result.mostActiveName).toBe('Dollar person');
    expect(result.mostActiveCount).toBe(2);
    expect(result.monthly.at(-2)).toMatchObject({ key: '2026-02', gave: 100, received: 0 });
    expect(result.monthly.at(-1)).toMatchObject({ key: '2026-03', gave: 70, received: 20 });
  });

  it('uses Work balance filtering in statistics', () => {
    const result = calculateStatistics(
      [
        person({
          entries: [
            entry({ amount: 100, category: 'salary' }),
            entry({ id: 'ignored', amount: 999 }),
          ],
        }),
      ],
      'work',
      'all',
      date(2026, 3, 15),
    );
    expect(result.balancesByCurrency).toEqual({ EUR: 100 });
    expect(result.topBalances[0]?.balance).toBe(100);
  });
});
