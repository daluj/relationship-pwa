import { useTranslation } from 'react-i18next';

/**
 * Count bubble on a nav icon (hidden when zero). The visible number is decorative; screen readers get
 * the phrase from `<BadgeText>`, placed after the link label ("Reminders (1 reminder due)").
 */
export function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden
      data-testid="nav-badge"
      className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-accent px-1 text-center text-[11px] font-bold leading-[18px] text-on-accent"
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function BadgeText({ count }: { count: number }) {
  const { t } = useTranslation();
  if (count <= 0) return null;
  return <span className="sr-only">({t('nav.remindersBadge', { count })})</span>;
}
