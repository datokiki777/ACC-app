import { addDays, computeSalaryPayDate, daysSince, daysUntil } from './pay-dates';
import { date } from '../test/fixtures/golden';

describe('calendar-safe pay dates', () => {
  it('adds calendar days across month boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
  });

  it('calculates signed day distance', () => {
    expect(daysUntil('2026-03-10', date(2026, 3, 8))).toBe(2);
    expect(daysUntil('2026-03-08', date(2026, 3, 8))).toBe(0);
    expect(daysUntil('2026-03-07', date(2026, 3, 8))).toBe(-1);
  });

  it('does not lose a day across the spring DST transition', () => {
    expect(daysSince('2026-03-28', date(2026, 3, 30))).toBe(2);
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
  });

  it('does not gain a day across the autumn DST transition', () => {
    expect(daysSince('2026-10-24', date(2026, 10, 26))).toBe(2);
  });

  it.each([
    ['none', '2026-03-08'],
    ['2weeks', '2026-03-22'],
    ['4weeks', '2026-04-05'],
    ['firstOfMonth', '2026-04-01'],
  ] as const)('applies the %s delay', (mode, expected) => {
    expect(computeSalaryPayDate('2026-03-08', mode)).toBe(expected);
  });
});
