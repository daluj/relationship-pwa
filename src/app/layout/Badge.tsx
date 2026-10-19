import { useTranslation } from 'react-i18next';

/** Count bubble on a nav icon. Hidden when zero. */
export function Badge({ count }: { count: number }) {
  const { t } = useTranslation();
  if (count <= 0) return null;
  return (
    <span
      className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-accent px-1 text-center text-[11px] font-bold leading-[18px] text-on-accent"
      aria-label={t('nav.remindersBadge', { count })}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
