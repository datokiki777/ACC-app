import { analyzeBackupHealth, collectDataInsights, createBackupSnapshot } from './backup-health';
import { entry, person } from '../test/fixtures/golden';

const NOW = new Date('2026-08-09T12:00:00.000Z');

function data() {
  return {
    personal: [
      person({
        id: 'p1',
        currency: 'EUR',
        entries: [entry({ id: 'e1', date: '2026-08-01' })],
      }),
    ],
    work: [person({ id: 'w1', currency: 'USD', archived: true })],
    exportDate: NOW.toISOString(),
  };
}

describe('backup health', () => {
  it('marks a matching recent snapshot as current', () => {
    const current = data();
    const health = analyzeBackupHealth(
      { lastBackup: '2026-08-08T12:00:00.000Z', count: 2, ...createBackupSnapshot(current) },
      current,
      NOW,
    );
    expect(health).toMatchObject({ tone: 'safe', pendingEntryCount: 0, hasPendingChanges: false });
  });

  it('counts new and edited entries after a backup', () => {
    const saved = data();
    const current = data();
    current.personal[0]!.entries[0]!.amount = 250;
    current.personal[0]!.entries.push(entry({ id: 'e2', date: '2026-08-09' }));
    const health = analyzeBackupHealth(
      { lastBackup: '2026-08-08T12:00:00.000Z', count: 1, ...createBackupSnapshot(saved) },
      current,
      NOW,
    );
    expect(health).toMatchObject({
      tone: 'warning',
      pendingEntryCount: 2,
      hasPendingChanges: true,
    });
  });

  it('counts an entry deletion as an unprotected change', () => {
    const saved = data();
    const current = data();
    current.personal[0]!.entries = [];
    const health = analyzeBackupHealth(
      { lastBackup: '2026-08-08T12:00:00.000Z', count: 1, ...createBackupSnapshot(saved) },
      current,
      NOW,
    );
    expect(health).toMatchObject({ tone: 'warning', pendingEntryCount: 1 });
  });

  it('reports useful data insights without mixing currencies', () => {
    expect(collectDataInsights(data())).toMatchObject({
      people: 1,
      teams: 1,
      archived: 1,
      entries: 1,
      currencies: ['EUR', 'USD'],
      oldestEntryDate: '2026-08-01',
      newestEntryDate: '2026-08-01',
    });
  });
});
