import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type {
  AppMode,
  Entry,
  LegacyEntry,
  LegacyPerson,
  PayDelayMode,
  Person,
  SalaryCalculationResult,
  SalarySettings,
} from '../../types/domain';

interface LegacyState {
  mode: AppMode;
  people: Person[];
}

interface LegacyExports {
  normalizeAmount(value: unknown): number;
  isSalaryEntry(entry: Partial<Entry> | LegacyEntry): boolean;
  isGiftEntry(entry: Partial<Entry> | LegacyEntry): boolean;
  personTotals(person: Person): { gave: number; received: number; balance: number };
  personOpenBalance(person: Person): number;
  getPersonSalaryConfig(person: Person): SalarySettings | null;
  personSalaryPaid(person: Person): number;
  personSalarySummary(person: Person, referenceDate: Date): SalaryCalculationResult;
  computeSalaryPayDate(periodEndDate: string, mode: PayDelayMode): string;
  migratePersonToFlatEntries(person: LegacyPerson): LegacyPerson;
  getBalanceTotalsForScope(people: Person[]): Partial<Record<string, number>>;
  getMonthlyBreakdown(
    people: Person[],
    monthsBack?: number,
  ): Array<{ key: string; label: string; gave: number; received: number }>;
  getEntryInsights(people: Person[]): {
    count: number;
    average: number;
    mostActiveName: string | null;
    mostActiveCount: number;
  };
  getPayrollOverview(people: Person[]): unknown;
  buildPayrollOverviewHtml(people: Person[]): string;
  mergeEntriesArray(current: LegacyEntry[], incoming: LegacyEntry[]): LegacyEntry[];
  mergePeopleArrays(current: LegacyPerson[], incoming: LegacyPerson[]): LegacyPerson[];
  validateFullBackupData(data: unknown): boolean;
}

const legacySourceDirectory = [
  resolve(process.cwd(), '..', 'js'),
  resolve(process.cwd(), 'js'),
].find((candidate) => existsSync(resolve(candidate, '03-utils.js')));
if (!legacySourceDirectory) throw new Error('Could not locate the legacy JavaScript source');
const legacyUtilsSource = readFileSync(resolve(legacySourceDirectory, '03-utils.js'), 'utf8');
const legacyBackupSource = readFileSync(resolve(legacySourceDirectory, '09-export.js'), 'utf8');
const legacyStatisticsSource = readFileSync(resolve(legacySourceDirectory, '11-stats.js'), 'utf8');

// eslint-disable-next-line @typescript-eslint/no-implied-eval -- Executes repository legacy source in an isolated test harness.
const createLegacyExports = Function(
  'state',
  `'use strict';
${legacyUtilsSource}
${legacyBackupSource}
${legacyStatisticsSource}
return {
  normalizeAmount,
  isSalaryEntry,
  isGiftEntry,
  personTotals,
  personOpenBalance,
  getPersonSalaryConfig,
  personSalaryPaid,
  personSalarySummary,
  computeSalaryPayDate,
  migratePersonToFlatEntries,
  getBalanceTotalsForScope,
  getMonthlyBreakdown,
  getEntryInsights,
  getPayrollOverview,
  buildPayrollOverviewHtml,
  mergeEntriesArray,
  mergePeopleArrays,
  validateFullBackupData
};`,
) as (state: LegacyState) => LegacyExports;

const state: LegacyState = { mode: 'personal', people: [] };
const legacy = createLegacyExports(state);

function dateString(referenceDate: Date): string {
  return [
    referenceDate.getFullYear(),
    String(referenceDate.getMonth() + 1).padStart(2, '0'),
    String(referenceDate.getDate()).padStart(2, '0'),
  ].join('-');
}

function clonePerson(person: Person): Person {
  return structuredClone(person);
}

export const legacyHarness = {
  ...legacy,
  setMode(mode: AppMode) {
    state.mode = mode;
  },
  mergeNormalizedPeople(current: LegacyPerson[], incoming: LegacyPerson[]): LegacyPerson[] {
    const normalize = (people: LegacyPerson[]) =>
      people.map((candidate) =>
        legacy.migratePersonToFlatEntries({ ...candidate, expanded: false }),
      );
    return legacy.mergePeopleArrays(normalize(current), normalize(incoming));
  },
  earliestUnpaidPayDate(person: Person, referenceDate: Date): string {
    const config = legacy.getPersonSalaryConfig(person);
    if (!config) return '';
    const summary = legacy.personSalarySummary(person, referenceDate);
    const periodAmountSafe = summary.periodAmount > 0 ? summary.periodAmount : 1;
    const paidPeriodsCount = Math.floor(summary.paid / periodAmountSafe);
    const earliestUnpaidIndex = Math.min(summary.completedPeriods, paidPeriodsCount + 1);
    const periodEnd = addLegacyDays(
      config.anchorDate,
      earliestUnpaidIndex * config.periodWeeks * 7,
    );
    return legacy.computeSalaryPayDate(periodEnd, config.payDelayMode);
  },
  applyPayPeriodChange(person: Person, periodWeeks: number, referenceDate: Date): Person {
    const next = clonePerson(person);
    const previousWeeks = Math.min(
      52,
      Math.max(1, Number(next.salaryPayPeriodWeeks ?? next.salaryPayDay ?? 1)),
    );
    const normalizedWeeks = Math.min(52, Math.max(1, Number(periodWeeks || 1)));
    if (next.salaryAmount && next.salaryStartDate && previousWeeks !== normalizedWeeks) {
      next.salaryAccruedBaseline = legacy.personSalarySummary(next, referenceDate).accrued;
      next.salaryPeriodAnchorDate = dateString(referenceDate);
    }
    next.salaryPayPeriodWeeks = normalizedWeeks;
    delete next.salaryPayDay;
    return next;
  },
  syncPayDate(
    person: Person,
    adjustmentAmount: number,
    newAnchorDate: string,
    adjustmentEntryId: string,
    referenceDate: Date,
  ): Person {
    const next = clonePerson(person);
    const normalizedAdjustment = legacy.normalizeAmount(adjustmentAmount);
    if (normalizedAdjustment > 0) {
      next.entries.unshift({
        id: adjustmentEntryId,
        amount: normalizedAdjustment,
        type: 'Gave',
        date: dateString(referenceDate),
        comment: '[Salary] Schedule sync adjustment',
        category: 'salary',
      });
    }
    next.salaryAccruedBaseline = legacy.personSalaryPaid(next);
    next.salaryPeriodAnchorDate = newAnchorDate;
    return next;
  },
  resetSalaryWhenUnarchiving(person: Person, referenceDate: Date): Person {
    const next = clonePerson(person);
    const summary = legacy.personSalarySummary(next, referenceDate);
    next.salaryAccruedBaseline = summary.paid;
    next.salaryPeriodAnchorDate = dateString(referenceDate);
    next.archived = false;
    next.expanded = false;
    return next;
  },
};

function addLegacyDays(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) return '';
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}
