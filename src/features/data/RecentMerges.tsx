import { useTranslation } from 'react-i18next';
import { Undo2 } from 'lucide-react';
import { useToasts } from '@/app/stores/toast';
import { Button } from '@/components/Button';
import { listMergeHistory, useLiveQuery } from '@/db/repositories';
import { undoMergeWithMessage } from './undoMerge';

/** Settings › Your data: merges that can still be undone (features §8.14). */
export function RecentMerges({ className }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const show = useToasts((s) => s.show);
  const merges = useLiveQuery(() => listMergeHistory(), []);
  if (!merges?.length) return null;
  return (
    <section className={className} aria-labelledby="merges-title">
      <h2 id="merges-title" className="mb-1 text-lg font-extrabold">
        {t('merge.recent')}
      </h2>
      <p className="mb-3 text-sm text-muted">{t('merge.recentIntro')}</p>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {merges.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate font-bold">
                {t('merge.recentRow', { into: m.primaryName, from: m.secondaryName })}
              </p>
              <p className="text-sm text-muted">
                {new Intl.DateTimeFormat(i18n.language, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(m.mergedAt))}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void undoMergeWithMessage(m.id, t, show)}
            >
              <Undo2 size={16} aria-hidden />
              {t('merge.undo')}
              <span className="sr-only">
                {' '}
                {t('merge.recentRow', { into: m.primaryName, from: m.secondaryName })}
              </span>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
