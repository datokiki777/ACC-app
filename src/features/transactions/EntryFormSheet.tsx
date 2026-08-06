import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { BottomSheet } from '../../components/BottomSheet';
import type { EntryDraft } from '../../store/app-store';
import { useAppStore } from '../../store/hooks';
import { localDateString } from '../../utils/format';

const entrySchema = z.object({
  amount: z.number().min(1, 'Amount must be at least 1'),
  type: z.enum(['Gave', 'Received']),
  date: z.string().min(1, 'Date is required'),
  comment: z.string(),
  category: z.enum(['salary', 'gift']).optional(),
});

export function EntryFormSheet() {
  const mode = useAppStore((state) => state.mode);
  const personId = useAppStore((state) => state.ui.personId);
  const entryId = useAppStore((state) => state.ui.entryId);
  const people = useAppStore((state) => state.peopleByMode[state.mode]);
  const addEntry = useAppStore((state) => state.addEntry);
  const editEntry = useAppStore((state) => state.editEntry);
  const close = useAppStore((state) => state.closeSheet);
  const person = people.find((candidate) => candidate.id === personId);
  const existing = person?.entries.find((candidate) => candidate.id === entryId);
  const [formError, setFormError] = useState('');
  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { isSubmitting },
  } = useForm<EntryDraft>({
    defaultValues: {
      amount: existing?.amount ?? 0,
      type: existing?.type ?? 'Gave',
      date: existing?.date ?? localDateString(),
      comment: existing?.comment ?? '',
      ...(mode === 'work' ? { category: existing?.category ?? 'gift' } : {}),
    },
  });
  const type = useWatch({ control, name: 'type' });
  const category = useWatch({ control, name: 'category' });
  if (!person) return null;

  const submit = handleSubmit(async (raw) => {
    const { category: ignoredCategory, ...personalEntry } = raw;
    void ignoredCategory;
    const candidate = mode === 'work' ? raw : personalEntry;
    const result = entrySchema.safeParse(candidate);
    if (!result.success) {
      setFormError(result.error.issues[0]?.message ?? 'Check the entry');
      return;
    }
    const draft: EntryDraft = {
      amount: result.data.amount,
      type: result.data.type,
      date: result.data.date,
      comment: result.data.comment,
      ...(result.data.category ? { category: result.data.category } : {}),
    };
    try {
      if (existing) await editEntry(person.id, existing.id, draft);
      else await addEntry(person.id, draft);
      close();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save entry');
    }
  });

  return (
    <BottomSheet onClose={close} title={existing ? 'Edit Entry' : `Add Entry · ${person.name}`}>
      <form className="form-grid" onSubmit={(event) => void submit(event)}>
        <label className="field">
          <span>Amount</span>
          <input
            autoFocus
            min={1}
            step={1}
            type="number"
            {...register('amount', { valueAsNumber: true })}
          />
        </label>

        {mode === 'work' && (
          <div className="field">
            <span>Kind</span>
            <div className="choice-row">
              <button
                className={category === 'salary' ? 'choice-button is-selected' : 'choice-button'}
                onClick={() => {
                  setValue('category', 'salary');
                  setValue('type', 'Gave');
                }}
                type="button"
              >
                Salary
              </button>
              <button
                className={category === 'gift' ? 'choice-button is-selected' : 'choice-button'}
                onClick={() => setValue('category', 'gift')}
                type="button"
              >
                Other
              </button>
            </div>
          </div>
        )}

        {category !== 'salary' && (
          <div className="field">
            <span>Type</span>
            <div className="choice-row">
              <button
                className={
                  type === 'Gave' ? 'choice-button is-selected choice-gave' : 'choice-button'
                }
                onClick={() => setValue('type', 'Gave')}
                type="button"
              >
                ↗ Gave
              </button>
              <button
                className={
                  type === 'Received'
                    ? 'choice-button is-selected choice-received'
                    : 'choice-button'
                }
                onClick={() => setValue('type', 'Received')}
                type="button"
              >
                ↘ Received
              </button>
            </div>
          </div>
        )}

        <label className="field">
          <span>Date</span>
          <input type="date" {...register('date')} />
        </label>
        <label className="field">
          <span>
            Comment <small>optional</small>
          </span>
          <textarea rows={3} {...register('comment')} />
        </label>
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
