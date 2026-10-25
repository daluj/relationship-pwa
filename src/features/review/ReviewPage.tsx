import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { SelectField } from '@/components/form/SelectField';
import { getYearReview, reviewYears, useLiveQuery } from '@/db/repositories';
import { momentKinds } from '@/domain/schemas';

function Group({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`review-${id}`} className="border-b border-border">
      <h3 id={`review-${id}`} className="bg-surface-1 px-4 py-2 text-sm font-extrabold">
        {title}
      </h3>
      <dl className="px-4 py-2">{children}</dl>
    </section>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  const { i18n } = useTranslation();
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt>{label}</dt>
      <dd className="font-bold tabular-nums">
        {new Intl.NumberFormat(i18n.language).format(value)}
      </dd>
    </div>
  );
}

/** Year in review `/review/:year`: plain counts in a fixed order, never ranked (features §8.13). */
export function ReviewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams();
  const year = Number(params.year);
  const valid = Number.isInteger(year) && year >= 1900 && year <= 9999;
  const review = useLiveQuery(() => (valid ? getYearReview(year) : undefined), [year, valid]);
  const years = useLiveQuery(reviewYears, []);

  if (!valid) return <Navigate to={`/review/${new Date().getFullYear()}`} replace />;
  const options = [...new Set([...(years ?? []), year])].sort((a, b) => b - a);
  const empty =
    !!review &&
    review.momentTotal === 0 &&
    review.newContacts === 0 &&
    review.giftsGiven === 0 &&
    review.debtsSettled === 0;

  return (
    <>
      <PageHeader title={t('review.title')} subtitle={String(year)} back />
      <div className="border-b border-border px-4 py-3">
        <SelectField
          label={t('review.year')}
          value={String(year)}
          onChange={(e) => navigate(`/review/${e.target.value}`, { replace: true })}
          options={options.map((y) => ({ value: String(y), label: String(y) }))}
          className="w-40"
        />
      </div>
      {empty && <p className="px-8 py-12 text-center text-muted">{t('review.empty', { year })}</p>}
      {review && !empty && (
        <>
          <Group id="moments" title={t('review.moments', { count: review.momentTotal })}>
            {momentKinds.map((k) => (
              <Row key={k} label={t(`moment.kinds.${k}`)} value={review.momentsByKind[k]} />
            ))}
          </Group>
          <Group id="people" title={t('review.people')}>
            <Row label={t('review.peopleMentioned')} value={review.peopleMentioned} />
            <Row label={t('review.newContacts')} value={review.newContacts} />
          </Group>
          <Group id="other" title={t('review.other')}>
            <Row label={t('review.giftsGiven')} value={review.giftsGiven} />
            <Row label={t('review.debtsSettled')} value={review.debtsSettled} />
            <Row label={t('review.tagsUsed')} value={review.tagsUsed} />
          </Group>
        </>
      )}
    </>
  );
}
