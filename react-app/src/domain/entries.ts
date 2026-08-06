import type { Entry, LegacyEntry } from '../types/domain';

export type EntryLike = Pick<Entry, 'amount' | 'type'> &
  Partial<Pick<Entry, 'category' | 'comment'>>;

export function normalizeAmount(value: unknown): number {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? Math.round(numberValue) : 0;
}

export function entryEffect(type: Entry['type'], amount: unknown): number {
  const normalized = normalizeAmount(amount);
  if (type === 'Gave') return normalized;
  if (type === 'Received') return -normalized;
  return 0;
}

export function isSalaryEntry(entry: Partial<Entry> | LegacyEntry | null | undefined): boolean {
  return entry?.category === 'salary' || /^\[Salary\]/i.test(String(entry?.comment ?? ''));
}

export function isGiftEntry(entry: Partial<Entry> | LegacyEntry | null | undefined): boolean {
  return entry?.category === 'gift';
}
