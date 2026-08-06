import { personOpenBalance } from '../domain/balances';
import { calculateSalary } from '../domain/salary';
import type { AppMode, SalarySettings } from '../types/domain';
import type { PersistedPerson } from '../types/persistence';

export interface ModeVerificationSummary {
  personCount: number;
  entryCount: number;
  ids: string[];
  currencyChecksum: string;
  archivedChecksum: string;
  salaryChecksum: string;
  balanceChecksum: string;
  payrollChecksum: string;
}

export interface RestoreVerificationReport {
  success: boolean;
  checkedAt: string;
  personal: ModeVerificationSummary;
  work: ModeVerificationSummary;
  failures: string[];
}

export interface ModePeopleData {
  personal: PersistedPerson[];
  work: PersistedPerson[];
}

function stable(value: unknown): string {
  return JSON.stringify(value);
}

function salarySettingsForChecksum(person: PersistedPerson): Partial<SalarySettings> {
  return {
    ...(person.salaryAmount === undefined ? {} : { monthly: person.salaryAmount }),
    ...(person.salaryStartDate === undefined ? {} : { startDate: person.salaryStartDate }),
    ...(person.salaryEndDate === undefined ? {} : { endDate: person.salaryEndDate }),
    ...(person.salaryPayPeriodWeeks === undefined
      ? {}
      : { periodWeeks: person.salaryPayPeriodWeeks }),
    ...(person.salaryPeriodAnchorDate === undefined
      ? {}
      : { anchorDate: person.salaryPeriodAnchorDate }),
    ...(person.salaryAccruedBaseline === undefined
      ? {}
      : { accruedBaseline: person.salaryAccruedBaseline }),
    ...(person.salaryCurrency === undefined ? {} : { currency: person.salaryCurrency }),
    ...(person.salaryPayDelayMode === undefined ? {} : { payDelayMode: person.salaryPayDelayMode }),
  };
}

export function summarizeModeForVerification(
  people: readonly PersistedPerson[],
  mode: AppMode,
  referenceDate: Date,
): ModeVerificationSummary {
  const sorted = [...people].sort((first, second) => first.id.localeCompare(second.id));
  return {
    personCount: sorted.length,
    entryCount: sorted.reduce((sum, person) => sum + person.entries.length, 0),
    ids: sorted.map((person) => person.id),
    currencyChecksum: stable(sorted.map((person) => [person.id, person.currency])),
    archivedChecksum: stable(sorted.map((person) => [person.id, Boolean(person.archived)])),
    salaryChecksum: stable(sorted.map((person) => [person.id, salarySettingsForChecksum(person)])),
    balanceChecksum: stable(sorted.map((person) => [person.id, personOpenBalance(person, mode)])),
    payrollChecksum: stable(
      sorted.map((person) => {
        const salary = calculateSalary(person, referenceDate);
        return [
          person.id,
          salary.enabled,
          salary.accrued,
          salary.paid,
          salary.due,
          salary.upcoming,
          salary.nextPayDate,
          salary.completedPeriods,
        ];
      }),
    ),
  };
}

export function verifyRestoredData(
  expected: ModePeopleData,
  actual: ModePeopleData,
  referenceDate: Date,
): RestoreVerificationReport {
  const expectedPersonal = summarizeModeForVerification(
    expected.personal,
    'personal',
    referenceDate,
  );
  const expectedWork = summarizeModeForVerification(expected.work, 'work', referenceDate);
  const personal = summarizeModeForVerification(actual.personal, 'personal', referenceDate);
  const work = summarizeModeForVerification(actual.work, 'work', referenceDate);
  const failures: string[] = [];

  for (const mode of ['personal', 'work'] as const) {
    const expectedSummary = mode === 'personal' ? expectedPersonal : expectedWork;
    const actualSummary = mode === 'personal' ? personal : work;
    for (const key of Object.keys(expectedSummary) as Array<keyof ModeVerificationSummary>) {
      if (stable(expectedSummary[key]) !== stable(actualSummary[key])) {
        failures.push(`${mode}: ${key} did not match`);
      }
    }
  }

  return {
    success: failures.length === 0,
    checkedAt: referenceDate.toISOString(),
    personal,
    work,
    failures,
  };
}
