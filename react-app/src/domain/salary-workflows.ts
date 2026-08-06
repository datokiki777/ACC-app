import type { Entry, Person } from '../types/domain';
import { normalizeAmount } from './entries';
import { formatReferenceDate } from './pay-dates';
import { calculateSalary, salaryPaid } from './salary';

export function applyPayPeriodChange(
  person: Person,
  nextPeriodWeeks: number,
  referenceDate: Date,
): Person {
  const previousPeriodWeeks = Math.min(
    52,
    Math.max(1, Number(person.salaryPayPeriodWeeks ?? person.salaryPayDay ?? 1)),
  );
  const normalizedNextPeriod = Math.min(52, Math.max(1, Number(nextPeriodWeeks || 1)));
  const wasConfigured = Boolean(person.salaryAmount && person.salaryStartDate);
  const next = { ...person, entries: person.entries.map((entry) => ({ ...entry })) };

  if (wasConfigured && previousPeriodWeeks !== normalizedNextPeriod) {
    next.salaryAccruedBaseline = calculateSalary(person, referenceDate).accrued;
    next.salaryPeriodAnchorDate = formatReferenceDate(referenceDate);
  }
  next.salaryPayPeriodWeeks = normalizedNextPeriod;
  delete next.salaryPayDay;
  return next;
}

export interface SyncPayDateInput {
  adjustmentAmount: number;
  newAnchorDate: string;
  adjustmentEntryId: string;
  referenceDate: Date;
}

export function syncPayDate(person: Person, input: SyncPayDateInput): Person {
  const adjustmentAmount = normalizeAmount(input.adjustmentAmount);
  const entries: Entry[] = person.entries.map((entry) => ({ ...entry }));
  if (adjustmentAmount > 0) {
    entries.unshift({
      id: input.adjustmentEntryId,
      amount: adjustmentAmount,
      type: 'Gave',
      date: formatReferenceDate(input.referenceDate),
      comment: '[Salary] Schedule sync adjustment',
      category: 'salary',
    });
  }
  const next = { ...person, entries };
  next.salaryAccruedBaseline = salaryPaid(next);
  next.salaryPeriodAnchorDate = input.newAnchorDate;
  return next;
}

export function resetSalaryWhenUnarchiving(person: Person, referenceDate: Date): Person {
  const paid = calculateSalary(person, referenceDate).paid;
  return {
    ...person,
    entries: person.entries.map((entry) => ({ ...entry })),
    salaryAccruedBaseline: paid,
    salaryPeriodAnchorDate: formatReferenceDate(referenceDate),
    archived: false,
    expanded: false,
  };
}
