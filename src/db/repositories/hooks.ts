import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { defaultSettings, type AppSettings } from '@/domain/settings';
import type { BaseRecord } from '@/domain/types';
import { blobRepo } from './blobRepo';
import { settingsRepo } from './settingsRepo';

interface LiveRepo<T extends BaseRecord> {
  list: () => Promise<T[]>;
  get: (id: string) => Promise<T | undefined>;
}

/** Live list of non-deleted records; `undefined` while the first query runs. */
export function useLiveList<T extends BaseRecord>(repo: LiveRepo<T>): T[] | undefined {
  return useLiveQuery(() => repo.list(), [repo]);
}

/** Live record: `undefined` while loading, `null` when missing or soft-deleted. */
export function useLiveRecord<T extends BaseRecord>(
  repo: LiveRepo<T>,
  id: string | undefined,
): T | null | undefined {
  return useLiveQuery(async () => (id ? ((await repo.get(id)) ?? null) : null), [repo, id]);
}

/** Live app settings; `undefined` until the first read resolves. */
export function useSettingsQuery(): AppSettings | undefined {
  return useLiveQuery(() => settingsRepo.getAll(), []);
}

/** Live app settings, falling back to defaults while loading. */
export function useSettings(): AppSettings {
  return useSettingsQuery() ?? defaultSettings;
}

/** Object URL for a stored image blob; revoked on change/unmount (tech-stack §10). */
export function useBlobUrl(blobId: string | undefined): string | undefined {
  const record = useLiveQuery(() => (blobId ? blobRepo.get(blobId) : undefined), [blobId]);
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!record) {
      setUrl(undefined);
      return;
    }
    const u = URL.createObjectURL(record.data);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [record]);
  return url;
}
