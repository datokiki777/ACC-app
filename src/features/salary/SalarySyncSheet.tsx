import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { BottomSheet } from '../../components/BottomSheet';
import { useAppNavigation, useUnsavedForm } from '../../app/useAppNavigation';
import { calculateSalary } from '../../domain/salary';
import { useAppStore } from '../../store/hooks';
import { formatMoney, localDateString } from '../../utils/format';

interface SyncForm {
  adjustmentAmount: number;
  newAnchorDate: string;
}

export function SalarySyncSheet() {
  const personId = useAppStore((state) => state.ui.personId);
  const person = useAppStore((state) =>
    state.peopleByMode.work.find((candidate) => candidate.id === personId),
  );
  const sync = useAppStore((state) => state.syncSalary);
  const { closeAfterSave, requestClose } = useAppNavigation();
  const [error, setError] = useState('');
  const salary = person ? calculateSalary(person, new Date()) : null;
  const owed = salary ? Math.max(0, salary.accrued - salary.paid) : 0;
  const {
    register,
    handleSubmit,
    formState: { isDirty, isSubmitting },
  } = useForm<SyncForm>({
    defaultValues: { adjustmentAmount: owed, newAnchorDate: localDateString() },
  });
  useUnsavedForm(isDirty);
  if (!person || !salary) return null;

  const submit = handleSubmit(async (values) => {
    if (!values.newAnchorDate) {
      setError('New cycle date is required');
      return;
    }
    try {
      await sync(person.id, values.adjustmentAmount, values.newAnchorDate);
      closeAfterSave();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not sync salary');
    }
  });

  return (
    <BottomSheet onClose={requestClose} title="Sync Pay Date">
      <form autoComplete="off" className="form-grid" onSubmit={(event) => void submit(event)}>
        <p className="inline-note">
          Earned but not yet paid: <strong>{formatMoney(owed, salary.currency, false)}</strong>
        </p>
        <label className="field">
          <span>One-time adjustment</span>
          <input
            autoComplete="off"
            inputMode="decimal"
            min={0}
            step={1}
            type="number"
            {...register('adjustmentAmount', { valueAsNumber: true })}
          />
        </label>
        <label className="field">
          <span>New cycle start date</span>
          <input autoComplete="off" type="date" {...register('newAnchorDate')} />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button className="secondary-button" onClick={requestClose} type="button">
            Cancel
          </button>
          <button className="primary-button" disabled={isSubmitting} type="submit">
            Sync
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
