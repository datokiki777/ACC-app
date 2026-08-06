import { mergePeople } from '../../domain/backup-merge';
import { flattenLegacyStages } from '../../domain/legacy-normalization';
import { exportedBackupSchema } from '../../domain/schemas';
import type { ExportedBackupData } from '../../types/domain';

describe('unknown legacy field round trips', () => {
  it('preserves person, stage, and entry fields through validation, flattening, merge, and JSON', () => {
    const input: ExportedBackupData = {
      personal: [
        {
          id: 'unknowns',
          name: 'Unknown fields',
          personExtension: { version: 7 },
          stages: [
            {
              currency: 'GEL',
              closed: false,
              stageExtension: ['keep', 42],
              entries: [
                {
                  id: 'unknown-entry',
                  amount: 10,
                  type: 'Gave',
                  date: '2026-01-01',
                  entryExtension: { source: 'legacy' },
                },
              ],
            },
          ],
        },
      ],
      work: [],
      backupExtension: 'keep',
    };

    const validated = exportedBackupSchema.parse(input) as unknown as ExportedBackupData;
    const flattened = flattenLegacyStages(validated.personal[0]!);
    const merged = mergePeople([], [flattened]);
    const serialized = JSON.parse(
      JSON.stringify({ ...validated, personal: merged }),
    ) as ExportedBackupData;
    const revalidated = exportedBackupSchema.parse(serialized);
    const result = revalidated.personal[0]!;

    expect(revalidated.backupExtension).toBe('keep');
    expect(result.personExtension).toEqual({ version: 7 });
    expect(result.legacyStageFields).toEqual([{ stageExtension: ['keep', 42] }]);
    expect(result.entries?.[0]?.entryExtension).toEqual({ source: 'legacy' });
  });
});
