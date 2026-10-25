import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { useToday } from '@/app/useToday';
import { PageHeader } from '@/components/PageHeader';
import { contactRepo, getBrief, useLiveQuery, useLiveRecord } from '@/db/repositories';
import { fullName } from '@/domain/contact';
import { formatMoney } from '@/domain/money';
import { formatPartialDate, formatRelativeDay } from '@/domain/partialDate';
import { isBriefEmpty } from '@/domain/recall';
import { parseIsoDate } from '@/domain/recurrence';
import { GiftPhoto } from '@/features/gifts/GiftsTab';
import { MomentCard } from '@/features/moments/MomentCard';

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`brief-${id}`} className="border-b border-border">
      <h3 id={`brief-${id}`} className="bg-surface-1 px-4 py-2 text-sm font-extrabold">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** "Before you meet" `/c/:id/brief`: one screen to read before seeing someone (features §8.11). */
export function BriefPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const today = useToday();
  const locale = i18n.language;
  const contact = useLiveRecord(contactRepo, id);
  const brief = useLiveQuery(
    async () => (contact ? await getBrief(contact, today) : undefined),
    [contact, today],
  );

  if (contact === undefined) return null;
  if (contact === null) {
    return (
      <>
        <PageHeader title={t('recall.briefTitle')} back />
        <p className="px-8 py-12 text-center text-muted">{t('profile.notFound')}</p>
      </>
    );
  }
  const name = fullName(contact);
  const fmtDay = (d: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(parseIsoDate(d));
  const met = contact.howWeMet;
  const hasMet = !!met && !!(met.text || met.date || met.place);

  return (
    <>
      <PageHeader title={t('recall.briefTitle')} subtitle={name} back />
      {contact.isDeceased && <p className="px-4 py-3 text-muted">{t('profile.deceased')}</p>}
      {brief && isBriefEmpty(brief, contact) && (
        <p className="px-8 py-12 text-center text-muted">{t('recall.briefEmpty', { name })}</p>
      )}
      {(hasMet || contact.bio || contact.foodPreferences) && (
        <Section id="about" title={t('recall.about')}>
          <div className="space-y-2 px-4 py-3">
            {hasMet && (
              <p>
                {[met?.text, met?.date && formatPartialDate(met.date, locale), met?.place]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
            {contact.bio && <p className="whitespace-pre-line">{contact.bio}</p>}
            {contact.foodPreferences && (
              <p>
                <span className="text-muted">{t('recall.food')}: </span>
                {contact.foodPreferences}
              </p>
            )}
          </div>
        </Section>
      )}
      {brief && brief.upcoming.length > 0 && (
        <Section id="upcoming" title={t('recall.upcoming')}>
          <ul className="px-4 py-3">
            {brief.upcoming.map((u) => (
              <li key={u.id}>
                {u.kind === 'birthday' ? t('recall.birthday') : u.label} ·{' '}
                {new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric' }).format(u.date)}{' '}
                · {formatRelativeDay(u.date, today, locale)}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {brief && brief.openTasks.length > 0 && (
        <Section id="tasks" title={t('recall.openTasks')}>
          <ul className="px-4 py-3">
            {brief.openTasks.map((task) => (
              <li key={task.id}>
                {task.title}
                {task.dueDate && <span className="text-muted"> · {fmtDay(task.dueDate)}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {brief && brief.unsettledDebts.length > 0 && (
        <Section id="money" title={t('recall.money')}>
          <ul className="px-4 py-3">
            {Object.entries(brief.balances).map(([currency, amount]) => (
              <li key={currency}>
                {amount > 0
                  ? t('recall.theyOwe', { amount: formatMoney(amount, currency, locale) })
                  : t('recall.youOwe', { amount: formatMoney(-amount, currency, locale) })}
              </li>
            ))}
            {Object.keys(brief.balances).length === 0 && <li>{t('recall.evenBalance')}</li>}
          </ul>
        </Section>
      )}
      {brief && (brief.giftIdeas.length > 0 || brief.giftsGiven.length > 0) && (
        <Section id="gifts" title={t('recall.gifts')}>
          <div className="space-y-3 px-4 py-3">
            {brief.giftIdeas.length > 0 && (
              <div>
                <h4 className="text-sm text-muted">{t('recall.giftIdeas')}</h4>
                <ul>
                  {brief.giftIdeas.map((g) => (
                    <li key={g.id}>{g.name}</li>
                  ))}
                </ul>
              </div>
            )}
            {brief.giftsGiven.length > 0 && (
              <div>
                <h4 className="text-sm text-muted">{t('recall.giftsGiven')}</h4>
                <ul>
                  {brief.giftsGiven.map((g) => (
                    <li key={g.id} className="flex items-center gap-2 py-1">
                      {g.photoBlobId && <GiftPhoto photoBlobId={g.photoBlobId} name={g.name} />}
                      <span>
                        {g.name}
                        {g.date && <span className="text-muted"> · {fmtDay(g.date)}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Section>
      )}
      {brief && brief.recentMoments.length > 0 && (
        <Section id="moments" title={t('recall.recentMoments')}>
          {brief.recentMoments.map((m) => (
            <MomentCard key={m.id} moment={m} />
          ))}
          <p className="px-4 py-3">
            <Link to={`/c/${contact.id}`} className="text-accent-text underline">
              {t('recall.seeTimeline')}
            </Link>
          </p>
        </Section>
      )}
    </>
  );
}
