import { z } from 'zod';

export const isoDateTime = z.string().datetime({ offset: true });
/** ISO date (`YYYY-MM-DD`) or full ISO datetime. */
export const isoDateOrDateTime = z.union([z.string().date(), isoDateTime]);
export const uuid = z.string().uuid();

export const baseRecordSchema = z.object({
  id: uuid,
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  deletedAt: isoDateTime.optional(),
});

export const partialDateSchema = z
  .object({
    year: z.number().int().min(1).max(9999).optional(),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
  })
  .refine(
    (d) => d.day <= new Date(Date.UTC(d.year ?? 2000, d.month, 0)).getUTCDate(), // 2000 is leap → Feb 29 ok without year
    { message: 'Invalid day for month' },
  );

export type BaseRecord = z.infer<typeof baseRecordSchema>;
export type PartialDate = z.infer<typeof partialDateSchema>;
