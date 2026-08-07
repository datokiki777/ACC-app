import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { BottomSheet } from '../../components/BottomSheet';
import type { PersonDraft } from '../../store/app-store';
import { useAppStore } from '../../store/hooks';

const COLORS = [
  '#5692ff',
  '#35c26b',
  '#ff6b6b',
  '#ffb84d',
  '#b98cff',
  '#4fd1c5',
  '#ff8fce',
  '#9aaac4',
];

const personSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(80),
    currency: z.enum(['EUR', 'USD', 'GEL', 'CAD']),
    tagLabel: z.string().trim().max(20),
    tagColor: z.string(),
    salaryEnabled: z.boolean(),
    salaryAmount: z.number().min(0),
    salaryStartDate: z.string(),
    salaryEndDate: z.string(),
    salaryPayPeriodWeeks: z.number().int().min(1).max(52),
    salaryPayDelayMode: z.enum(['none', '2weeks', '4weeks', 'firstOfMonth']),
  })
  .superRefine((value, context) => {
    if (value.salaryEnabled && value.salaryAmount < 1) {
      context.addIssue({ code: 'custom', path: ['salaryAmount'], message: 'Salary is required' });
    }
    if (value.salaryEnabled && !value.salaryStartDate) {
      context.addIssue({
        code: 'custom',
        path: ['salaryStartDate'],
        message: 'Start date is required',
      });
    }
  });

export function PersonFormSheet() {
  const mode = useAppStore((state) => state.mode);
  const people = useAppStore((state) => state.peopleByMode[state.mode]);
  const personId = useAppStore((state) => state.ui.personId);
  const addPerson = useAppStore((state) => state.addPerson);
  const editPerson = useAppStore((state) => state.editPerson);
  const close = useAppStore((state) => state.closeSheet);
  const existing = people.find((person) => person.id === personId);
  const [formError, setFormError] = useState('');
  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { isSubmitting },
  } = useForm<PersonDraft>({
    defaultValues: {
      name: existing?.name ?? '',
      currency: existing?.currency ?? 'EUR',
      tagLabel: existing?.tagLabel ?? '',
      tagColor: existing?.tagColor ?? '',
      salaryEnabled: Boolean(existing?.salaryAmount && existing.salaryStartDate),
      salaryAmount: existing?.salaryAmount ?? 0,
      salaryStartDate: existing?.salaryStartDate ?? '',
      salaryEndDate: existing?.salaryEndDate ?? '',
      salaryPayPeriodWeeks: Number(existing?.salaryPayPeriodWeeks ?? existing?.salaryPayDay ?? 2),
      salaryPayDelayMode: existing?.salaryPayDelayMode ?? 'none',
    },
  });
  const salaryEnabled = useWatch({ control, name: 'salaryEnabled' });
  const tagColor = useWatch({ control, name: 'tagColor' });

  const submit = handleSubmit(async (raw) => {
    const result = personSchema.safeParse(raw);
    if (!result.success) {
      setFormError(result.error.issues[0]?.message ?? 'Check the form');
      return;
    }
    try {
      if (existing) await editPerson(existing.id, result.data);
      else await addPerson(result.data);
      close();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save');
    }
  });

  return (
    <BottomSheet
      onClose={close}
      title={
        existing
          ? `Edit ${mode === 'work' ? 'Team' : 'Person'}`
          : `Add ${mode === 'work' ? 'Team' : 'Person'}`
      }
    >
      <form autoComplete="off" className="form-grid" onSubmit={(event) => void submit(event)}>
        <label className="field">
          <span>Name</span>
          <input
            autoCapitalize="words"
            autoComplete="off"
            autoFocus
            enterKeyHint="next"
            inputMode="text"
            maxLength={80}
            placeholder="Example: John"
            spellCheck={false}
            {...register('name')}
          />
        </label>

        <label className="field">
          <span>
            Tag <small>optional</small>
          </span>
          <input
            autoCapitalize="words"
            autoComplete="off"
            enterKeyHint="next"
            inputMode="text"
            maxLength={20}
            placeholder="Family, Work…"
            spellCheck={false}
            {...register('tagLabel')}
          />
        </label>
        <div className="color-picker" role="group" aria-label="Tag color">
          <button
            aria-label="No tag color"
            className={
              !tagColor ? 'color-swatch is-selected color-none' : 'color-swatch color-none'
            }
            onClick={() => setValue('tagColor', '')}
            type="button"
          >
            ×
          </button>
          {COLORS.map((color) => (
            <button
              aria-label={`Tag color ${color}`}
              className={tagColor === color ? 'color-swatch is-selected' : 'color-swatch'}
              key={color}
              onClick={() => setValue('tagColor', color)}
              style={{ background: color }}
              type="button"
            />
          ))}
        </div>

        <label className="field">
          <span>Currency</span>
          <select disabled={Boolean(existing)} {...register('currency')}>
            <option value="EUR">EUR €</option>
            <option value="USD">USD $</option>
            <option value="GEL">GEL ₾</option>
            <option value="CAD">CAD C$</option>
          </select>
        </label>

        {mode === 'work' && (
          <>
            <label className="toggle-field">
              <span>Salaried employee</span>
              <input type="checkbox" {...register('salaryEnabled')} />
            </label>
            {salaryEnabled && (
              <div className="salary-form-fields">
                <label className="field">
                  <span>Monthly salary</span>
                  <input
                    autoComplete="off"
                    inputMode="decimal"
                    min={0}
                    step={1}
                    type="number"
                    {...register('salaryAmount', { valueAsNumber: true })}
                  />
                </label>
                <label className="field">
                  <span>Salary start date</span>
                  <input autoComplete="off" type="date" {...register('salaryStartDate')} />
                </label>
                <label className="field">
                  <span>Pay period (weeks)</span>
                  <input
                    autoComplete="off"
                    inputMode="numeric"
                    min={1}
                    max={52}
                    type="number"
                    {...register('salaryPayPeriodWeeks', { valueAsNumber: true })}
                  />
                </label>
                <label className="field">
                  <span>Payment timing</span>
                  <select {...register('salaryPayDelayMode')}>
                    <option value="none">At period end</option>
                    <option value="2weeks">2 weeks after period</option>
                    <option value="4weeks">4 weeks after period</option>
                    <option value="firstOfMonth">1st of next month</option>
                  </select>
                </label>
                <label className="field">
                  <span>
                    Salary end date <small>optional</small>
                  </span>
                  <input autoComplete="off" type="date" {...register('salaryEndDate')} />
                </label>
              </div>
            )}
          </>
        )}

        {formError && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}
        <div className="form-actions">
          <button className="secondary-button" onClick={close} type="button">
            Cancel
          </button>
          <button className="primary-button" disabled={isSubmitting} type="submit">
            Save
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
