import { personOpenBalance, personTotals, personalOpenBalance, workOpenBalance } from './balances';
import { entryEffect, isGiftEntry, isSalaryEntry, normalizeAmount } from './entries';
import { entry, personalPerson, workPerson } from '../test/fixtures/golden';

describe('entry and balance parity', () => {
  it('rounds with Math.round and treats invalid values as zero', () => {
    expect(normalizeAmount(10.49)).toBe(10);
    expect(normalizeAmount(10.5)).toBe(11);
    expect(normalizeAmount('20.8')).toBe(21);
    expect(normalizeAmount(Number.NaN)).toBe(0);
  });

  it('treats Gave as positive and Received as negative', () => {
    expect(entryEffect('Gave', 10.6)).toBe(11);
    expect(entryEffect('Received', 10.6)).toBe(-11);
  });

  it('calculates total Gave, Received, and net', () => {
    expect(personTotals(personalPerson)).toEqual({ gave: 102, received: 41, balance: 61 });
    expect(personalOpenBalance(personalPerson.entries)).toBe(61);
    expect(personOpenBalance(personalPerson, 'personal')).toBe(61);
  });

  it('supports zero and negative balances', () => {
    expect(
      personalOpenBalance([entry({ amount: 10 }), entry({ amount: 10, type: 'Received' })]),
    ).toBe(0);
    expect(personalOpenBalance([entry({ amount: 12, type: 'Received' })])).toBe(-12);
  });

  it('detects categorized and legacy salary entries case-insensitively', () => {
    expect(isSalaryEntry(entry({ category: 'salary' }))).toBe(true);
    expect(isSalaryEntry(entry({ comment: '[Salary] Paid manually' }))).toBe(true);
    expect(isSalaryEntry(entry({ comment: '[salary] legacy' }))).toBe(true);
    expect(isSalaryEntry(entry({ comment: ' [Salary] leading space' }))).toBe(false);
  });

  it('requires the gift category for gift classification', () => {
    expect(isGiftEntry(entry({ category: 'gift' }))).toBe(true);
    expect(isGiftEntry(entry({ comment: '[Gift]' }))).toBe(false);
  });

  it('filters uncategorized Work entries while Personal includes them', () => {
    expect(workOpenBalance(workPerson.entries)).toBe(530);
    expect(personOpenBalance(workPerson, 'work')).toBe(530);
    expect(personOpenBalance(workPerson, 'personal')).toBe(1529);
  });

  it('includes legacy salary comments in Work balance', () => {
    const entries = [entry({ amount: 75, comment: '[Salary] Legacy payment' })];
    expect(workOpenBalance(entries)).toBe(75);
  });
});
