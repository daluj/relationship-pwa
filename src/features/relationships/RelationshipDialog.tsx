import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import { emptyDateParts, type DateParts } from '@/components/form/dateParts';
import { PartialDateInputs } from '@/components/form/PartialDateInputs';
import { inputClass } from '@/components/form/fieldClass';
import { TextField } from '@/components/form/TextField';
import { DuplicateError, saveContact, saveRelationship } from '@/db/repositories';
import { fullName } from '@/domain/contact';
import { partialDateFromParts } from '@/domain/partialDate';
import { groupOfRelationship, relationshipGroups } from '@/domain/relationships';
import { relationshipTypes } from '@/domain/schemas';
import type { Contact, Relationship, RelationshipType } from '@/domain/types';
import { PeoplePicker } from '@/features/compose/PeoplePicker';
import { useLookup } from '@/features/moments/useLookup';

interface Props {
  open: boolean;
  onClose: () => void;
  contact: Contact;
  relationship?: Relationship;
}

/** Add/edit a relationship: person (or create inline) + type + since (features §8.3). */
export function RelationshipDialog({ open, onClose, contact, relationship }: Props) {
  const { t } = useTranslation();
  const lookup = useLookup();
  const [otherId, setOtherId] = useState<string>();
  const [type, setType] = useState<RelationshipType>('friend');
  const [since, setSince] = useState<DateParts>(emptyDateParts);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setOtherId(relationship?.toContactId);
    setType(relationship?.type ?? 'friend');
    const s = relationship?.since;
    setSince(
      s
        ? { day: String(s.day), month: String(s.month), year: s.year ? String(s.year) : '' }
        : emptyDateParts,
    );
    setNotes(relationship?.notes ?? '');
    setError(undefined);
  }, [open, relationship]);

  const other = otherId ? lookup.contact(otherId) : undefined;

  const save = async () => {
    if (!otherId) return setError(t('relationships.pickPerson'));
    const pd = partialDateFromParts(since.day.trim(), since.month, since.year.trim());
    if (pd === 'invalid') return setError(t('form.birthdayInvalid'));
    try {
      await saveRelationship(relationship?.id, {
        fromContactId: contact.id,
        toContactId: otherId,
        type,
        since: pd ?? undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (e) {
      setError(e instanceof DuplicateError ? t('relationships.duplicate') : String(e));
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={relationship ? t('relationships.edit') : t('relationships.add')}
      wide
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void save()}>{t('common.save')}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <p className="mb-1 text-sm font-bold text-muted">{t('relationships.person')}</p>
          {other ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-surface-2 py-1 pr-1 pl-1">
              <Avatar contact={other} size={28} />
              <span className="font-bold">{fullName(other)}</span>
              {!relationship && (
                <button
                  type="button"
                  aria-label={t('composer.removePerson', { name: fullName(other) })}
                  onClick={() => setOtherId(undefined)}
                  className="rounded-full p-1 hover:bg-bg"
                >
                  <X size={14} aria-hidden />
                </button>
              )}
            </span>
          ) : (
            <PeoplePicker
              contacts={lookup.contacts}
              exclude={[contact.id]}
              onPick={(c) => setOtherId(c.id)}
              onCreate={async (name) => {
                const [firstName, ...rest] = name.split(/\s+/);
                const c = await saveContact(undefined, {
                  contact: { firstName: firstName!, lastName: rest.join(' ') || undefined },
                  fields: [],
                  addresses: [],
                });
                setOtherId(c.id);
              }}
            />
          )}
        </div>
        <label className="text-sm font-bold text-muted">
          {t('relationships.type')}
          <select
            value={type}
            onChange={(e) => setType(e.target.value as RelationshipType)}
            className={`${inputClass} mt-1 font-normal text-text`}
          >
            {relationshipGroups.map((g) => (
              <optgroup key={g} label={t(`relationships.groups.${g}`)}>
                {relationshipTypes
                  .filter((rt) => groupOfRelationship(rt) === g)
                  .map((rt) => (
                    <option key={rt} value={rt}>
                      {t(`relationships.types.${rt}`)}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        {other && (
          <p className="text-sm text-muted" data-testid="relationship-preview">
            {t('relationships.preview', {
              other: fullName(other),
              name: fullName(contact),
              type: t(`relationships.types.${type}`).toLocaleLowerCase(),
            })}
          </p>
        )}
        <PartialDateInputs legend={t('relationships.since')} value={since} onChange={setSince} />
        <TextField
          label={t('relationships.notes')}
          multiline
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
