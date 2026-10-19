import type { TFunction } from 'i18next';
import type { DueNotification } from '@/db/repositories/reminderCheck';
import { parseIsoDate } from '@/domain/recurrence';
import { effectiveDate } from '@/domain/reminders';
import { reminderTitle } from './reminderText';

/** Notification payload for a due reminder — used by the page and the service worker. */
export function notificationFor(n: DueNotification, t: TFunction, locale: string) {
  const date = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(
    parseIsoDate(effectiveDate(n.reminder)),
  );
  return {
    title: reminderTitle(n.reminder, n.contact, t),
    options: {
      body: n.overdue ? t('reminders.notifOverdue', { date }) : t('reminders.notifToday'),
      tag: `reminder-${n.reminder.id}`,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: n.url },
    } satisfies NotificationOptions,
  };
}

export const notificationsSupported = () =>
  typeof Notification !== 'undefined' && 'serviceWorker' in navigator;

/** Sets the OS app badge where supported (SPEC §8.5). */
export function setAppBadge(count: number): void {
  const nav = navigator as Navigator & {
    setAppBadge?: (n?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  try {
    if (count > 0) void nav.setAppBadge?.(count).catch(() => {});
    else void nav.clearAppBadge?.().catch(() => {});
  } catch {
    // Unsupported — ignore.
  }
}

/** Registers Periodic Background Sync (installed Chromium only); never relied on (SPEC §8.5). */
export async function registerPeriodicCheck(): Promise<boolean> {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const periodic = (
      reg as ServiceWorkerRegistration & {
        periodicSync?: { register: (tag: string, o: { minInterval: number }) => Promise<void> };
      }
    )?.periodicSync;
    if (!reg || !periodic) return false;
    const status = await navigator.permissions.query({
      name: 'periodic-background-sync' as PermissionName,
    });
    if (status.state !== 'granted') return false;
    await periodic.register('check-reminders', { minInterval: 12 * 60 * 60 * 1000 });
    return true;
  } catch {
    return false;
  }
}
