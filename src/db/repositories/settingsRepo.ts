import { defaultSettings, type AppSettings } from '@/domain/settings';
import { db } from '../db';

export const settingsRepo = {
  async get<K extends keyof AppSettings>(key: K): Promise<AppSettings[K]> {
    const row = await db.settings.get(key);
    return (row?.value as AppSettings[K] | undefined) ?? defaultSettings[key];
  },

  async set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> {
    await db.settings.put({ key, value });
  },

  async remove(key: keyof AppSettings): Promise<void> {
    await db.settings.delete(key);
  },

  /** All known settings merged over defaults. */
  async getAll(): Promise<AppSettings> {
    const rows = await db.settings.toArray();
    const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return { ...defaultSettings, ...stored } as AppSettings;
  },
};
