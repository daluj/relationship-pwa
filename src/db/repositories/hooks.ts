import { useLiveQuery } from 'dexie-react-hooks';
import { defaultSettings, type AppSettings } from '@/domain/settings';
import type { BaseRecord } from '@/domain/types';
import { settingsRepo } from './settingsRepo';

interface LiveRepo<T extends BaseRecord> {
  list: () => Promise<T[]>;
  get: (id: string) => Promise<T | undefined>;
}

/** Live list of non-deleted records; `undefined` while the first query runs. */
export function useLiveList<T extends BaseRecord>(repo: LiveRepo<T>): T[] | undefined {
  return useLiveQuery(() => repo.list(), [repo]);
}

export function useLiveRecord<T extends BaseRecord>(
  repo: LiveRepo<T>,
  id: string | undefined,
): T | undefined {
  return useLiveQuery(() => (id ? repo.get(id) : undefined), [repo, id]);
}

/** Live app settings; `undefined` until the first read resolves. */
export function useSettingsQuery(): AppSettings | undefined {
  return useLiveQuery(() => settingsRepo.getAll(), []);
}

/** Live app settings, falling back to defaults while loading. */
export function useSettings(): AppSettings {
  return useSettingsQuery() ?? defaultSettings;
}
