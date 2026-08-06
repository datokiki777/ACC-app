import { entryFingerprint, mergeEntries, mergePeople, personFingerprint } from './backup-merge';
import type { LegacyEntry, LegacyPerson } from '../types/domain';

describe('backup merge parity', () => {
  it('matches people and entries by stable ID', () => {
    const current: LegacyPerson[] = [
      {
        id: 'p1',
        name: 'Existing name',
        currency: 'EUR',
        entries: [{ id: 'e1', amount: 10, type: 'Gave', date: '2026-01-01' }],
      },
    ];
    const incoming: LegacyPerson[] = [
      {
        id: 'p1',
        name: 'Incoming name',
        note: 'fills missing note',
        entries: [
          {
            id: 'e1',
            amount: 999,
            type: 'Gave',
            date: '2026-01-01',
            comment: 'fills missing comment',
          },
        ],
      },
    ];
    const merged = mergePeople(current, incoming);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ name: 'Existing name', note: 'fills missing note' });
    expect(merged[0]?.entries?.[0]).toMatchObject({
      amount: 10,
      comment: 'fills missing comment',
    });
  });

  it('matches ID-less records by legacy fingerprints', () => {
    const current: LegacyPerson[] = [
      {
        name: ' Alex ',
        note: 'Friend',
        entries: [{ amount: 10, type: 'Gave', date: '2026-01-01', comment: 'Lunch' }],
      },
    ];
    const incoming: LegacyPerson[] = [
      {
        name: 'alex',
        note: 'friend',
        tagLabel: 'Imported',
        entries: [
          {
            amount: 10,
            type: 'Gave',
            date: '2026-01-01',
            comment: 'Lunch',
            custom: 'preserved',
          },
        ],
      },
    ];
    const merged = mergePeople(current, incoming);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.tagLabel).toBe('Imported');
    expect(merged[0]?.entries).toHaveLength(1);
    expect(merged[0]?.entries?.[0]?.custom).toBe('preserved');
  });

  it('does not fingerprint-match a stable unmatched ID', () => {
    const current: LegacyEntry[] = [
      { id: 'one', amount: 10, type: 'Gave', date: '2026-01-01', comment: 'same' },
    ];
    const incoming: LegacyEntry[] = [
      { id: 'two', amount: 10, type: 'Gave', date: '2026-01-01', comment: 'same' },
    ];
    expect(mergeEntries(current, incoming)).toHaveLength(2);
  });

  it('lets incoming archived true win but keeps existing non-empty scalars', () => {
    const merged = mergePeople(
      [{ id: 'p1', name: 'Current', archived: false, currency: 'EUR', entries: [] }],
      [{ id: 'p1', name: 'Incoming', archived: true, currency: 'USD', entries: [] }],
    );
    expect(merged[0]).toMatchObject({ name: 'Current', archived: true, currency: 'EUR' });
  });

  it('deep-clones incoming object and array fields', () => {
    const metadata = { nested: ['value'] };
    const merged = mergeEntries([{}], [{ metadata }]);
    expect(merged[0]?.metadata).toEqual(metadata);
    expect(merged[0]?.metadata).not.toBe(metadata);
  });

  it('reproduces fingerprint formats', () => {
    expect(
      entryFingerprint({ type: 'Received', amount: '12', date: '2026-01-01', comment: 'x' }),
    ).toBe('Received|12|2026-01-01|x');
    expect(personFingerprint({ name: ' Alex ', note: ' FRIEND ' })).toBe('alex|friend');
  });
});
