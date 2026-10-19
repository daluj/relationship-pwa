import { useEffect, useRef, type ReactNode } from 'react';
import { setLockFlag, useLock } from '@/app/stores/lock';
import { useSettingsQuery } from '@/db/repositories';
import { LockScreen } from './LockScreen';

/**
 * Gates the whole UI behind the app lock when it is enabled (SPEC §8.10): on open, and again after the
 * app has been in the background for `lockAfterMinutes`. Nothing behind it renders while locked.
 */
export function LockGate({ children }: { children: ReactNode }) {
  const settings = useSettingsQuery();
  const { locked, lock, unlock } = useLock();
  const config = settings?.appLock;
  const hiddenAt = useRef<number | null>(null);

  // Keep the localStorage mirror in sync with settings (e.g. after a restore or on another tab).
  useEffect(() => {
    if (!settings) return;
    setLockFlag(!!config);
    if (!config && locked) unlock();
  }, [settings, config, locked, unlock]);

  useEffect(() => {
    if (!config) return;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') hiddenAt.current = Date.now();
      else if (
        hiddenAt.current &&
        Date.now() - hiddenAt.current >= config.lockAfterMinutes * 60_000
      )
        lock();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [config, lock]);

  if (locked && (config || !settings)) return <LockScreen config={config} />;
  return <>{children}</>;
}
