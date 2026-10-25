import { useTranslation } from 'react-i18next';
import { useToday } from '@/app/useToday';
import { getOnThisDay, useLiveQuery } from '@/db/repositories';
import { MomentCard } from '@/features/moments/MomentCard';

/** Home panel: moments from earlier years on this month and day (features §8.11). */
export function OnThisDay() {
  const { t } = useTranslation();
  const today = useToday();
  const groups = useLiveQuery(() => getOnThisDay(today), [today]);
  if (!groups || groups.length === 0) return null;
  return (
    <section aria-labelledby="on-this-day" className="border-b border-border">
      <h2 id="on-this-day" className="bg-surface-1 px-4 py-2 text-sm font-extrabold">
        {t('recall.onThisDay')}
      </h2>
      {groups.map((g) => (
        <div key={g.year}>
          <h3 className="px-4 pt-3 text-sm text-muted">
            {t('recall.yearsAgo', { count: g.yearsAgo, year: g.year })}
          </h3>
          {g.moments.map((m) => (
            <MomentCard key={m.id} moment={m} />
          ))}
        </div>
      ))}
    </section>
  );
}
