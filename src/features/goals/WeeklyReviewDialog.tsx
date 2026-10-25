import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useToasts } from '@/app/stores/toast';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import { ProgressBar } from '@/components/ProgressBar';
import { TextField } from '@/components/form/TextField';
import { saveWeeklyReview } from '@/db/repositories';
import { compareGoals, weekOf } from '@/domain/goals';
import type { Goal, GoalReview } from '@/domain/types';

interface Props {
  open: boolean;
  onClose: () => void;
  goals: Goal[];
  progress: Map<string, number>;
  reviews: GoalReview[];
  today: Date;
}

/** Weekly review (AC-7): look at each active goal, write an optional note, save one review per week. */
export function WeeklyReviewDialog({ open, onClose, goals, progress, reviews, today }: Props) {
  const { t } = useTranslation();
  const showToast = useToasts((s) => s.show);
  const existing = reviews.find((r) => r.weekOf === weekOf(today));
  const [note, setNote] = useState('');
  useEffect(() => {
    if (open) setNote(existing?.note ?? '');
  }, [open, existing?.note]);

  const active = goals.filter((g) => g.status === 'active').sort(compareGoals);
  const save = async () => {
    await saveWeeklyReview(note, today);
    showToast({ message: t('goals.review.saved') });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('goals.review.title')}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void save()}>{t('goals.review.save')}</Button>
        </>
      }
    >
      <p className="mb-3 text-muted">{t('goals.review.intro')}</p>
      {active.length === 0 ? (
        <p className="mb-3">{t('goals.review.noGoals')}</p>
      ) : (
        <ul className="mb-4 flex flex-col gap-3">
          {active.map((g) => (
            <li key={g.id} className="rounded-xl border border-border p-3">
              <Link to={`/goals/${g.id}`} onClick={onClose} className="font-bold hover:underline">
                {g.title}
              </Link>
              {g.nextAction && (
                <p className="text-sm text-muted">
                  {t('goals.nextShort')} {g.nextAction}
                </p>
              )}
              {progress.has(g.id) && (
                <div className="mt-2 flex items-center gap-3">
                  <ProgressBar
                    percent={progress.get(g.id)!}
                    label={t('goals.progressLabel', { title: g.title })}
                  />
                  <span className="w-10 shrink-0 text-right text-xs text-muted">
                    {progress.get(g.id)}%
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <TextField
        multiline
        label={t('goals.review.note')}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
    </Dialog>
  );
}
