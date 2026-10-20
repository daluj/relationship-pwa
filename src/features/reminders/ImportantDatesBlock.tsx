import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, CalendarHeart, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { deleteImportantDate, importantDatesFor, useLiveQuery } from '@/db/repositories';
import { formatPartialDate } from '@/domain/partialDate';
import type { ImportantDate } from '@/domain/types';
import { ImportantDateDialog } from './ImportantDateDialog';

/** Profile › Details › Important dates (ui §6.6). */
export function ImportantDatesBlock({ contactId }: { contactId: string }) {
  const { t, i18n } = useTranslation();
  const dates = useLiveQuery(() => importantDatesFor(contactId), [contactId]);
  const [editing, setEditing] = useState<ImportantDate | null | undefined>(undefined);

  return (
    <section className="border-b border-border px-4 py-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-extrabold">{t('importantDates.title')}</h3>
        <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
          <Plus size={16} aria-hidden /> {t('importantDates.add')}
        </Button>
      </div>
      {!!dates?.length && (
        <ul className="flex flex-col gap-2">
          {dates.map((d) => (
            <li key={d.id} className="flex items-center gap-3">
              <CalendarHeart size={18} className="shrink-0 text-muted" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-bold">{d.label}</p>
                <p className="flex items-center gap-1 text-sm text-muted">
                  {formatPartialDate(d.date, i18n.language)}
                  {d.remind && (
                    <>
                      {' · '}
                      <Bell size={12} aria-hidden />
                      {d.remindDaysBefore
                        ? t('importantDates.before', { count: d.remindDaysBefore })
                        : t('importantDates.onTheDay')}
                    </>
                  )}
                </p>
              </div>
              <IconButton label={`${t('common.edit')}: ${d.label}`} onClick={() => setEditing(d)}>
                <Pencil size={16} aria-hidden />
              </IconButton>
              <IconButton
                label={`${t('importantDates.delete')}: ${d.label}`}
                onClick={() => void deleteImportantDate(d.id)}
              >
                <Trash2 size={16} aria-hidden />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      <ImportantDateDialog
        open={editing !== undefined}
        date={editing ?? undefined}
        contactId={contactId}
        onClose={() => setEditing(undefined)}
      />
    </section>
  );
}
