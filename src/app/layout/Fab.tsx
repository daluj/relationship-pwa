import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Feather, Plus } from 'lucide-react';

/** Mobile floating "Log moment" button, above the tab bar (SPEC §6.3). */
export function Fab() {
  const { t } = useTranslation();
  return (
    <Link
      to="/compose"
      aria-label={t('nav.logMoment')}
      className="fixed right-4 bottom-[calc(53px+16px+env(safe-area-inset-bottom))] z-20 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-on-accent shadow-lg hover:bg-accent-hover md:hidden"
    >
      <Plus size={14} strokeWidth={3} className="-mr-1 -mt-3" aria-hidden />
      <Feather size={22} aria-hidden />
    </Link>
  );
}
