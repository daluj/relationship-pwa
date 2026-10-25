import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { Bell, X } from 'lucide-react';
import { announce } from '@/app/stores/announce';
import { toIsoDate } from '@/domain/partialDate';
import { useDueReminders } from './useDueReminders';

const KEY = 'kin.dueBannerDismissed';

/** In-app "N reminders due" banner, shown on open (features §8.5). Dismissal is per day and count. */
export function DueBanner() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { due, today } = useDueReminders();
  const stamp = `${toIsoDate(today)}:${due.length}`;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(KEY);
    } catch {
      return null;
    }
  });
  const visible = !!due.length && dismissed !== stamp && !pathname.startsWith('/reminders');
  // A banner that appears on load isn't reliably spoken, so say it through the shared live region.
  useEffect(() => {
    if (visible) announce(t('a11y.remindersDue', { count: due.length }));
  }, [visible, due.length, t]);
  if (!visible) return null;

  const dismiss = () => {
    setDismissed(stamp);
    try {
      sessionStorage.setItem(KEY, stamp);
    } catch {
      // Private mode — the banner simply comes back next time.
    }
  };

  return (
    <div
      data-print="hide"
      role="status"
      className="flex items-center gap-3 border-b border-border bg-accent-tint px-4 py-2.5 text-sm"
    >
      <Bell size={18} className="shrink-0 text-accent-text" aria-hidden />
      <p className="flex-1 font-bold">{t('reminders.due', { count: due.length })}</p>
      <Link to="/reminders" className="font-bold text-accent-text hover:underline">
        {t('reminders.view')}
      </Link>
      <button
        type="button"
        aria-label={t('reminders.dismiss')}
        onClick={dismiss}
        className="rounded-full p-1 hover:bg-surface-2"
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}
