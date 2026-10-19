import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { MoneyCard } from '@/features/money/MoneyCard';
import { ReachOutCard, UpcomingCard } from '@/features/reminders/RailCards';

/** Right rail ≥1000px: search, Upcoming, Reach out, footer (SPEC §6.1). Search arrives in M6. */
export function RightRail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [q, setQ] = useState('');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    navigate(q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : '/search');
  };

  return (
    <aside
      className="hidden w-[290px] shrink-0 pl-6 rail:block xl:w-[350px] xl:pl-8"
      aria-label={t('rail.upcoming')}
    >
      <div className="sticky top-0 flex flex-col gap-4 pb-6">
        <form role="search" onSubmit={onSubmit} className="sticky top-0 z-10 bg-bg pt-1.5 pb-1">
          <label className="flex items-center gap-3 rounded-full border border-transparent bg-surface-2 px-4 py-2.5 focus-within:border-accent focus-within:bg-bg">
            <Search size={18} className="text-muted" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('rail.searchPlaceholder')}
              aria-label={t('rail.searchPlaceholder')}
              className="w-full bg-transparent outline-none placeholder:text-muted"
            />
          </label>
        </form>
        <UpcomingCard />
        <ReachOutCard />
        <MoneyCard />
        <footer className="flex flex-wrap gap-x-3 gap-y-1 px-4 text-xs text-muted">
          <Link to="/settings/about" className="hover:underline">
            {t('rail.about')}
          </Link>
          <Link to="/settings/data" className="hover:underline">
            {t('rail.export')}
          </Link>
          <Link to="/settings/about#privacy" className="hover:underline">
            {t('rail.privacy')}
          </Link>
        </footer>
      </div>
    </aside>
  );
}
