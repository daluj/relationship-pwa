import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { contactRepo, getMilestones, useLiveQuery } from '@/db/repositories';
import { fullName } from '@/domain/contact';
import type { Milestone } from '@/domain/recall';
import type { Contact } from '@/domain/types';

function MilestoneRow({ m, contact }: { m: Milestone; contact: Contact }) {
  const { t, i18n } = useTranslation();
  const other = useLiveQuery(
    async () => (m.otherContactId ? contactRepo.get(m.otherContactId) : undefined),
    [m.otherContactId],
  );
  const otherName = other ? fullName(other) : undefined;
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(m.date);
  let label: string;
  switch (m.type) {
    case 'met':
      label = [
        t('recall.milestones.met'),
        m.text,
        otherName && t('details.introducedBy', { name: otherName }),
      ]
        .filter(Boolean)
        .join(' · ');
      break;
    case 'relationship':
      label = t('recall.milestones.relationship', {
        type: m.relationshipType ? t(`relationships.types.${m.relationshipType}`) : '',
        name: otherName ?? '',
      });
      break;
    case 'life-event':
      label = [
        m.lifeEventType
          ? t(`moment.lifeEventTypes.${m.lifeEventType}`)
          : t('moment.kinds.life-event'),
        m.text,
      ]
        .filter(Boolean)
        .join(' · ');
      break;
    case 'important-date':
      label = m.text ?? '';
      break;
    case 'gift':
      label = t('recall.milestones.gift', { name: m.text ?? '' });
      break;
    default:
      label = t('recall.milestones.first');
  }
  const to = m.momentId ? `/moment/${m.momentId}` : `/c/${contact.id}/details`;
  return (
    <li className="border-b border-border">
      <Link to={to} className="block px-4 py-3 hover:bg-surface-1">
        <span className="block text-sm text-muted">{date}</span>
        <span>{label}</span>
      </Link>
    </li>
  );
}

/** Profile › Timeline › Milestones, oldest first (features §8.11 AC-6). */
export function Milestones({ contact }: { contact: Contact }) {
  const { t } = useTranslation();
  const items = useLiveQuery(() => getMilestones(contact), [contact]);
  if (!items) return null;
  if (items.length === 0) {
    return <p className="px-8 py-12 text-center text-muted">{t('recall.milestones.empty')}</p>;
  }
  return (
    <ol aria-label={t('recall.milestones.label')}>
      {items.map((m) => (
        <MilestoneRow key={m.id} m={m} contact={contact} />
      ))}
    </ol>
  );
}
