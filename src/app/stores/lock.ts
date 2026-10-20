import { create } from 'zustand';

/** localStorage mirror of "app lock is on", so the lock screen shows before IndexedDB has loaded. */
export const LOCK_FLAG = 'kin.lock';

const flagged = () => {
  try {
    return localStorage.getItem(LOCK_FLAG) === '1';
  } catch {
    return false;
  }
};

interface LockState {
  locked: boolean;
  lock: () => void;
  unlock: () => void;
}

/** App lock UI state (features §8.10). Starts locked whenever the lock is enabled. */
export const useLock = create<LockState>((set) => ({
  locked: flagged(),
  lock: () => set({ locked: true }),
  unlock: () => set({ locked: false }),
}));

export function setLockFlag(on: boolean): void {
  try {
    if (on) localStorage.setItem(LOCK_FLAG, '1');
    else localStorage.removeItem(LOCK_FLAG);
  } catch {
    // ignore — settings stay authoritative
  }
}
