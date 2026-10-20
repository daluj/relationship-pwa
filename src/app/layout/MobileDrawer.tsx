import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { X } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { navItems } from './navItems';
import { ThemeToggle } from './ThemeToggle';

/** Full navigation for mobile, opened from the top bar (ui §6.3). */
export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    panelRef.current?.querySelector<HTMLElement>('button, a')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 md:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('nav.main')}
        className="pt-safe pb-safe absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col bg-bg shadow-xl"
      >
        <div className="flex h-[53px] items-center justify-between px-4">
          <Logo size={28} />
          <button
            type="button"
            onClick={onClose}
            aria-label={t('nav.closeMenu')}
            className="-mr-2 rounded-full p-2 hover:bg-surface-2"
          >
            <X size={22} aria-hidden />
          </button>
        </div>
        <nav aria-label={t('nav.main')} className="flex-1 overflow-y-auto">
          <ul>
            {navItems.map(({ to, icon: Icon, labelKey }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-5 px-4 py-3 text-lg hover:bg-surface-1 ${isActive ? 'font-bold' : ''}`
                  }
                >
                  <Icon size={24} aria-hidden /> {t(labelKey)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-border p-2">
          <ThemeToggle showLabel />
        </div>
      </div>
    </div>
  );
}
