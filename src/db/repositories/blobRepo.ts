import { blobRecordSchema } from '@/domain/schemas';
import type { BlobRecord } from '@/domain/types';
import { db } from '../db';
import { nowIso } from './createRepository';
import { ValidationError } from './errors';

/** Image blobs. Not soft-deleted: owners hold the reference and delete blobs on purge. */
export const blobRepo = {
  async put(input: Omit<BlobRecord, 'id' | 'createdAt'> & { id?: string }): Promise<BlobRecord> {
    const record = { ...input, id: input.id ?? crypto.randomUUID(), createdAt: nowIso() };
    const result = blobRecordSchema.safeParse(record);
    if (!result.success) throw new ValidationError('blob', result.error.issues);
    await db.blobs.put(record);
    return record;
  },
  get: (id: string) => db.blobs.get(id),
  delete: (id: string) => db.blobs.delete(id),
};
