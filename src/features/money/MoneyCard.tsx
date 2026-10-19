import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/Avatar';
import { listOpenDebts, useLiveQuery } from '@/db/repositories';
import { fullName } from '@/domain/contact';
import { balances, formatMoney } from '@/domain/money';
import type { Debt } from '@/domain/types';
import { useLookup } from '@/features/moments/useLookup';
import { RailCard } from '@/features/reminders/RailCards';

/** Right-rail "Money" summary — only when unsettled debts exist (SPEC §8.7). */
export function MoneyCard() {
  const { t, i18n } = useTranslation();
  const lookup = useLookup();
  const debts = useLiveQuery(listOpenDebts, []);
  if (!debts?.length) return null;

  const owedToMe: Record<string, number> = {};
  const iOwe: Record<string, number> = {};
  const perContact = new Map<string, Debt[]>();
  for (const d of debts) perContact.set(d.contactId, [...(perContact.get(d.contactId) ?? []), d]);
  for (const list of perContact.values()) {
    for (const [cur, v] of Object.entries(balances(list))) {
      if (v > 0) owedToMe[cur] = (owedToMe[cur] ?? 0) + v;
      else iOwe[cur] = (iOwe[cur] ?? 0) - v;
    }
  }
  const fmt = (m: Record<string, number>) =>
    Object.entries(m)
      .map(([c, v]) => formatMoney(v, c, i18n.language))
      .join(' + ');
  const people = [...perContact.keys()]
    .map((id) => lookup.contact(id))
    .filter((c) => c)
    .slice(0, 5);

  return (
    <RailCard title={t('money.rail')}>
      <div className="px-4 pb-2">
        {Object.keys(owedToMe).length > 0 && (
          <p className="font-bold text-success">
            {t('money.railTheyOwe', { amount: fmt(owedToMe) })}
          </p>
        )}
        {Object.keys(iOwe).length > 0 && (
          <p className="font-bold text-danger">{t('money.railIOwe', { amount: fmt(iOwe) })}</p>
        )}
      </div>
      <ul>
        {people.map((c) => (
          <li key={c!.id}>
            <Link
              to={`/c/${c!.id}/money`}
              className="flex items-center gap-3 px-4 py-2 hover:bg-surface-1"
            >
              <Avatar contact={c!} size={28} />
              <span className="truncate text-sm font-bold">{fullName(c!)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </RailCard>
  );
}
