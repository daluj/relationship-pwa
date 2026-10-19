import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import { inputClass } from '@/components/form/fieldClass';
import { setMomentDate } from '@/db/repositories';
import { toDateTimeLocal } from '@/domain/relativeTime';
import type { Moment } from '@/domain/types';

export function ChangeDateDialog({
  moment,
  onClose,
}: {
  moment: Moment | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const current = moment ? value || toDateTimeLocal(new Date(moment.happenedAt)) : '';
  return (
    <Dialog
      open={!!moment}
      onClose={onClose}
      title={t('moment.changeDateTitle')}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => {
              if (moment && current) void setMomentDate(moment.id, new Date(current).toISOString());
              setValue('');
              onClose();
            }}
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      <input
        type="datetime-local"
        aria-label={t('composer.date')}
        value={current}
        onChange={(e) => setValue(e.target.value)}
        className={inputClass}
      />
    </Dialog>
  );
}
