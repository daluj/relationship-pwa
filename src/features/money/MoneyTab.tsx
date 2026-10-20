import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Ellipsis, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useToasts } from '@/app/stores/toast';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import { Menu } from '@/components/Menu';
import { inputClass } from '@/components/form/fieldClass';
import { TextField } from '@/components/form/TextField';
import {
  debtRepo,
  debtsFor,
  saveDebt,
  settleDebt,
  useLiveQuery,
  useSettings,
} from '@/db/repositories';
import { balances, formatMoney } from '@/domain/money';
import { toIsoDate } from '@/domain/partialDate';
import { parseIsoDate } from '@/domain/recurrence';
import type { Debt } from '@/domain/types';
import { CurrencySelect } from './CurrencySelect';

/** "Owes you €35" / "You owe €20" per currency (ui §6.6). */
export function BalanceLines({ debts, className = '' }: { debts: Debt[]; className?: string }) {
  const { t, i18n } = useTranslation();
  const entries = Object.entries(balances(debts));
  if (!entries.length) return <p className={`text-muted ${className}`}>{t('money.allSettled')}</p>;
  return (
    <ul className={className}>
      {entries.map(([currency, v]) => (
        <li
          key={currency}
          className={`text-lg font-extrabold ${v > 0 ? 'text-success' : 'text-danger'}`}
        >
          {v > 0
            ? t('money.theyOwe', { amount: formatMoney(v, currency, i18n.language) })
            : t('money.iOwe', { amount: formatMoney(-v, currency, i18n.language) })}
        </li>
      ))}
    </ul>
  );
}

/** Profile › Money: debts with a running balance and settle action (ui §6.6, §8.7). */
export function MoneyTab({ contactId }: { contactId: string }) {
  const { t, i18n } = useTranslation();
  const showToast = useToasts((s) => s.show);
  const debts = useLiveQuery(() => debtsFor(contactId), [contactId]);
  const [editing, setEditing] = useState<Debt | null | undefined>(undefined);
  if (!debts) return null;

  const fmtDate = (d: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(parseIsoDate(d));
  const byDate = (a: Debt, b: Debt) => b.date.localeCompare(a.date);
  const open = debts.filter((d) => !d.settledAt).sort(byDate);
  const settled = debts
    .filter((d) => d.settledAt)
    .sort((a, b) => b.settledAt!.localeCompare(a.settledAt!));

  const row = (d: Debt) => {
    const amount = formatMoney(d.amount, d.currency, i18n.language);
    return (
      <li
        key={d.id}
        data-testid="debt-row"
        className="flex items-start gap-3 border-b border-border px-4 py-3"
      >
        <div className="min-w-0 flex-1">
          <p className={`font-bold ${d.settledAt ? 'text-muted line-through' : ''}`}>
            {d.direction === 'they-owe'
              ? t('money.theyOwe', { amount })
              : t('money.iOwe', { amount })}
          </p>
          <p className="text-sm text-muted">
            {[
              d.reason,
              fmtDate(d.date.slice(0, 10)),
              d.settledAt && t('money.settledOn', { date: fmtDate(d.settledAt.slice(0, 10)) }),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        {!d.settledAt && (
          <Button size="sm" variant="outline" onClick={() => void settleDebt(d.id, true)}>
            <Check size={14} aria-hidden /> {t('money.settle')}
          </Button>
        )}
        <Menu
          label={`${t('common.more')}: ${amount}`}
          triggerClassName="rounded-full p-1.5 text-muted hover:bg-surface-2"
          trigger={<Ellipsis size={18} aria-hidden />}
          items={[
            ...(d.settledAt
              ? [
                  {
                    label: t('money.unsettle'),
                    icon: RotateCcw,
                    onSelect: () => void settleDebt(d.id, false),
                  },
                ]
              : []),
            { label: t('money.edit'), icon: Pencil, onSelect: () => setEditing(d) },
            {
              label: t('money.delete'),
              icon: Trash2,
              danger: true,
              onSelect: () =>
                void debtRepo.softDelete(d.id).then(() =>
                  showToast({
                    message: t('money.deleted'),
                    action: {
                      label: t('common.undo'),
                      onClick: () => void debtRepo.restore(d.id),
                    },
                  }),
                ),
            },
          ]}
        />
      </li>
    );
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-3 px-4 py-3" data-testid="balance">
        <BalanceLines debts={debts} />
        <Button size="sm" onClick={() => setEditing(null)}>
          <Plus size={16} aria-hidden /> {t('money.add')}
        </Button>
      </div>
      {debts.length === 0 && (
        <p className="px-8 pb-12 text-center text-muted">{t('money.empty')}</p>
      )}
      {open.length > 0 && (
        <section aria-labelledby="debts-open">
          <h3 id="debts-open" className="bg-surface-1 px-4 py-2 text-sm font-extrabold">
            {t('money.open')}
          </h3>
          <ul>{open.map(row)}</ul>
        </section>
      )}
      {settled.length > 0 && (
        <section aria-labelledby="debts-settled">
          <h3 id="debts-settled" className="bg-surface-1 px-4 py-2 text-sm font-extrabold">
            {t('money.history')}
          </h3>
          <ul>{settled.map(row)}</ul>
        </section>
      )}
      <DebtDialog
        open={editing !== undefined}
        debt={editing ?? undefined}
        contactId={contactId}
        onClose={() => setEditing(undefined)}
      />
    </div>
  );
}

function DebtDialog({
  open,
  debt,
  contactId,
  onClose,
}: {
  open: boolean;
  debt?: Debt;
  contactId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { currency: defaultCurrency } = useSettings();
  const [direction, setDirection] = useState<Debt['direction']>('they-owe');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [reason, setReason] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setDirection(debt?.direction ?? 'they-owe');
    setAmount(debt?.amount.toString() ?? '');
    setCurrency(debt?.currency ?? defaultCurrency);
    setReason(debt?.reason ?? '');
    setDate(debt?.date.slice(0, 10) ?? toIsoDate(new Date()));
    setError(undefined);
  }, [open, debt, defaultCurrency]);

  const save = async () => {
    const n = Number(amount.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) return setError(t('money.invalidAmount'));
    await saveDebt(debt?.id, {
      contactId,
      direction,
      amount: n,
      currency,
      reason: reason.trim() || undefined,
      date,
    });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={debt ? t('money.edit') : t('money.add')}
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
        <fieldset>
          <legend className="mb-1 text-sm font-bold text-muted">{t('money.direction')}</legend>
          <div className="flex gap-4">
            {(['they-owe', 'i-owe'] as const).map((d) => (
              <label key={d} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="direction"
                  checked={direction === d}
                  onChange={() => setDirection(d)}
                  className="accent-[var(--accent)]"
                />
                {d === 'they-owe' ? t('money.directionTheyOwe') : t('money.directionIOwe')}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label={t('money.amount')}
            inputMode="decimal"
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <CurrencySelect label={t('money.currency')} value={currency} onChange={setCurrency} />
        </div>
        <TextField
          label={t('money.reason')}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <label className="text-sm font-bold text-muted">
          {t('money.date')}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={`${inputClass} mt-1 font-normal text-text`}
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
