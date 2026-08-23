import type { Entry, Person, SalaryChangeRecord } from '../types/domain';
import { normalizeAmount } from './entries';
import { formatReferenceDate } from './pay-dates';
import { calculateSalary } from './salary';

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

export function applySalaryAmountChange(
  person: Person,
  nextAmount: number,
  effectiveDate: Date,
): Person {
  const wasConfigured = Boolean(person.salaryAmount && person.salaryStartDate);
  const next = { ...person, entries: person.entries.map((entry) => ({ ...entry })) };

  if (wasConfigured && person.salaryAmount !== nextAmount) {
    next.salaryAccruedBaseline = calculateSalary(person, effectiveDate).accrued;
    next.salaryPeriodAnchorDate = formatReferenceDate(effectiveDate);
    const record: SalaryChangeRecord = {
      effectiveDate: formatReferenceDate(effectiveDate),
      previousAmount: person.salaryAmount ?? 0,
      newAmount: nextAmount,
    };
    next.salaryHistory = [record, ...(person.salaryHistory ?? [])].slice(0, 20);
  }
  next.salaryAmount = nextAmount;
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
  // 'paid' (salaryPaid) is always a live sum over every salary entry, regardless of date — it
  // already reflects everything paid so far without needing a separate banked snapshot here.
  next.salaryAccruedBaseline = 0;
  next.salaryPeriodAnchorDate = input.newAnchorDate;
  return next;
}

export function resetSalaryWhenUnarchiving(person: Person, referenceDate: Date): Person {
  return {
    ...person,
    entries: person.entries.map((entry) => ({ ...entry })),
    // See syncPayDate: 'paid' is always live, so banking it here would only create a stale
    // snapshot that drifts if any already-counted entry is edited later.
    salaryAccruedBaseline: 0,
    salaryPeriodAnchorDate: formatReferenceDate(referenceDate),
    salaryEndDate: '',
    archived: false,
    expanded: false,
  };
}

export function endSalaryWhenArchiving(person: Person, referenceDate: Date): Person {
  if (person.salaryEndDate) return person;
  return { ...person, salaryEndDate: formatReferenceDate(referenceDate) };
}
