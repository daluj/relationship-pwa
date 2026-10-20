import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useToasts } from '@/app/stores/toast';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import {
  deleteRelationship,
  relationshipsFor,
  restoreRelationship,
  useLiveQuery,
} from '@/db/repositories';
import { fullName } from '@/domain/contact';
import { groupOfRelationship, relationshipGroups } from '@/domain/relationships';
import type { Contact, Relationship } from '@/domain/types';
import { useLookup } from '@/features/moments/useLookup';
import { RelationshipDialog } from './RelationshipDialog';

/** Profile › Details › Relationships, grouped Family / Love / Friends / Work / Other (features §8.3). */
export function RelationshipsBlock({ contact }: { contact: Contact }) {
  const { t } = useTranslation();
  const lookup = useLookup();
  const showToast = useToasts((s) => s.show);
  const rows = useLiveQuery(() => relationshipsFor(contact.id), [contact.id]);
  const [editing, setEditing] = useState<Relationship | null | undefined>(undefined);

  const remove = async (r: Relationship) => {
    await deleteRelationship(r.id);
    showToast({
      message: t('relationships.deleted'),
      action: { label: t('common.undo'), onClick: () => void restoreRelationship(r.id) },
    });
  };

  return (
    <section
      id="relationships"
      className="scroll-mt-32 border-b border-border px-4 py-4"
      aria-label={t('relationships.title')}
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-extrabold">{t('relationships.title')}</h3>
        <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
          <Plus size={16} aria-hidden /> {t('relationships.add')}
        </Button>
      </div>
      {relationshipGroups.map((g) => {
        const items = (rows ?? [])
          .filter((r) => groupOfRelationship(r.type) === g)
          .map((r) => ({ r, other: lookup.contact(r.toContactId) }))
          .filter((x): x is { r: Relationship; other: Contact } => !!x.other);
        if (!items.length) return null;
        return (
          <div key={g} className="mb-3">
            <h4 className="mb-1 text-xs font-bold tracking-wide text-muted uppercase">
              {t(`relationships.groups.${g}`)}
            </h4>
            <ul className="flex flex-col gap-1">
              {items.map(({ r, other }) => (
                <li key={r.id} className="flex items-center gap-3">
                  <Link
                    to={`/c/${other.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-md py-1 hover:bg-surface-1"
                  >
                    <Avatar contact={other} size={32} />
                    <div className="min-w-0">
                      <p className="truncate font-bold">{fullName(other)}</p>
                      <p className="text-sm text-muted">
                        {t(`relationships.types.${r.type}`)}
                        {r.since?.year ? ` · ${t('relationships.since')} ${r.since.year}` : ''}
                      </p>
                    </div>
                  </Link>
                  <IconButton
                    label={`${t('relationships.edit')}: ${fullName(other)}`}
                    onClick={() => setEditing(r)}
                  >
                    <Pencil size={16} aria-hidden />
                  </IconButton>
                  <IconButton
                    label={`${t('relationships.delete')}: ${fullName(other)}`}
                    onClick={() => void remove(r)}
                  >
                    <Trash2 size={16} aria-hidden />
                  </IconButton>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <RelationshipDialog
        open={editing !== undefined}
        relationship={editing ?? undefined}
        contact={contact}
        onClose={() => setEditing(undefined)}
      />
    </section>
  );
}
