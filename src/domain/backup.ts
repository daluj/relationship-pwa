import { z } from 'zod';
import * as s from './schemas';

/**
 * Full JSON backup format (features §8.9):
 * `{ app: "kin", schemaVersion, exportedAt, includesPhotos, data: { contacts: [...], …, blobs: [{ id, mime, base64, … }] } }`.
 */
export const BACKUP_SCHEMA_VERSION = 1; // tracks the Dexie schema version (db/schema.ts)

export const backupTables = [
  'contacts',
  'contactFields',
  'addresses',
  'relationships',
  'moments',
  'reminders',
  'importantDates',
  'gifts',
  'debts',
  'tasks',
  'pets',
  'tags',
  'groups',
  'settings',
] as const;
export type BackupTable = (typeof backupTables)[number] | 'blobs';

export const backupBlobSchema = s.blobRecordSchema
  .omit({ data: true })
  .extend({ base64: z.string() });

export const tableSchemas: Record<BackupTable, z.ZodTypeAny> = {
  contacts: s.contactSchema,
  contactFields: s.contactFieldSchema,
  addresses: s.addressSchema,
  relationships: s.relationshipSchema,
  moments: s.momentSchema,
  reminders: s.reminderSchema,
  importantDates: s.importantDateSchema,
  gifts: s.giftSchema,
  debts: s.debtSchema,
  tasks: s.taskSchema,
  pets: s.petSchema,
  tags: s.tagSchema,
  groups: s.groupSchema,
  settings: s.settingSchema,
  blobs: backupBlobSchema,
};

export const envelopeSchema = z.object({
  app: z.literal('kin'),
  schemaVersion: z.number().int().positive(),
  exportedAt: s.isoDateTime,
  includesPhotos: z.boolean().optional(),
  data: z.record(z.array(z.unknown())),
});
export type BackupEnvelope = z.infer<typeof envelopeSchema>;

/** Migrations from version n to n + 1, applied in order (features §8.9 "if schemaVersion older"). */
export const backupMigrations: Record<
  number,
  (data: BackupEnvelope['data']) => BackupEnvelope['data']
> = {};

export class BackupError extends Error {
  constructor(
    readonly code: 'not-kin' | 'too-new' | 'invalid',
    readonly details: string[] = [],
  ) {
    super(`${code}${details.length ? `: ${details.slice(0, 3).join('; ')}` : ''}`);
    this.name = 'BackupError';
  }
}

export type ParsedBackup = { [K in BackupTable]: unknown[] } & {
  meta: { exportedAt: string; includesPhotos: boolean };
};

/** Parse, migrate and validate a backup. Throws `BackupError`; never partially accepts invalid data. */
export function parseBackup(json: unknown): ParsedBackup {
  const env = envelopeSchema.safeParse(json);
  if (!env.success) throw new BackupError('not-kin');
  let { data } = env.data;
  const version = env.data.schemaVersion;
  if (version > BACKUP_SCHEMA_VERSION) throw new BackupError('too-new', [`v${version}`]);
  for (let v = version; v < BACKUP_SCHEMA_VERSION; v++) data = backupMigrations[v]!(data);

  const errors: string[] = [];
  const out = {
    meta: { exportedAt: env.data.exportedAt, includesPhotos: !!env.data.includesPhotos },
  } as ParsedBackup;
  for (const table of [...backupTables, 'blobs'] as BackupTable[]) {
    const rows = data[table] ?? [];
    out[table] = rows.map((row, i) => {
      const r = tableSchemas[table].safeParse(row);
      if (!r.success && errors.length < 20) {
        errors.push(
          `${table}[${i}]: ${r.error.issues.map((x) => `${x.path.join('.')} ${x.message}`).join(', ')}`,
        );
      }
      return r.success ? r.data : row;
    });
  }
  if (errors.length) throw new BackupError('invalid', errors);
  return out;
}
