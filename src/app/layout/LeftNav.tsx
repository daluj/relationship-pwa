import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router-dom';
import { Database, Ellipsis, Feather, Info, Trash2 } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { InstallMenuItem } from '@/components/InstallButton';
import { useComposer } from '../stores/composer';
import { Badge, BadgeText } from './Badge';
import { useRemindersBadge } from './useRemindersBadge';
import { navItems } from './navItems';
import { ThemeToggle } from './ThemeToggle';

/** Desktop: 275px with labels (xl). Tablet: 88px icons only (md). Hidden on mobile. */
export function LeftNav() {
  const { t } = useTranslation();
  const remindersDue = useRemindersBadge();
  const [moreOpen, setMoreOpen] = useState(false);
  const openComposer = useComposer((st) => st.openComposer);

  return (
    <header className="sticky top-0 hidden h-dvh w-[88px] shrink-0 flex-col items-center px-2 md:flex xl:w-[275px] xl:items-stretch">
      <Link
        to="/"
        aria-label={t('nav.home')}
        className="m-1 mt-2 w-fit rounded-full p-3 hover:bg-surface-2"
      >
        <Logo />
      </Link>
      <nav aria-label={t('nav.main')} className="mt-1 flex flex-col items-center xl:items-stretch">
        <ul>
          {navItems.map(({ to, icon: Icon, labelKey, badge }) => (
            <li key={to}>
              <NavLink to={to} end={to === '/'} className="group block py-0.5">
                {({ isActive }) => (
                  <span className="inline-flex items-center gap-5 rounded-full p-3 group-hover:bg-surface-2 xl:pr-6">
                    <span className="relative">
                      <Icon size={26} strokeWidth={isActive ? 2.5 : 1.75} aria-hidden />
                      {badge === 'reminders' && <Badge count={remindersDue} />}
                    </span>
                    <span
                      className={`sr-only text-xl xl:not-sr-only ${isActive ? 'font-bold' : ''}`}
                    >
                      {t(labelKey)}
                    </span>
                    {badge === 'reminders' && <BadgeText count={remindersDue} />}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
          <li className="relative">
            <button
              type="button"
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              aria-label={t('nav.more')}
              onClick={() => setMoreOpen((o) => !o)}
              className="inline-flex items-center gap-5 rounded-full p-3 hover:bg-surface-2 xl:pr-6"
            >
              <Ellipsis size={26} strokeWidth={1.75} aria-hidden />
              <span className="hidden text-xl xl:inline">{t('nav.more')}</span>
            </button>
            {moreOpen && (
              <div
                role="menu"
                className="absolute left-0 top-full z-20 min-w-56 overflow-hidden rounded-xl border border-border bg-bg py-1 shadow-xl"
                onClick={() => setMoreOpen(false)}
              >
                {[
                  { to: '/settings/data', icon: Database, label: t('nav.data') },
                  { to: '/settings/trash', icon: Trash2, label: t('nav.trash') },
                  { to: '/settings/about', icon: Info, label: t('rail.about') },
                ].map(({ to, icon: Icon, label }) => (
                  <Link
                    key={to}
                    role="menuitem"
                    to={to}
                    className="flex items-center gap-3 px-4 py-3 font-bold hover:bg-surface-1"
                  >
                    <Icon size={20} aria-hidden /> {label}
                  </Link>
                ))}
                <InstallMenuItem />
              </div>
            )}
          </li>
        </ul>
      </nav>

      <button
        type="button"
        onClick={() => openComposer()}
        aria-label={t('nav.logMoment')}
        className="mt-4 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-accent text-on-accent shadow hover:bg-accent-hover xl:w-[90%]"
      >
        <Feather size={24} className="xl:hidden" aria-hidden />
        <span className="hidden text-lg font-bold xl:inline">{t('nav.logMoment')}</span>
      </button>

      <div className="mt-auto mb-3">
        <ThemeToggle />
      </div>
    </header>
  );
}
