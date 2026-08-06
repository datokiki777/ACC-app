import { exportedBackupSchema, legacyPersonSchema } from './schemas';
import { flattenLegacyStages, normalizeImportedPeople } from './legacy-normalization';
import { legacyStagesPerson } from '../test/fixtures/golden';

describe('legacy normalization', () => {
  it('flattens stages, selects the open-stage currency, and sorts newest first', () => {
    const normalized = flattenLegacyStages(legacyStagesPerson);
    expect(normalized.currency).toBe('CAD');
    expect(normalized.stages).toBeUndefined();
    expect(normalized.entries?.map((entry) => entry.id)).toEqual(['new', 'old']);
  });

  it('preserves unknown person and entry fields', () => {
    const normalized = flattenLegacyStages(legacyStagesPerson);
    expect(normalized.customPersonField).toEqual({ preserved: true });
    expect(normalized.entries?.[0]?.customEntry).toBe('new');
    expect(normalized.entries?.[1]?.customEntry).toBe('old');
    expect(normalized.legacyStageFields).toEqual([
      { stageMetadata: 'keep indirectly only on raw snapshot' },
      {},
    ]);
  });

  it('uses the last stage currency when all stages are closed', () => {
    const normalized = flattenLegacyStages({
      stages: [
        { currency: 'USD', closed: true },
        { currency: 'GEL', closed: true },
      ],
    });
    expect(normalized.currency).toBe('GEL');
  });

  it('is idempotent for already-flat people and resets imported expansion state', () => {
    const once = normalizeImportedPeople([legacyStagesPerson]);
    const twice = normalizeImportedPeople(once);
    expect(twice).toEqual(once);
    expect(twice[0]?.expanded).toBe(false);
  });

  it('validates legacy inputs while retaining unknown fields', () => {
    const parsed = legacyPersonSchema.parse(legacyStagesPerson);
    expect(parsed.customPersonField).toEqual({ preserved: true });
  });

  it('validates full backups and rejects missing modes', () => {
    expect(
      exportedBackupSchema.safeParse({ personal: [legacyStagesPerson], work: [], extra: true })
        .success,
    ).toBe(true);
    expect(exportedBackupSchema.safeParse({ personal: [] }).success).toBe(false);
  });
});
