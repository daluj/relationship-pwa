import type { Table } from 'dexie';
import type { ZodType, ZodTypeDef } from 'zod';
import type { BaseRecord } from '@/domain/types';
import { db } from '../db';
import { RecordNotFoundError, ValidationError } from './errors';

type BaseKeys = keyof BaseRecord;

/** Input for `create`: everything except BaseRecord fields; fields listed in `D` have defaults. */
export type CreateInput<T extends BaseRecord, D extends keyof T = never> = Omit<T, BaseKeys | D> &
  Partial<Pick<T, D>> & { id?: string };

/** Fields a caller may change. Timestamps and soft-delete are owned by the repository. */
export type UpdatePatch<T extends BaseRecord> = Partial<Omit<T, BaseKeys>>;

export interface RepositoryOptions<T extends BaseRecord, D extends keyof T> {
  entity: string;
  table: Table<T, string, T>;
  schema: ZodType<T, ZodTypeDef, unknown>;
  defaults?: () => Pick<T, D>;
  /** Derive computed fields (e.g. `nameLower`) before validation. */
  prepare?: (record: T) => T;
}

export interface ListOptions {
  includeDeleted?: boolean;
}

export const nowIso = () => new Date().toISOString();

export function createRepository<T extends BaseRecord, D extends keyof T = never>(
  opts: RepositoryOptions<T, D>,
) {
  const { entity, table, schema, defaults, prepare = (r: T) => r } = opts;

  function validate(record: T): T {
    const result = schema.safeParse(prepare(record));
    if (!result.success) throw new ValidationError(entity, result.error.issues);
    return result.data;
  }

  async function mustGet(id: string): Promise<T> {
    const record = await table.get(id);
    if (!record) throw new RecordNotFoundError(entity, id);
    return record;
  }

  return {
    entity,
    table,

    validate,

    async create(input: CreateInput<T, D>): Promise<T> {
      const now = nowIso();
      const record = validate({
        ...(defaults?.() ?? {}),
        ...input,
        id: input.id ?? crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      } as unknown as T);
      await table.add(record);
      return record;
    },

    async update(id: string, patch: UpdatePatch<T>): Promise<T> {
      return db.transaction('rw', table, async () => {
        const current = await mustGet(id);
        const next = validate({
          ...current,
          ...patch,
          id,
          createdAt: current.createdAt,
          updatedAt: nowIso(),
        });
        await table.put(next);
        return next;
      });
    },

    /** Returns the record unless soft-deleted (pass `includeDeleted` for Trash/restore flows). */
    async get(id: string, { includeDeleted = false }: ListOptions = {}): Promise<T | undefined> {
      const record = await table.get(id);
      if (!record || (record.deletedAt && !includeDeleted)) return undefined;
      return record;
    },

    async list({ includeDeleted = false }: ListOptions = {}): Promise<T[]> {
      return includeDeleted ? table.toArray() : table.filter((r) => !r.deletedAt).toArray();
    },

    async listDeleted(): Promise<T[]> {
      return table.filter((r) => !!r.deletedAt).toArray();
    },

    async softDelete(id: string): Promise<void> {
      await db.transaction('rw', table, async () => {
        const current = await mustGet(id);
        if (current.deletedAt) return;
        const now = nowIso();
        await table.put({ ...current, deletedAt: now, updatedAt: now });
      });
    },

    async restore(id: string): Promise<void> {
      await db.transaction('rw', table, async () => {
        const { deletedAt, ...rest } = await mustGet(id);
        await table.put({ ...rest, updatedAt: nowIso() } as T);
      });
    },

    /** Permanent delete — only for "Delete forever" in Trash and the 30-day purge. */
    async purge(id: string): Promise<void> {
      await table.delete(id);
    },

    async count(): Promise<number> {
      return table.filter((r) => !r.deletedAt).count();
    },
  };
}

export type Repository<T extends BaseRecord, D extends keyof T = never> = ReturnType<
  typeof createRepository<T, D>
>;
