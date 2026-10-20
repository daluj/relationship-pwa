import { settingsRepo } from '@/db/repositories';

/**
 * Onboarding is complete when `settings.onboarded` is set (features §8.1). It is mirrored in localStorage
 * (a per-device convenience, like the theme) so the start-up redirect can be decided without waiting
 * for IndexedDB. "Delete all data" clears both, so onboarding shows again.
 */
export const ONBOARDED_KEY = 'kin.onboarded';

export function onboardedLocally(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === '1';
  } catch {
    return false;
  }
}

export async function markOnboarded(): Promise<void> {
  await settingsRepo.set('onboarded', true);
  try {
    localStorage.setItem(ONBOARDED_KEY, '1');
  } catch {
    // Storage blocked — the IndexedDB flag is authoritative anyway.
  }
}
