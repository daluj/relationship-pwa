import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  AlarmClock,
  Bell,
  CalendarPlus,
  Check,
  Ellipsis,
  Feather,
  Pencil,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useComposer } from '@/app/stores/composer';
import { useToasts } from '@/app/stores/toast';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Menu, type MenuItem } from '@/components/Menu';
import {
  completeReminder,
  deleteReminder,
  reopenReminder,
  restoreReminder,
  snoozeReminder,
} from '@/db/repositories';
import { formatRelativeDay, toIsoDate } from '@/domain/partialDate';
import { addDays, parseIsoDate } from '@/domain/recurrence';
import { effectiveDate } from '@/domain/reminders';
import type { Reminder } from '@/domain/types';
import { useLookup } from '@/features/moments/useLookup';
import { exportIcs } from './reminderIcs';
import { repeatLabel, reminderTitle } from './reminderText';
import { SnoozeDialog } from './SnoozeDialog';

interface Props {
  reminder: Reminder;
  today: Date;
  onEdit: (r: Reminder) => void;
}

/** One reminder with Done / Snooze / Edit (ui §6.7). */
export function ReminderRow({ reminder: r, today, onEdit }: Props) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const lookup = useLookup();
  const showToast = useToasts((s) => s.show);
  const openComposer = useComposer((s) => s.openComposer);
  const [picking, setPicking] = useState(false);

  const contact = r.contactId ? lookup.contact(r.contactId) : undefined;
  const title = reminderTitle(r, contact, t);
  const locale = i18n.language;
  // Include the year when it isn't this year, so "Next: Tue, Oct 19" can't be mistaken for today.
  const fmtDate = (iso: string) => {
    const d = parseIsoDate(iso);
    return new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      ...(d.getFullYear() !== today.getFullYear() && { year: 'numeric' }),
    }).format(d);
  };
  const due = effectiveDate(r);
  const overdue = !r.completedAt && due < toIsoDate(today);

  const meta = [
    r.completedAt
      ? fmtDate(r.completedAt.slice(0, 10))
      : `${formatRelativeDay(parseIsoDate(due), today, locale)} · ${fmtDate(due)}`,
    r.dueTime,
    r.recurrence !== 'none' && repeatLabel(r, t),
    // The date above is already the snoozed one. Stay-in-touch "Done" also postpones via snooze,
    // but that's a check-in, not a snooze, so it isn't labelled.
    r.snoozedUntil && !r.completedAt && r.source !== 'stay-in-touch' && t('reminders.snoozed'),
    r.source !== 'manual' && t('reminders.auto'),
  ]
    .filter(Boolean)
    .join(' · ');

  const done = async () => {
    const after = await completeReminder(r.id);
    if (after.completedAt) showToast({ message: t('reminders.toast.done') });
    else if (after.source === 'stay-in-touch')
      showToast({
        message: t('reminders.toast.checkedIn', { date: fmtDate(effectiveDate(after)) }),
      });
    else showToast({ message: t('reminders.toast.next', { date: fmtDate(after.dueDate) }) });
  };
  const snooze = async (until: string) => {
    await snoozeReminder(r.id, until);
    setPicking(false);
    showToast({ message: t('reminders.toast.snoozed', { date: fmtDate(until) }) });
  };
  const edit = () => {
    if (r.source === 'manual') onEdit(r);
    else if (r.source === 'goal' && r.sourceId) navigate(`/goals/${r.sourceId.split(':')[0]}`);
    else if (r.contactId)
      navigate(
        r.source === 'important-date' ? `/c/${r.contactId}/details` : `/c/${r.contactId}/edit`,
      );
  };

  const menu: MenuItem[] = [
    { label: t('reminders.actions.edit'), icon: Pencil, onSelect: edit },
    {
      label: t('reminders.actions.ics'),
      icon: CalendarPlus,
      onSelect: () =>
        void exportIcs(
          [r],
          lookup.contact,
          t,
          `${title.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'reminder'}.ics`,
        ),
    },
    ...(r.completedAt
      ? [
          {
            label: t('reminders.actions.reopen'),
            icon: RotateCcw,
            onSelect: () => void reopenReminder(r.id),
          },
        ]
      : []),
    ...(r.source === 'manual'
      ? [
          {
            label: t('reminders.actions.delete'),
            icon: Trash2,
            danger: true,
            onSelect: () =>
              void deleteReminder(r.id).then(() =>
                showToast({
                  message: t('reminders.toast.deleted'),
                  action: { label: t('common.undo'), onClick: () => void restoreReminder(r.id) },
                }),
              ),
          },
        ]
      : []),
  ];

  return (
    <li
      className="flex items-start gap-3 border-b border-border px-4 py-3"
      data-testid="reminder-row"
    >
      {contact ? (
        <Avatar contact={contact} size={40} />
      ) : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent-text">
          <Bell size={18} aria-hidden />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className={`font-bold ${r.completedAt ? 'text-muted line-through' : ''}`}>{title}</p>
        <p className={`text-sm ${overdue ? 'text-danger' : 'text-muted'}`}>{meta}</p>
        {r.notes && <p className="mt-1 line-clamp-2 text-sm whitespace-pre-line">{r.notes}</p>}
        {!r.completedAt && (
          <div className="mt-2 flex flex-wrap gap-2">
            {r.source === 'stay-in-touch' && contact && (
              <Button
                size="sm"
                onClick={() => openComposer({ prefill: { contactIds: [contact.id] } })}
              >
                <Feather size={14} aria-hidden /> {t('reminders.actions.log')}
              </Button>
            )}
            <Button
              size="sm"
              variant={r.source === 'stay-in-touch' ? 'outline' : 'primary'}
              onClick={() => void done()}
            >
              <Check size={14} aria-hidden /> {t('reminders.actions.done')}
            </Button>
            <Menu
              label={t('reminders.actions.snooze')}
              align="left"
              triggerClassName="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-bold hover:bg-surface-2"
              trigger={
                <>
                  <AlarmClock size={14} aria-hidden /> {t('reminders.actions.snooze')}
                </>
              }
              items={[
                {
                  label: t('reminders.actions.tomorrow'),
                  onSelect: () => void snooze(addDays(toIsoDate(today), 1)),
                },
                {
                  label: t('reminders.actions.nextWeek'),
                  onSelect: () => void snooze(addDays(toIsoDate(today), 7)),
                },
                { label: t('reminders.actions.pickDate'), onSelect: () => setPicking(true) },
              ]}
            />
          </div>
        )}
      </div>
      <Menu
        label={t('reminders.actions.more')}
        triggerClassName="rounded-full p-1.5 text-muted hover:bg-surface-2"
        trigger={<Ellipsis size={18} aria-hidden />}
        items={menu}
      />
      <SnoozeDialog
        open={picking}
        onClose={() => setPicking(false)}
        onSnooze={(d) => void snooze(d)}
      />
    </li>
  );
}
