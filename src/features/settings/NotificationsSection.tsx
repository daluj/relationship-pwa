import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BellRing, CalendarPlus } from 'lucide-react';
import { Button } from '@/components/Button';
import { listReminders } from '@/db/repositories';
import { isOpen } from '@/domain/reminders';
import { useLookup } from '@/features/moments/useLookup';
import {
  activeRegistration,
  notificationsSupported,
  registerPeriodicCheck,
} from '@/features/reminders/notify';
import { exportIcs } from '@/features/reminders/reminderIcs';

type Status = NotificationPermission | 'unsupported';

/** Settings › Notifications — honest about what a server-less PWA can do (SPEC §8.5). */
export function NotificationsSection() {
  const { t } = useTranslation();
  const lookup = useLookup();
  const [status, setStatus] = useState<Status>(() =>
    notificationsSupported() ? Notification.permission : 'unsupported',
  );
  const [periodic, setPeriodic] = useState(false);

  useEffect(() => {
    void registerPeriodicCheck().then(setPeriodic);
  }, [status]);

  const enable = async () => setStatus(await Notification.requestPermission());
  const test = async () => {
    const reg = await activeRegistration(1000);
    const options = {
      body: t('notifications.testBody'),
      icon: '/icons/icon-192.png',
      tag: 'kin-test',
    };
    if (reg) await reg.showNotification(t('notifications.testTitle'), options);
    else new Notification(t('notifications.testTitle'), options);
  };
  const exportRecurring = async () => {
    const all = (await listReminders()).filter((r) => isOpen(r) && r.recurrence !== 'none');
    await exportIcs(all, lookup.contact, t);
  };

  return (
    <section className="border-b border-border px-4 py-4" aria-labelledby="notifications-title">
      <h2 id="notifications-title" className="mb-3 text-lg font-extrabold">
        {t('notifications.title')}
      </h2>
      <p className="mb-3 text-sm text-muted">{t('notifications.honesty')}</p>
      <p className="mb-3 flex items-center gap-2">
        <BellRing size={18} className="text-muted" aria-hidden />
        <span data-testid="notification-status">{t(`notifications.status.${status}`)}</span>
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        {status === 'default' && (
          <Button size="sm" onClick={() => void enable()}>
            {t('notifications.enable')}
          </Button>
        )}
        {status === 'granted' && (
          <Button size="sm" variant="outline" onClick={() => void test()}>
            {t('notifications.test')}
          </Button>
        )}
      </div>
      <p className="mb-3 text-sm text-muted">
        {periodic ? t('notifications.periodicOn') : t('notifications.periodicOff')}
      </p>
      <p className="mb-2 text-sm text-muted">{t('notifications.calendarHint')}</p>
      <Button size="sm" variant="outline" onClick={() => void exportRecurring()}>
        <CalendarPlus size={16} aria-hidden /> {t('reminders.actions.exportAll')}
      </Button>
    </section>
  );
}
