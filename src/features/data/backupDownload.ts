import { exportBackup } from '@/db/repositories';
import { toIsoDate } from '@/domain/partialDate';
import { saveFile } from '@/lib/download';

/** Full JSON backup download (SPEC §8.9). Kept small: used by the backup nudge in the main bundle. */
export async function downloadBackup(includePhotos: boolean): Promise<boolean> {
  return saveFile(
    `kin-backup-${toIsoDate(new Date())}.json`,
    'application/json',
    await exportBackup({ includePhotos }),
  );
}
