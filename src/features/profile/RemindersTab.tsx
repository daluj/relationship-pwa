import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { useToday } from '@/app/useToday';
import { Button } from '@/components/Button';
import { remindersFor, useLiveQuery } from '@/db/repositories';
import { compareReminders, isOpen } from '@/domain/reminders';
import type { Contact, Reminder } from '@/domain/types';
import { ReminderDialog } from '@/features/reminders/ReminderDialog';
import { ReminderRow } from '@/features/reminders/ReminderRow';

/** Profile › Reminders: upcoming + completed for this contact; add (ui §6.6). */
export function RemindersTab({ contact }: { contact: Contact }) {
  const { t } = useTranslation();
  const today = useToday();
  const all = useLiveQuery(() => remindersFor(contact.id), [contact.id]);
  const [editing, setEditing] = useState<Reminder | null | undefined>(undefined);
  if (!all) return null;
  const open = all.filter(isOpen).sort(compareReminders);
  const done = all
    .filter((r) => r.completedAt)
    .sort((a, b) => b.completedAt!.localeCompare(a.completedAt!));
  const row = (r: Reminder) => (
    <ReminderRow key={r.id} reminder={r} today={today} onEdit={setEditing} />
  );

  return (
    <div>
      <div className="flex justify-end px-4 py-3">
        <Button size="sm" onClick={() => setEditing(null)}>
          <Plus size={16} aria-hidden /> {t('reminders.new')}
        </Button>
      </div>
      {open.length === 0 && done.length === 0 && (
        <p className="px-8 pb-12 text-center text-muted">{t('reminders.empty.upcoming')}</p>
      )}
      {open.length > 0 && <ul>{open.map(row)}</ul>}
      {done.length > 0 && (
        <section aria-labelledby="done-reminders">
          <h3 id="done-reminders" className="bg-surface-1 px-4 py-2 text-sm font-extrabold">
            {t('reminders.tabs.done')}
          </h3>
          <ul>{done.map(row)}</ul>
        </section>
      )}
      <ReminderDialog
        open={editing !== undefined}
        reminder={editing ?? undefined}
        contactId={contact.id}
        onClose={() => setEditing(undefined)}
      />
    </div>
  );
}
