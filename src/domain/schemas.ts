import { z } from 'zod';

export const currencySchema = z.enum(['EUR', 'USD', 'GEL', 'CAD']);
export const entryTypeSchema = z.enum(['Gave', 'Received']);
export const entryCategorySchema = z.enum(['salary', 'gift']);
export const payDelayModeSchema = z.enum(['none', '2weeks', '4weeks', 'firstOfMonth']);

export const legacyEntrySchema = z
  .object({
    id: z.string().optional(),
    amount: z.union([z.number(), z.string()]).optional(),
    type: entryTypeSchema.optional(),
    date: z.string().optional(),
    comment: z.string().optional(),
    category: entryCategorySchema.optional(),
  })
  .catchall(z.unknown());

export const legacyStageSchema = z
  .object({
    currency: currencySchema.optional(),
    closed: z.boolean().optional(),
    entries: z.array(legacyEntrySchema).optional(),
  })
  .catchall(z.unknown());

export const legacyPersonSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    note: z.string().optional(),
    currency: currencySchema.optional(),
    entries: z.array(legacyEntrySchema).optional(),
    stages: z.array(legacyStageSchema).optional(),
    tagLabel: z.string().optional(),
    tagColor: z.string().optional(),
    archived: z.boolean().optional(),
    expanded: z.boolean().optional(),
    createdAt: z.string().optional(),
    salaryAmount: z.union([z.number(), z.string()]).optional(),
    salaryStartDate: z.string().optional(),
    salaryEndDate: z.string().optional(),
    salaryPayPeriodWeeks: z.union([z.number(), z.string()]).optional(),
    salaryPayDay: z.union([z.number(), z.string()]).optional(),
    salaryPayDelayMode: payDelayModeSchema.optional(),
    salaryCurrency: currencySchema.optional(),
    salaryPeriodAnchorDate: z.string().optional(),
    salaryAccruedBaseline: z.union([z.number(), z.string()]).optional(),
  })
  .catchall(z.unknown());

export const exportedBackupSchema = z
  .object({
    personal: z.array(legacyPersonSchema),
    work: z.array(legacyPersonSchema),
    exportDate: z.string().optional(),
  })
  .catchall(z.unknown());

export type ValidatedBackup = z.infer<typeof exportedBackupSchema>;
