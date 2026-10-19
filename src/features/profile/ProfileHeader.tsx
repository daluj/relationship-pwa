import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import {
  Archive,
  ArchiveRestore,
  Cake,
  Ellipsis,
  Feather,
  Flower2,
  Handshake,
  MapPin,
  MessageCircle,
  Sparkles,
  Users,
  Star,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { useComposer } from '@/app/stores/composer';
import { useToasts } from '@/app/stores/toast';
import { Avatar } from '@/components/Avatar';
import { buttonClass } from '@/components/buttonClass';
import { Menu } from '@/components/Menu';
import {
  contactDetails,
  momentsForContact,
  listGroups,
  relationshipsFor,
  contactRepo,
  deleteContact,
  restoreContact,
  updateContactStatus,
  useBlobUrl,
  useLiveQuery,
} from '@/db/repositories';
import { avatarColors, fullName } from '@/domain/contact';
import { countByGroup, relationshipGroups } from '@/domain/relationships';
import { ageOn, formatPartialDate, formatRelativeDay, nextOccurrence } from '@/domain/partialDate';
import type { Contact, PartialDate } from '@/domain/types';

function MetaItem({ icon: Icon, children }: { icon: LucideIcon; children: string }) {
  return (
    <li className="flex items-center gap-1">
      <Icon size={18} aria-hidden />
      <span>{children}</span>
    </li>
  );
}

/** Banner, avatar, actions, name and meta row (SPEC §6.6). */
export function ProfileHeader({ contact }: { contact: Contact }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const showToast = useToasts((s) => s.show);
  const openComposer = useComposer((s) => s.openComposer);
  const bannerUrl = useBlobUrl(contact.bannerBlobId);
  const addresses = useLiveQuery(() => contactDetails.addresses(contact.id), [contact.id]);
  const introducer = useLiveQuery(
    async () =>
      contact.howWeMet?.introducedById
        ? contactRepo.get(contact.howWeMet.introducedById)
        : undefined,
    [contact.howWeMet?.introducedById],
  );
  const lifeEvent = useLiveQuery(
    async () =>
      (await momentsForContact(contact.id))
        .filter((m) => m.kind === 'life-event')
        .sort((a, b) => b.happenedAt.localeCompare(a.happenedAt))[0],
    [contact.id],
  );
  const relationships = useLiveQuery(() => relationshipsFor(contact.id), [contact.id]);
  const groups = useLiveQuery(listGroups, []);
  const relCounts = countByGroup((relationships ?? []).map((r) => r.type));
  const groupNames = (groups ?? [])
    .filter((g) => contact.groupIds.includes(g.id))
    .map((g) => g.name);
  const name = fullName(contact);
  const locale = i18n.language;
  const today = new Date();
  const fmt = (pd: PartialDate) => formatPartialDate(pd, locale);

  const current = addresses?.find((a) => a.isCurrent) ?? addresses?.[0];
  const place = current && [current.city, current.country].filter(Boolean).join(', ');

  let birthday: string | undefined;
  if (contact.birthday) {
    const next = nextOccurrence(contact.birthday, today);
    const relative = formatRelativeDay(next, today, locale);
    const age = ageOn(contact.birthday, next);
    if (contact.isDeceased) birthday = t('profile.born', { date: fmt(contact.birthday) });
    else if (age !== undefined)
      birthday = `${t('profile.born', { date: fmt(contact.birthday) })} · ${t('profile.turns', { age, relative })}`;
    else birthday = `${t('profile.birthday', { date: fmt(contact.birthday) })} · ${relative}`;
  }

  const met = contact.howWeMet;
  const metWhen = met?.date ? (met.date.year ? String(met.date.year) : fmt(met.date)) : undefined;
  const metText = [
    metWhen && t('profile.met', { when: metWhen }),
    met?.place,
    introducer && t('details.introducedBy', { name: fullName(introducer) }),
  ]
    .filter(Boolean)
    .join(' · ');

  const toggleArchive = async () => {
    await updateContactStatus(contact.id, { isArchived: !contact.isArchived });
    showToast({
      message: contact.isArchived
        ? t('profile.unarchived', { name })
        : t('profile.archived', { name }),
    });
  };

  const remove = async () => {
    await deleteContact(contact.id);
    navigate('/contacts', { replace: true });
    showToast({
      message: t('profile.deleted', { name }),
      action: { label: t('common.undo'), onClick: () => void restoreContact(contact.id) },
    });
  };

  return (
    <div>
      <div
        className="aspect-[3/1] w-full bg-cover bg-center"
        style={
          bannerUrl
            ? { backgroundImage: `url("${bannerUrl}")` }
            : {
                backgroundColor: contact.bannerColor ?? avatarColors(contact.id).bg,
                opacity: contact.bannerColor ? 1 : 0.55,
              }
        }
        role={bannerUrl ? 'img' : undefined}
        aria-label={bannerUrl ? t('profile.banner', { name }) : undefined}
      />
      <div className="px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="-mt-[12%] flex rounded-full border-4 border-bg bg-bg md:-mt-[67px]">
            <div className="hidden md:block">
              <Avatar contact={contact} size={134} />
            </div>
            <div className="md:hidden">
              <Avatar contact={contact} size={80} />
            </div>
          </div>
          <div className="mt-3 flex min-w-0 flex-wrap items-center justify-end gap-2">
            <Menu
              label={t('common.more')}
              triggerClassName="rounded-full border border-border p-2 hover:bg-surface-2"
              trigger={<Ellipsis size={18} aria-hidden />}
              items={[
                {
                  label: contact.isStarred ? t('profile.menu.unstar') : t('profile.menu.star'),
                  icon: Star,
                  onSelect: () =>
                    void contactRepo.update(contact.id, { isStarred: !contact.isStarred }),
                },
                {
                  label: contact.isArchived
                    ? t('profile.menu.unarchive')
                    : t('profile.menu.archive'),
                  icon: contact.isArchived ? ArchiveRestore : Archive,
                  onSelect: () => void toggleArchive(),
                },
                {
                  label: contact.isDeceased
                    ? t('profile.menu.unmarkDeceased')
                    : t('profile.menu.markDeceased'),
                  icon: Flower2,
                  onSelect: () =>
                    void updateContactStatus(contact.id, {
                      isDeceased: contact.isDeceased ? undefined : true,
                      ...(contact.isDeceased && { deceasedDate: undefined }),
                    }),
                },
                {
                  label: t('profile.menu.delete'),
                  icon: Trash2,
                  onSelect: () => void remove(),
                  danger: true,
                },
              ]}
            />
            <button
              type="button"
              onClick={() => openComposer({ prefill: { contactIds: [contact.id] } })}
              aria-label={t('profile.logMoment')}
              className={`${buttonClass('outline', 'sm')} max-md:w-8 max-md:px-0`}
            >
              <Feather size={16} className="md:hidden" aria-hidden />
              <span className="hidden md:inline">{t('profile.logMoment')}</span>
            </button>
            <Link to={`/c/${contact.id}/edit`} className={buttonClass('outline', 'sm')}>
              {t('profile.editProfile')}
            </Link>
          </div>
        </div>

        <div className="mt-3">
          <h2 className="flex items-center gap-2 text-xl font-extrabold">
            {name}
            {contact.isStarred && (
              <Star
                size={18}
                className="text-accent"
                fill="currentColor"
                aria-label={t('contacts.filter.starred')}
              />
            )}
          </h2>
          {contact.nickname && <p className="text-muted">@{contact.nickname}</p>}
        </div>
        {contact.bio && <p className="mt-3 whitespace-pre-line">{contact.bio}</p>}

        <ul className="mt-3 mb-4 flex flex-wrap gap-x-4 gap-y-1 text-muted">
          {contact.isDeceased && (
            <MetaItem icon={Flower2}>
              {contact.deceasedDate
                ? t('profile.deceasedOn', { date: fmt(contact.deceasedDate) })
                : t('profile.deceased')}
            </MetaItem>
          )}
          {groupNames.length > 0 && <MetaItem icon={Users}>{groupNames.join(' · ')}</MetaItem>}
          {place && <MetaItem icon={MapPin}>{place}</MetaItem>}
          {lifeEvent && (
            <MetaItem icon={Sparkles}>
              {t('moment.lifeEventMeta', {
                event: [
                  lifeEvent.lifeEventType
                    ? t(`moment.lifeEventTypes.${lifeEvent.lifeEventType}`)
                    : t('moment.kinds.life-event'),
                  lifeEvent.location,
                ]
                  .filter(Boolean)
                  .join(' · '),
                date: new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(
                  new Date(lifeEvent.happenedAt),
                ),
              })}
            </MetaItem>
          )}
          {birthday && <MetaItem icon={Cake}>{birthday}</MetaItem>}
          {metText && <MetaItem icon={Handshake}>{metText}</MetaItem>}
          {contact.lastInteractionAt && (
            <MetaItem icon={MessageCircle}>
              {t('profile.lastSpoke', {
                relative: formatRelativeDay(new Date(contact.lastInteractionAt), today, locale),
              })}
            </MetaItem>
          )}
          {contact.isArchived && <MetaItem icon={Archive}>{t('contacts.archivedBadge')}</MetaItem>}
        </ul>
        {relationships && relationships.length > 0 && (
          <Link
            to={`/c/${contact.id}/details#relationships`}
            className="mb-4 flex flex-wrap gap-x-4 text-sm hover:underline"
            data-testid="relationship-counts"
          >
            {relationshipGroups
              .filter((g) => relCounts[g])
              .map((g) => (
                <span key={g}>
                  <strong className="text-text">{relCounts[g]}</strong>{' '}
                  <span className="text-muted">
                    {t(`relationships.counts.${g}` as 'relationships.counts.family', {
                      count: relCounts[g],
                    })}
                  </span>
                </span>
              ))}
          </Link>
        )}
      </div>
    </div>
  );
}
