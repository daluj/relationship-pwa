import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { runReminderCheck } from '@/db/repositories/reminderCheck';
import {
  activeRegistration,
  notificationFor,
  notificationsSupported,
  registerPeriodicCheck,
  setAppBadge,
} from './notify';
import { useDueReminders } from './useDueReminders';

/**
 * On app open and whenever it becomes visible: show system notifications for newly due reminders
 * (if permitted), keep the app badge in sync, and register periodic checks where supported (SPEC §8.5).
 */
export function useReminderNotifications(): void {
  const { t, i18n } = useTranslation();
  const { due, all } = useDueReminders();

  useEffect(() => {
    if (all) setAppBadge(due.length);
  }, [due.length, all]);

  useEffect(() => {
    let running = false;
    const check = async () => {
      if (running || document.visibilityState !== 'visible') return;
      running = true;
      try {
        const canNotify = notificationsSupported() && Notification.permission === 'granted';
        const reg = canNotify ? await activeRegistration() : undefined;
        await runReminderCheck(
          new Date(),
          reg
            ? async (items) => {
                for (const n of items) {
                  const { title, options } = notificationFor(n, t, i18n.language);
                  await reg.showNotification(title, options);
                }
              }
            : undefined,
        );
      } finally {
        running = false;
      }
    };
    void check();
    void registerPeriodicCheck();
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, [t, i18n.language]);
}
