import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRightLeft, Ellipsis, Gift as GiftIcon, Pencil, Plus, Trash2 } from 'lucide-react';
import { useToasts } from '@/app/stores/toast';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import { Menu } from '@/components/Menu';
import { inputClass } from '@/components/form/fieldClass';
import { TextField } from '@/components/form/TextField';
import { giftRepo, giftsFor, saveGift, useLiveQuery, useSettings } from '@/db/repositories';
import { formatMoney } from '@/domain/money';
import { parseIsoDate } from '@/domain/recurrence';
import type { Gift } from '@/domain/types';
import { CurrencySelect } from '@/features/money/CurrencySelect';

const statuses = ['idea', 'bought', 'given', 'received'] as const;

const safeUrl = (url?: string) => (url && /^https?:\/\//i.test(url) ? url : undefined);

/** Profile › Gifts, grouped Ideas / Bought / Given / Received (SPEC §6.6). */
export function GiftsTab({ contactId }: { contactId: string }) {
  const { t, i18n } = useTranslation();
  const showToast = useToasts((s) => s.show);
  const gifts = useLiveQuery(() => giftsFor(contactId), [contactId]);
  const [editing, setEditing] = useState<Gift | null | undefined>(undefined);
  const fmtDate = (d: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(parseIsoDate(d));

  const remove = async (g: Gift) => {
    await giftRepo.softDelete(g.id);
    showToast({
      message: t('gifts.deleted'),
      action: { label: t('common.undo'), onClick: () => void giftRepo.restore(g.id) },
    });
  };

  if (!gifts) return null;
  return (
    <div>
      <div className="flex justify-end px-4 py-3">
        <Button size="sm" onClick={() => setEditing(null)}>
          <Plus size={16} aria-hidden /> {t('gifts.add')}
        </Button>
      </div>
      {gifts.length === 0 && (
        <p className="px-8 pb-12 text-center text-muted">{t('gifts.empty')}</p>
      )}
      {statuses.map((status) => {
        const items = gifts
          .filter((g) => g.status === status)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        if (!items.length) return null;
        return (
          <section key={status} aria-labelledby={`gifts-${status}`}>
            <h3 id={`gifts-${status}`} className="bg-surface-1 px-4 py-2 text-sm font-extrabold">
              {t(`gifts.statuses.${status}`)}
            </h3>
            <ul>
              {items.map((g) => {
                const url = safeUrl(g.url);
                const meta = [
                  g.occasion,
                  g.price !== undefined && formatMoney(g.price, g.currency ?? 'EUR', i18n.language),
                  g.date && fmtDate(g.date),
                ].filter(Boolean);
                return (
                  <li
                    key={g.id}
                    data-testid="gift-row"
                    className="flex items-start gap-3 border-b border-border px-4 py-3"
                  >
                    <GiftIcon size={20} className="mt-0.5 shrink-0 text-muted" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent-text hover:underline"
                          >
                            {g.name}
                          </a>
                        ) : (
                          g.name
                        )}
                      </p>
                      {meta.length > 0 && <p className="text-sm text-muted">{meta.join(' · ')}</p>}
                      {g.notes && <p className="mt-1 text-sm whitespace-pre-line">{g.notes}</p>}
                    </div>
                    <Menu
                      label={`${t('common.more')}: ${g.name}`}
                      triggerClassName="rounded-full p-1.5 text-muted hover:bg-surface-2"
                      trigger={<Ellipsis size={18} aria-hidden />}
                      items={[
                        ...statuses
                          .filter((s) => s !== g.status)
                          .map((s) => ({
                            label: t('gifts.moveTo', { status: t(`gifts.status.${s}`) }),
                            icon: ArrowRightLeft,
                            onSelect: () => void giftRepo.update(g.id, { status: s }),
                          })),
                        { label: t('gifts.edit'), icon: Pencil, onSelect: () => setEditing(g) },
                        {
                          label: t('gifts.delete'),
                          icon: Trash2,
                          danger: true,
                          onSelect: () => void remove(g),
                        },
                      ]}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <GiftDialog
        open={editing !== undefined}
        gift={editing ?? undefined}
        contactId={contactId}
        onClose={() => setEditing(undefined)}
      />
    </div>
  );
}

function GiftDialog({
  open,
  gift,
  contactId,
  onClose,
}: {
  open: boolean;
  gift?: Gift;
  contactId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { currency: defaultCurrency } = useSettings();
  const [name, setName] = useState('');
  const [status, setStatus] = useState<Gift['status']>('idea');
  const [occasion, setOccasion] = useState('');
  const [url, setUrl] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setName(gift?.name ?? '');
    setStatus(gift?.status ?? 'idea');
    setOccasion(gift?.occasion ?? '');
    setUrl(gift?.url ?? '');
    setPrice(gift?.price?.toString() ?? '');
    setCurrency(gift?.currency ?? defaultCurrency);
    setDate(gift?.date?.slice(0, 10) ?? '');
    setNotes(gift?.notes ?? '');
    setError(undefined);
  }, [open, gift, defaultCurrency]);

  const save = async () => {
    if (!name.trim()) return setError(t('form.required'));
    if (url.trim() && !safeUrl(url.trim())) return setError(t('gifts.invalidUrl'));
    const p = price.trim() ? Number(price.replace(',', '.')) : undefined;
    await saveGift(gift?.id, {
      contactId,
      name: name.trim(),
      status,
      occasion: occasion.trim() || undefined,
      url: url.trim() || undefined,
      price: p !== undefined && Number.isFinite(p) && p >= 0 ? p : undefined,
      currency: p !== undefined ? currency : undefined,
      date: date || undefined,
      notes: notes.trim() || undefined,
      photoBlobId: gift?.photoBlobId,
    });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={gift ? t('gifts.edit') : t('gifts.add')}
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
        <TextField
          label={t('gifts.name')}
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />
        <label className="text-sm font-bold text-muted">
          {t('gifts.statusLabel')}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Gift['status'])}
            className={`${inputClass} mt-1 font-normal text-text`}
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {t(`gifts.status.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <TextField
          label={t('gifts.occasion')}
          value={occasion}
          onChange={(e) => setOccasion(e.target.value)}
        />
        <TextField
          label={t('gifts.url')}
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label={t('gifts.price')}
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <CurrencySelect label={t('gifts.currency')} value={currency} onChange={setCurrency} />
        </div>
        <label className="text-sm font-bold text-muted">
          {t('gifts.date')}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={`${inputClass} mt-1 font-normal text-text`}
          />
        </label>
        <TextField
          label={t('gifts.notes')}
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
