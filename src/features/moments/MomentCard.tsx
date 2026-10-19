import { useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarCog, Copy, Ellipsis, Pencil, Pin, Star, Trash2 } from 'lucide-react';
import { useComposer } from '@/app/stores/composer';
import { useToasts } from '@/app/stores/toast';
import { Avatar } from '@/components/Avatar';
import { IconButton } from '@/components/IconButton';
import { Menu } from '@/components/Menu';
import { deleteMoment, restoreMoment, setMomentPinned, setMomentStarred } from '@/db/repositories';
import { fullName } from '@/domain/contact';
import { bodyToPlainText } from '@/domain/momentText';
import { fullDateTime, shortRelative } from '@/domain/relativeTime';
import type { Contact, Moment } from '@/domain/types';
import { ChangeDateDialog } from './ChangeDateDialog';
import { kindIcon } from './kindMeta';
import { useLookup } from './useLookup';
import { MomentBody } from './MomentBody';
import { PhotoGrid } from './PhotoGrid';

interface Props {
  moment: Moment;
  /** Detail view: larger text, full-size photos, not clickable. */
  detail?: boolean;
  /** Show the "Pinned" label (profile timelines). */
  showPinned?: boolean;
}

/** The "post" (SPEC §6.4). */
export function MomentCard({ moment: m, detail, showPinned }: Props) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const lookup = useLookup();
  const showToast = useToasts((s) => s.show);
  const openComposer = useComposer((s) => s.openComposer);
  const [changingDate, setChangingDate] = useState(false);

  const people = m.contactIds.map((id) => lookup.contact(id)).filter((c): c is Contact => !!c);
  const primary = people[0];
  const others = people.slice(1);
  const date = new Date(m.happenedAt);
  const KindIcon = kindIcon(m);
  const locale = i18n.language;

  const kindLine = [
    m.kind === 'activity' && m.activityType
      ? t(`moment.activityTypes.${m.activityType}`)
      : t(`moment.kinds.${m.kind}`),
    m.kind === 'call' && m.callDirection && t(`moment.callDirections.${m.callDirection}`),
    m.kind === 'call' &&
      m.callDurationMin !== undefined &&
      t('moment.minutes', { count: m.callDurationMin }),
    m.kind === 'life-event' && m.lifeEventType && t(`moment.lifeEventTypes.${m.lifeEventType}`),
    m.kind === 'journal' && m.mood && t('moment.moodLabel', { mood: t(`moment.moods.${m.mood}`) }),
    m.location,
  ]
    .filter(Boolean)
    .join(' · ');

  const remove = async () => {
    await deleteMoment(m.id);
    if (detail) navigate(-1);
    showToast({
      message: t('moment.deleted'),
      action: { label: t('common.undo'), onClick: () => void restoreMoment(m.id) },
    });
  };

  const copy = async () => {
    const text = bodyToPlainText(m.body, {
      contact: (id) => {
        const c = lookup.contact(id);
        return c && fullName(c);
      },
      tag: (id) => lookup.tag(id)?.name,
    });
    await navigator.clipboard?.writeText(text);
    showToast({ message: t('moment.copied') });
  };

  const onCardClick = (e: MouseEvent) => {
    if (
      detail ||
      (e.target as HTMLElement).closest('a,button,input,select,textarea,[role="menu"],dialog')
    )
      return;
    if (window.getSelection()?.toString()) return; // selecting text
    navigate(`/moment/${m.id}`);
  };

  const action = 'text-muted';
  return (
    <article
      onClick={onCardClick}
      aria-labelledby={`moment-${m.id}-who`}
      data-testid="moment-card"
      className={`flex gap-3 border-b border-border px-4 py-3 ${detail ? '' : 'cursor-pointer hover:bg-surface-1'}`}
    >
      <div className="shrink-0">
        {primary ? (
          <Link to={`/c/${primary.id}`} aria-label={fullName(primary)}>
            <Avatar contact={primary} size={40} />
          </Link>
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-tint text-accent">
            <KindIcon size={20} aria-hidden />
          </span>
        )}
        {others.length > 0 && (
          <div className="mt-1 flex -space-x-2 pl-1">
            {others.slice(0, 3).map((c) => (
              <Avatar key={c.id} contact={c} size={20} className="ring-2 ring-bg" />
            ))}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {showPinned && m.isPinned && (
          <p className="mb-0.5 flex items-center gap-1 text-xs font-bold text-muted">
            <Pin size={12} aria-hidden /> {t('moment.pinned')}
          </p>
        )}
        <div className="flex items-start gap-1">
          <p id={`moment-${m.id}-who`} className="min-w-0 flex-1 truncate">
            {primary ? (
              <>
                <Link to={`/c/${primary.id}`} className="font-bold hover:underline">
                  {fullName(primary)}
                </Link>
                {primary.nickname && <span className="text-muted"> @{primary.nickname}</span>}
              </>
            ) : (
              <span className="font-bold">{t('moment.you')}</span>
            )}
            <span className="text-muted"> · </span>
            {detail ? (
              <time dateTime={m.happenedAt} className="text-muted">
                {fullDateTime(date, locale)}
              </time>
            ) : (
              <Link to={`/moment/${m.id}`} className="text-muted hover:underline">
                <time dateTime={m.happenedAt} title={fullDateTime(date, locale)}>
                  {shortRelative(date, new Date(), locale)}
                </time>
              </Link>
            )}
          </p>
          <Menu
            label={t('moment.actions.more')}
            triggerClassName="-mt-1 -mr-2 rounded-full p-1.5 text-muted hover:bg-accent-tint hover:text-accent"
            trigger={<Ellipsis size={18} aria-hidden />}
            items={[
              { label: t('moment.actions.copy'), icon: Copy, onSelect: () => void copy() },
              {
                label: t('moment.actions.changeDate'),
                icon: CalendarCog,
                onSelect: () => setChangingDate(true),
              },
            ]}
          />
        </div>

        <p className="mt-0.5 flex items-center gap-1 text-sm text-muted">
          <KindIcon size={14} aria-hidden />
          {kindLine}
        </p>

        {m.body && <MomentBody body={m.body} className={`mt-1 ${detail ? 'text-xl' : ''}`} />}
        <PhotoGrid ids={m.photoBlobIds} full={detail} />

        {others.length > 0 && (
          <p className="mt-2 text-sm text-muted">
            {t('moment.with', { names: '' })}
            {others.map((c, i) => (
              <span key={c.id}>
                {i > 0 && ', '}
                <Link to={`/c/${c.id}`} className="text-accent hover:underline">
                  @{fullName(c)}
                </Link>
              </span>
            ))}
          </p>
        )}

        <div className="mt-2 -ml-2 flex max-w-sm justify-between">
          <IconButton
            label={t('moment.actions.star')}
            tone="accent"
            aria-pressed={m.isStarred}
            onClick={() => void setMomentStarred(m.id, !m.isStarred)}
            className={m.isStarred ? 'text-accent' : action}
          >
            <Star size={18} fill={m.isStarred ? 'currentColor' : 'none'} aria-hidden />
          </IconButton>
          <IconButton
            label={t('moment.actions.pin')}
            tone="accent"
            aria-pressed={!!m.isPinned}
            onClick={() => void setMomentPinned(m.id, !m.isPinned)}
            className={m.isPinned ? 'text-accent' : action}
          >
            <Pin size={18} fill={m.isPinned ? 'currentColor' : 'none'} aria-hidden />
          </IconButton>
          <IconButton
            label={t('moment.actions.edit')}
            tone="accent"
            onClick={() => openComposer({ momentId: m.id })}
            className={action}
          >
            <Pencil size={18} aria-hidden />
          </IconButton>
          <IconButton
            label={t('moment.actions.delete')}
            onClick={() => void remove()}
            className={`${action} hover:!bg-danger/10 hover:!text-danger`}
          >
            <Trash2 size={18} aria-hidden />
          </IconButton>
        </div>
      </div>
      <ChangeDateDialog moment={changingDate ? m : null} onClose={() => setChangingDate(false)} />
    </article>
  );
}
