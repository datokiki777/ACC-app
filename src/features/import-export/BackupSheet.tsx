import { useEffect, useMemo, useRef, useState } from 'react';

import { BottomSheet } from '../../components/BottomSheet';
import { useAppNavigation } from '../../app/useAppNavigation';
import {
  downloadBackup,
  inspectBackupText,
  type BackupInspection,
  type ImportMode,
} from '../../services/backup';
import { analyzeBackupHealth, collectDataInsights } from '../../services/backup-health';
import { buildAllPdfReport, openPdfPrintDialog } from '../../services/pdf-report';
import { useAppStore } from '../../store/hooks';

function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined || !Number.isFinite(bytes)) return 'Unavailable';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

export function BackupSheet() {
  const { requestClose } = useAppNavigation();
  const importBackup = useAppStore((state) => state.importBackup);
  const exportBackup = useAppStore((state) => state.exportBackup);
  const report = useAppStore((state) => state.lastRestoreReport);
  const peopleByMode = useAppStore((state) => state.peopleByMode);
  const backupMetadata = useAppStore((state) => state.backupMetadata);
  const [inspection, setInspection] = useState<BackupInspection | null>(null);
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deviceStorage, setDeviceStorage] = useState<StorageEstimate | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const currentData = useMemo(
    () => ({ personal: peopleByMode.personal, work: peopleByMode.work }),
    [peopleByMode],
  );
  const health = useMemo(
    () => analyzeBackupHealth(backupMetadata, currentData),
    [backupMetadata, currentData],
  );
  const insights = useMemo(() => collectDataInsights(currentData), [currentData]);

  useEffect(() => {
    let active = true;
    if (!navigator.storage?.estimate) return;
    void navigator.storage.estimate().then((estimate) => {
      if (active) setDeviceStorage(estimate);
    });
    return () => {
      active = false;
    };
  }, []);

  async function exportJson() {
    setError('');
    try {
      downloadBackup(await exportBackup());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Export failed');
    }
  }

  function exportPdf() {
    setError('');
    try {
      openPdfPrintDialog(buildAllPdfReport(currentData));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'PDF report could not open');
    }
  }

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
    <BottomSheet onClose={requestClose} title="Data & Backup" wide>
      <section className={`backup-health-card is-${health.tone}`}>
        <div className="backup-health-heading">
          <span className="backup-health-icon" aria-hidden="true">
            {health.tone === 'safe' ? '✓' : health.tone === 'warning' ? '!' : '×'}
          </span>
          <div>
            <h3>{health.label}</h3>
            <p>{health.detail}</p>
          </div>
        </div>
        <div className="backup-health-facts">
          <div>
            <span>Last JSON backup</span>
            <strong>
              {backupMetadata.lastBackup
                ? new Date(backupMetadata.lastBackup).toLocaleString()
                : 'Never'}
            </strong>
          </div>
          <div>
            <span>Not backed up</span>
            <strong>
              {health.trackingAvailable
                ? `${health.pendingEntryCount} entries`
                : 'Tracking unavailable'}
            </strong>
          </div>
        </div>
      </section>

      <div className="backup-actions-main">
        <button className="primary-button" onClick={() => void exportJson()} type="button">
          Export JSON
        </button>
        <button className="secondary-button" onClick={exportPdf} type="button">
          All data PDF
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
      <p className="backup-format-note">
        JSON is the restorable backup. PDF opens the phone print screen—choose “Save as PDF”.
      </p>

      <section className="backup-insights" aria-label="Data and device insights">
        <div className="backup-section-heading">
          <div>
            <span>On this device</span>
            <h3>ACC data overview</h3>
          </div>
          <strong>{formatBytes(deviceStorage?.usage)}</strong>
        </div>
        <div className="backup-insight-grid">
          <div>
            <span>Personal</span>
            <strong>{insights.people}</strong>
          </div>
          <div>
            <span>Work teams</span>
            <strong>{insights.teams}</strong>
          </div>
          <div>
            <span>Entries</span>
            <strong>{insights.entries}</strong>
          </div>
          <div>
            <span>Archived</span>
            <strong>{insights.archived}</strong>
          </div>
          <div>
            <span>Data file</span>
            <strong>{formatBytes(insights.dataBytes)}</strong>
          </div>
          <div>
            <span>Backup exports</span>
            <strong>{backupMetadata.count}</strong>
          </div>
        </div>
        <dl className="backup-detail-list">
          <div>
            <dt>Currencies</dt>
            <dd>{insights.currencies.join(', ') || 'None yet'}</dd>
          </div>
          <div>
            <dt>Entry range</dt>
            <dd>
              {insights.oldestEntryDate && insights.newestEntryDate
                ? `${insights.oldestEntryDate} — ${insights.newestEntryDate}`
                : 'No entries yet'}
            </dd>
          </div>
          <div>
            <dt>Device storage quota</dt>
            <dd>{formatBytes(deviceStorage?.quota)}</dd>
          </div>
        </dl>
        <p className="backup-storage-note">
          Device usage includes ACC local data and offline app files. It can vary by browser.
        </p>
      </section>

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
