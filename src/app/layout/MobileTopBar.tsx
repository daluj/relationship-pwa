import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Menu, Settings } from 'lucide-react';
import { Logo } from '@/components/Logo';

export function MobileTopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      data-print="hide"
      className="pt-safe sticky top-0 z-20 border-b border-border bg-bg/80 backdrop-blur-md md:hidden"
    >
      <div className="flex h-[53px] items-center justify-between px-4">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label={t('nav.openMenu')}
          className="-ml-2 rounded-full p-2 hover:bg-surface-2"
        >
          <Menu size={22} aria-hidden />
        </button>
        <Link to="/" aria-label={t('nav.home')}>
          <Logo size={28} />
        </Link>
        <Link
          to="/settings"
          aria-label={t('nav.settings')}
          className="-mr-2 rounded-full p-2 hover:bg-surface-2"
        >
          <Settings size={22} aria-hidden />
        </Link>
      </div>
    </div>
  );
}
