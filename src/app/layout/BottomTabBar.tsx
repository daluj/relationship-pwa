import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { Badge, BadgeText } from './Badge';
import { useRemindersBadge } from './useRemindersBadge';
import { navItems } from './navItems';

/** Mobile bottom tabs: Home · Search · Reminders · Contacts (SPEC §6.3). */
export function BottomTabBar() {
  const { t } = useTranslation();
  const remindersDue = useRemindersBadge();
  return (
    <nav
      aria-label={t('nav.main')}
      className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg/90 backdrop-blur-md md:hidden"
    >
      <ul className="flex h-[53px] items-stretch">
        {navItems
          .filter((i) => i.mobileTab)
          .map(({ to, icon: Icon, labelKey, badge }) => (
            <li key={to} className="flex-1">
              <NavLink to={to} end={to === '/'} className="flex h-full items-center justify-center">
                {({ isActive }) => (
                  <span className="relative">
                    <Icon size={26} strokeWidth={isActive ? 2.5 : 1.75} aria-hidden />
                    <span className="sr-only">{t(labelKey)}</span>
                    {badge === 'reminders' && <BadgeText count={remindersDue} />}
                    {badge === 'reminders' && <Badge count={remindersDue} />}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
      </ul>
    </nav>
  );
}
