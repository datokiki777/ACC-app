import type { Currency } from '../types/domain';

const SYMBOLS: Record<Currency, string> = {
  EUR: '€',
  USD: '$',
  GEL: '₾',
  CAD: 'C$',
};

export function currencySymbol(currency: Currency): string {
  return SYMBOLS[currency];
}

export function formatMoney(value: number, currency: Currency, signed = true): string {
  const amount = Math.round(value);
  const sign = signed ? (amount > 0 ? '+' : amount < 0 ? '-' : '') : '';
  return `${sign}${Math.abs(amount)}${currencySymbol(currency)}`;
}

export function formatDate(value: string): string {
  const parts = value.split('-');
  return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : value || 'No date';
}

export function localDateString(referenceDate = new Date()): string {
  return [
    referenceDate.getFullYear(),
    String(referenceDate.getMonth() + 1).padStart(2, '0'),
    String(referenceDate.getDate()).padStart(2, '0'),
  ].join('-');
}
