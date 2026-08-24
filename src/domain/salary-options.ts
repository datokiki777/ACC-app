import type { PayDelayMode } from '../types/domain';

export const PAY_DELAY_OPTIONS: { value: PayDelayMode; label: string }[] = [
  { value: 'none', label: 'At period end' },
  { value: '2weeks', label: '2 weeks after period' },
  { value: '4weeks', label: '4 weeks after period' },
  { value: 'firstOfMonth', label: '1st of next month' },
];
