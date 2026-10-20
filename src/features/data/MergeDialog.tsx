import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useToasts } from '@/app/stores/toast';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import { mergeContacts } from '@/db/repositories';
import { fullName } from '@/domain/contact';
import type { Contact } from '@/domain/types';
import { PeoplePicker } from '@/features/compose/PeoplePicker';
import { useLookup } from '@/features/moments/useLookup';

/** Profile ⋯ › Merge with…: pick the other contact and which one to keep (features §8.2). */
export function MergeDialog({
  contact,
  open,
  onClose,
}: {
  contact: Contact;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const lookup = useLookup();
  const showToast = useToasts((s) => s.show);
  const [otherId, setOtherId] = useState<string>();
  const [keep, setKeep] = useState<'this' | 'other'>('this');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setOtherId(undefined);
      setKeep('this');
    }
  }, [open]);
  const other = otherId ? lookup.contact(otherId) : undefined;

  const merge = async () => {
    if (!other) return;
    setBusy(true);
    try {
      const [primary, secondary] = keep === 'this' ? [contact, other] : [other, contact];
      await mergeContacts(primary.id, secondary.id);
      onClose();
      navigate(`/c/${primary.id}`, { replace: true });
      showToast({ message: t('merge.done') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('merge.title')}
      wide
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button disabled={!other || busy} onClick={() => void merge()}>
            {t('merge.confirm')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t('merge.pick', { name: fullName(contact) })}</p>
        {!other ? (
          <PeoplePicker
            contacts={lookup.contacts}
            exclude={[contact.id]}
            onPick={(c) => setOtherId(c.id)}
          />
        ) : (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 font-bold">{t('merge.keep')}</legend>
            {(
              [
                ['this', contact],
                ['other', other],
              ] as const
            ).map(([k, c]) => (
              <label
                key={k}
                className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 ${keep === k ? 'border-accent' : 'border-border'}`}
              >
                <input
                  type="radio"
                  name="keep"
                  checked={keep === k}
                  onChange={() => setKeep(k)}
                  className="accent-[var(--accent)]"
                />
                <Avatar contact={c} size={32} />
                <span className="font-bold">{fullName(c)}</span>
              </label>
            ))}
          </fieldset>
        )}
        <p className="text-sm text-muted">{t('merge.explain')}</p>
      </div>
    </Dialog>
  );
}
