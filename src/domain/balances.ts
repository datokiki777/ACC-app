import type { AppMode, Entry, Person } from '../types/domain';
import { entryEffect, isGiftEntry, isSalaryEntry, normalizeAmount } from './entries';

export interface PersonTotals {
  gave: number;
  received: number;
  balance: number;
}

export function personTotals(person: Pick<Person, 'entries'>): PersonTotals {
  let gave = 0;
  let received = 0;

  person.entries.forEach((entry) => {
    const amount = normalizeAmount(entry.amount);
    if (entry.type === 'Gave') gave += amount;
    if (entry.type === 'Received') received += amount;
  });

  return { gave, received, balance: gave - received };
}

export function personalOpenBalance(entries: readonly Entry[]): number {
  return entries.reduce((sum, entry) => sum + entryEffect(entry.type, entry.amount), 0);
}

export function workOpenBalance(entries: readonly Entry[]): number {
  return entries.reduce((sum, entry) => {
    if (!isSalaryEntry(entry) && !isGiftEntry(entry)) return sum;
    return sum + entryEffect(entry.type, entry.amount);
  }, 0);
}

export function personOpenBalance(person: Pick<Person, 'entries'>, mode: AppMode): number {
  return mode === 'work' ? workOpenBalance(person.entries) : personalOpenBalance(person.entries);
}
