import { useRef, useState } from 'react';

import { BottomSheet } from '../../components/BottomSheet';
import {
  downloadBackup,
  inspectBackupText,
  type BackupInspection,
  type ImportMode,
} from '../../services/backup';
import { useAppStore } from '../../store/hooks';

export function BackupSheet() {
  const close = useAppStore((state) => state.closeSheet);
  const importBackup = useAppStore((state) => state.importBackup);
  const exportBackup = useAppStore((state) => state.exportBackup);
  const report = useAppStore((state) => state.lastRestoreReport);
  const [inspection, setInspection] = useState<BackupInspection | null>(null);
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function selectFile(file: File | undefined) {
    if (!file) return;
    setError('');
    setReplaceConfirmed(false);
    setInspection(inspectBackupText(await file.text(), file.name));
  }

  async function restore(mode: ImportMode) {
    if (!inspection?.valid) return;
    if (mode === 'replace' && !replaceConfirmed) return;
    setBusy(true);
    setError('');
    try {
      await importBackup(inspection, mode);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet onClose={close} title="Data & Backup" wide>
      <div className="backup-actions-main">
        <button
          className="primary-button"
          onClick={() => void exportBackup().then(downloadBackup)}
          type="button"
        >
          Export JSON
        </button>
        <button className="secondary-button" onClick={() => fileRef.current?.click()} type="button">
          Choose backup
        </button>
        <input
          accept="application/json,.json"
          hidden
          onChange={(event) => void selectFile(event.target.files?.[0])}
          ref={fileRef}
          type="file"
        />
      </div>

      {inspection && (
        <section className={`backup-inspection ${inspection.valid ? 'valid' : 'invalid'}`}>
          <h3>Backup safety check</h3>
          <dl>
            <div>
              <dt>Filename</dt>
              <dd>{inspection.filename}</dd>
            </div>
            <div>
              <dt>Validation</dt>
              <dd>{inspection.valid ? 'Valid' : 'Failed'}</dd>
            </div>
            <div>
              <dt>Personal</dt>
              <dd>{inspection.counts.personalPeople}</dd>
            </div>
            <div>
              <dt>Work</dt>
              <dd>{inspection.counts.workPeople}</dd>
            </div>
            <div>
              <dt>Entries</dt>
              <dd>{inspection.counts.entries}</dd>
            </div>
            <div>
              <dt>Export date</dt>
              <dd>
                {inspection.exportDate
                  ? new Date(inspection.exportDate).toLocaleString()
                  : 'Not provided'}
              </dd>
            </div>
          </dl>
          {!inspection.valid && (
            <ul className="error-list">
              {inspection.errors.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {inspection.valid && (
            <>
              <button
                className="secondary-button full-button"
                disabled={busy}
                onClick={() => void restore('merge')}
                type="button"
              >
                Merge with current data
              </button>
              <label className="replace-confirm">
                <input
                  checked={replaceConfirmed}
                  onChange={(event) => setReplaceConfirmed(event.target.checked)}
                  type="checkbox"
                />
                <span>I understand Replace will overwrite all React Personal and Work data.</span>
              </label>
              <button
                className="danger-button full-button"
                disabled={!replaceConfirmed || busy}
                onClick={() => void restore('replace')}
                type="button"
              >
                Replace all React data
              </button>
            </>
          )}
        </section>
      )}

      {report && (
        <section className={`restore-report ${report.success ? 'success' : 'failure'}`}>
          <h3>
            {report.success ? 'Restore verified successfully' : 'Restore verification failed'}
          </h3>
          <p>
            Personal: {report.personal.personCount} people · {report.personal.entryCount} entries
          </p>
          <p>
            Work: {report.work.personCount} people · {report.work.entryCount} entries
          </p>
          {report.failures.map((failure) => (
            <p key={failure}>{failure}</p>
          ))}
        </section>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </BottomSheet>
  );
}
