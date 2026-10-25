import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { Button } from '@/components/Button';
import { PageHeader } from '@/components/PageHeader';
import {
  contactDetails,
  contactRepo,
  importantDatesFor,
  momentsForContact,
  relationshipsFor,
  useLiveQuery,
  useLiveRecord,
} from '@/db/repositories';
import { fullName } from '@/domain/contact';
import { bodyToPlainText } from '@/domain/momentText';
import { formatPartialDate } from '@/domain/partialDate';
import { useLookup } from '@/features/moments/useLookup';

const MOMENT_LIMIT = 10;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby={`print-${id}`}
      className="break-inside-avoid border-b border-border px-4 py-3"
    >
      <h2
        id={`print-${id}`}
        className="mb-1 text-sm font-extrabold uppercase tracking-wide text-muted"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * Print-friendly profile `/c/:id/print` (features §8.14): name, key facts, dates, relationships, notes and the
 * latest moments. "Print" opens the browser's print dialog, where "Save as PDF" makes a file.
 */
export function PrintPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const lookup = useLookup();
  const locale = i18n.language;
  const contact = useLiveRecord(contactRepo, id);
  const data = useLiveQuery(async () => {
    if (!id) return undefined;
    const [fields, addresses, dates, relationships, moments] = await Promise.all([
      contactDetails.fields(id),
      contactDetails.addresses(id),
      importantDatesFor(id),
      relationshipsFor(id),
      momentsForContact(id),
    ]);
    return {
      fields,
      addresses,
      dates,
      relationships,
      moments: [...moments]
        .sort((a, b) => b.happenedAt.localeCompare(a.happenedAt))
        .slice(0, MOMENT_LIMIT),
    };
  }, [id]);

  if (contact === undefined) return null;
  if (contact === null) {
    return (
      <>
        <PageHeader title={t('print.title')} back />
        <p className="px-8 py-12 text-center text-muted">{t('profile.notFound')}</p>
      </>
    );
  }
  const name = fullName(contact);
  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso));
  const met = contact.howWeMet;
  const metLine = [
    met?.text,
    met?.date && formatPartialDate(met.date, locale),
    met?.place,
    met?.introducedById && lookup.contact(met.introducedById)
      ? t('details.introducedBy', { name: fullName(lookup.contact(met.introducedById)!) })
      : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
  const work = [contact.jobTitle, contact.company].filter(Boolean).join(' · ');

  return (
    <>
      <div data-print="hide">
        <PageHeader
          title={t('print.title')}
          subtitle={name}
          back
          actions={
            <Button size="sm" onClick={() => window.print()}>
              <Printer size={16} aria-hidden /> {t('print.print')}
            </Button>
          }
        />
        <p className="border-b border-border px-4 py-2 text-sm text-muted">{t('print.hint')}</p>
      </div>

      <article aria-label={t('print.sheet', { name })} data-testid="print-sheet">
        <header className="border-b border-border px-4 py-4">
          <h1 className="text-2xl font-extrabold">{name}</h1>
          {contact.nickname && <p className="text-muted">@{contact.nickname}</p>}
          {contact.isDeceased && <p className="text-muted">{t('profile.deceased')}</p>}
          {work && <p>{work}</p>}
          {contact.bio && <p className="mt-2 whitespace-pre-line">{contact.bio}</p>}
        </header>

        {(contact.birthday || metLine) && (
          <Section id="about" title={t('print.about')}>
            {contact.birthday && (
              <p>
                {t('details.birthday')}: {formatPartialDate(contact.birthday, locale)}
              </p>
            )}
            {metLine && (
              <p>
                {t('details.howWeMet')}: {metLine}
              </p>
            )}
          </Section>
        )}

        {data && data.fields.length + data.addresses.length > 0 && (
          <Section id="contact" title={t('details.contact')}>
            <ul>
              {data.fields.map((f) => (
                <li key={f.id}>
                  <span className="text-muted">{t(`form.fieldTypes.${f.type}`)}: </span>
                  {f.value}
                </li>
              ))}
              {data.addresses.map((a) => (
                <li key={a.id}>
                  <span className="text-muted">{a.label ?? t('details.addresses')}: </span>
                  {[a.street, a.postalCode, a.city, a.region, a.country].filter(Boolean).join(', ')}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {data && data.dates.length > 0 && (
          <Section id="dates" title={t('print.dates')}>
            <ul>
              {data.dates.map((d) => (
                <li key={d.id}>
                  {d.label}: {formatPartialDate(d.date, locale)}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {data && data.relationships.length > 0 && (
          <Section id="relationships" title={t('relationships.title')}>
            <ul>
              {data.relationships.map((r) => {
                const other = lookup.contact(r.toContactId);
                return (
                  <li key={r.id}>
                    {other ? fullName(other) : '?'} · {t(`relationships.types.${r.type}`)}
                  </li>
                );
              })}
            </ul>
          </Section>
        )}

        {(contact.foodPreferences || contact.bio) && (
          <Section id="notes" title={t('print.notes')}>
            {contact.foodPreferences && (
              <p>
                {t('details.food')}: {contact.foodPreferences}
              </p>
            )}
          </Section>
        )}

        {data && data.moments.length > 0 && (
          <Section id="moments" title={t('print.moments', { count: data.moments.length })}>
            <ul className="space-y-2">
              {data.moments.map((m) => (
                <li key={m.id} className="break-inside-avoid">
                  <span className="text-muted">
                    {fmtDate(m.happenedAt)} · {t(`moment.kinds.${m.kind}`)}
                  </span>
                  <p className="whitespace-pre-line">
                    {bodyToPlainText(m.body, {
                      contact: (cid) => {
                        const c = lookup.contact(cid);
                        return c && fullName(c);
                      },
                      tag: (tid) => lookup.tag(tid)?.name,
                    })}
                  </p>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </article>
    </>
  );
}
