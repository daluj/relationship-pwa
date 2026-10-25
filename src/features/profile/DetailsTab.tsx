import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import {
  AtSign,
  Globe,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  Send,
  type LucideIcon,
} from 'lucide-react';
import { contactDetails, contactRepo, goalsFor, useLiveQuery } from '@/db/repositories';
import { fullName } from '@/domain/contact';
import { contactFieldHref } from '@/domain/contactFieldHref';
import { formatPartialDate } from '@/domain/partialDate';
import type { Address, Contact, ContactFieldType } from '@/domain/types';
import { ImportantDatesBlock } from '@/features/reminders/ImportantDatesBlock';
import { RelationshipsBlock } from '@/features/relationships/RelationshipsBlock';
import { PetsBlock } from './PetsBlock';
import { TagsGroupsBlocks } from './TagsGroupsBlocks';

const fieldIcons: Record<ContactFieldType, LucideIcon> = {
  phone: Phone,
  email: Mail,
  website: Globe,
  whatsapp: MessageCircle,
  telegram: Send,
  signal: MessageSquare,
  instagram: AtSign,
  linkedin: AtSign,
  x: AtSign,
  facebook: AtSign,
  other: AtSign,
};

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-border px-4 py-4">
      <h3 className="mb-2 font-extrabold">{title}</h3>
      {children}
    </section>
  );
}

const addressLines = (a: Address) =>
  [a.street, [a.postalCode, a.city].filter(Boolean).join(' '), a.region, a.country].filter(Boolean);

/** Profile › Details (ui §6.6). Relationships, pets, dates, tags and groups join in M3–M5. */
export function DetailsTab({ contact }: { contact: Contact }) {
  const { t, i18n } = useTranslation();
  const fields = useLiveQuery(() => contactDetails.fields(contact.id), [contact.id]);
  const goals = useLiveQuery(() => goalsFor(contact.id), [contact.id]);
  const addresses = useLiveQuery(() => contactDetails.addresses(contact.id), [contact.id]);
  const introducer = useLiveQuery(
    async () =>
      contact.howWeMet?.introducedById
        ? contactRepo.get(contact.howWeMet.introducedById)
        : undefined,
    [contact.howWeMet?.introducedById],
  );
  const { hash } = useLocation();
  const ready = !!fields && !!addresses;
  // Deep links like `/c/:id/details#relationships` (profile counts row).
  useEffect(() => {
    if (ready && hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [ready, hash]);
  if (!fields || !addresses) return null;

  const fmt = (pd: Parameters<typeof formatPartialDate>[0]) => formatPartialDate(pd, i18n.language);
  const met = contact.howWeMet;
  const work = [contact.jobTitle, contact.company].filter(Boolean);
  const identity = [contact.gender, contact.pronouns].filter(Boolean);
  const sortedFields = [...fields].sort((a, b) => Number(!!b.isPrimary) - Number(!!a.isPrimary));

  const blocks = [
    sortedFields.length > 0 && (
      <Block key="contact" title={t('details.contact')}>
        <ul className="flex flex-col gap-2">
          {sortedFields.map((f) => {
            const Icon = fieldIcons[f.type];
            const href = contactFieldHref(f);
            const external = href?.startsWith('http');
            return (
              <li key={f.id} className="flex items-center gap-3">
                <Icon size={18} className="shrink-0 text-muted" aria-hidden />
                <div className="min-w-0">
                  {href ? (
                    <a
                      href={href}
                      className="break-all text-accent-text hover:underline"
                      {...(external && { target: '_blank', rel: 'noopener noreferrer' })}
                    >
                      {f.value}
                    </a>
                  ) : (
                    <span className="break-all">{f.value}</span>
                  )}
                  <p className="text-xs text-muted">
                    {[t(`form.fieldTypes.${f.type}`), f.label, f.isPrimary && t('form.primary')]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </Block>
    ),
    addresses.length > 0 && (
      <Block key="addresses" title={t('details.addresses')}>
        <ul className="flex flex-col gap-3">
          {addresses.map((a) => (
            <li key={a.id}>
              <p className="text-xs text-muted">
                {[a.label, a.isCurrent && t('details.current')].filter(Boolean).join(' · ')}
              </p>
              <address className="not-italic">
                {addressLines(a).map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
            </li>
          ))}
        </ul>
      </Block>
    ),
    contact.birthday && (
      <Block key="birthday" title={t('details.birthday')}>
        <p>{fmt(contact.birthday)}</p>
      </Block>
    ),
    met && (
      <Block key="met" title={t('details.howWeMet')}>
        {met.text && <p className="whitespace-pre-line">{met.text}</p>}
        <p className="text-muted">
          {[met.date && fmt(met.date), met.place].filter(Boolean).join(' · ')}
        </p>
        {introducer && (
          <p className="text-muted">
            <Link to={`/c/${introducer.id}`} className="text-accent-text hover:underline">
              {t('details.introducedBy', { name: fullName(introducer) })}
            </Link>
          </p>
        )}
      </Block>
    ),
    work.length > 0 && (
      <Block key="work" title={t('details.work')}>
        <p>
          {contact.jobTitle && contact.company
            ? t('details.atCompany', { job: contact.jobTitle, company: contact.company })
            : work[0]}
        </p>
      </Block>
    ),
    contact.foodPreferences && (
      <Block key="food" title={t('details.food')}>
        <p className="whitespace-pre-line">{contact.foodPreferences}</p>
      </Block>
    ),
    identity.length > 0 && (
      <Block key="identity" title={t('details.identity')}>
        <p>{identity.join(' · ')}</p>
      </Block>
    ),
    contact.stayInTouchDays && (
      <Block key="stay" title={t('details.stayInTouch')}>
        <p>
          {t(
            `form.stayInTouchOptions.${contact.stayInTouchDays}` as 'form.stayInTouchOptions.none',
            {
              defaultValue: String(contact.stayInTouchDays),
            },
          )}
        </p>
      </Block>
    ),
  ].filter(Boolean);

  return (
    <div>
      {blocks}
      <RelationshipsBlock contact={contact} />
      <ImportantDatesBlock contactId={contact.id} />
      <PetsBlock contactId={contact.id} />
      {!!goals?.length && (
        <Block title={t('goals.title')}>
          <ul className="flex flex-col gap-1">
            {goals.map((g) => (
              <li key={g.id}>
                <Link to={`/goals/${g.id}`} className="text-accent-text hover:underline">
                  {g.title}
                </Link>
              </li>
            ))}
          </ul>
        </Block>
      )}
      <TagsGroupsBlocks contact={contact} />
      {blocks.length === 0 && (
        <div className="px-8 py-12 text-center">
          <p className="text-muted">{t('details.empty')}</p>
          <Link
            to={`/c/${contact.id}/edit`}
            className="mt-4 inline-block font-bold text-accent-text hover:underline"
          >
            {t('details.addDetails')}
          </Link>
        </div>
      )}
    </div>
  );
}
