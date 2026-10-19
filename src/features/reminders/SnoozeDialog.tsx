import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import { inputClass } from '@/components/form/fieldClass';
import { addDays } from '@/domain/recurrence';
import { toIsoDate } from '@/domain/partialDate';

/** "Pick a date…" for snooze (SPEC §6.7 Snooze custom). */
export function SnoozeDialog({
  open,
  onClose,
  onSnooze,
}: {
  open: boolean;
  onClose: () => void;
  onSnooze: (date: string) => void;
}) {
  const { t } = useTranslation();
  const tomorrow = addDays(toIsoDate(new Date()), 1);
  const [date, setDate] = useState(tomorrow);
  useEffect(() => {
    if (open) setDate(tomorrow);
  }, [open, tomorrow]);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('reminders.snoozeTitle')}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button disabled={!date} onClick={() => onSnooze(date)}>
            {t('reminders.actions.snooze')}
          </Button>
        </>
      }
    >
      <input
        type="date"
        aria-label={t('reminders.snoozeTitle')}
        min={tomorrow}
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className={inputClass}
      />
    </Dialog>
  );
}
