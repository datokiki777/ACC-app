import type {
  AppMode,
  Currency,
  MonthlyStatistics,
  Person,
  StatisticsResult,
  TopBalanceResult,
} from '../types/domain';
import { personOpenBalance } from './balances';
import { normalizeAmount } from './entries';

export type StatisticsScope = 'active' | 'archived' | 'all';

export function peopleForStatisticsScope(
  people: readonly Person[],
  scope: StatisticsScope,
): Person[] {
  if (scope === 'archived') return people.filter((person) => person.archived);
  if (scope === 'all') return [...people];
  return people.filter((person) => !person.archived);
}

export function balanceTotalsByCurrency(
  people: readonly Person[],
  mode: AppMode,
): Partial<Record<Currency, number>> {
  return people.reduce<Partial<Record<Currency, number>>>((totals, person) => {
    totals[person.currency] = (totals[person.currency] ?? 0) + personOpenBalance(person, mode);
    return totals;
  }, {});
}

export function monthlyBreakdown(
  people: readonly Person[],
  referenceDate: Date,
  monthsBack = 6,
): MonthlyStatistics[] {
  const buckets: MonthlyStatistics[] = [];
  const bucketIndex = new Map<string, number>();

  for (let index = monthsBack - 1; index >= 0; index -= 1) {
    const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    bucketIndex.set(key, buckets.length);
    buckets.push({
      key,
      label: date.toLocaleDateString('en-US', { month: 'short' }),
      gave: 0,
      received: 0,
    });
  }

  people.forEach((person) => {
    person.entries.forEach((entry) => {
      const key = entry.date.slice(0, 7);
      const index = bucketIndex.get(key);
      if (index === undefined) return;
      const bucket = buckets[index];
      if (!bucket) return;
      const amount = normalizeAmount(entry.amount);
      if (entry.type === 'Gave') bucket.gave += amount;
      else if (entry.type === 'Received') bucket.received += amount;
    });
  });

  return buckets;
}

export function topBalances(
  people: readonly Person[],
  mode: AppMode,
  limit = 5,
): TopBalanceResult[] {
  return people
    .map((person) => ({
      id: person.id,
      name: person.name,
      balance: personOpenBalance(person, mode),
      currency: person.currency,
    }))
    .filter((person) => Math.abs(person.balance) > 0.000001)
    .sort((first, second) => Math.abs(second.balance) - Math.abs(first.balance))
    .slice(0, limit);
}

export function calculateStatistics(
  allPeople: readonly Person[],
  mode: AppMode,
  scope: StatisticsScope,
  referenceDate: Date,
): StatisticsResult {
  const people = peopleForStatisticsScope(allPeople, scope);
  let entryCount = 0;
  let entryAmountSum = 0;
  let mostActiveName: string | null = null;
  let mostActiveCount = 0;

  people.forEach((person) => {
    const count = person.entries.length;
    entryCount += count;
    entryAmountSum += person.entries.reduce((sum, entry) => sum + normalizeAmount(entry.amount), 0);
    if (count > mostActiveCount) {
      mostActiveCount = count;
      mostActiveName = person.name;
    }
  });

  return {
    peopleCount: people.length,
    balancesByCurrency: balanceTotalsByCurrency(people, mode),
    monthly: monthlyBreakdown(people, referenceDate),
    entryCount,
    averageEntry: entryCount ? Math.round(entryAmountSum / entryCount) : 0,
    mostActiveName,
    mostActiveCount,
    topBalances: topBalances(people, mode),
  };
}
