import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
}

interface Props {
  label: string;
  trigger: ReactNode;
  items: MenuItem[];
  align?: 'left' | 'right';
  triggerClassName?: string;
}

/** Popover menu (⋯) with keyboard support: arrows, Home/End, Esc. */
export function Menu({ label, trigger, items, align = 'right', triggerClassName = '' }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    rootRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const els = Array.from(
      rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    const i = els.indexOf(document.activeElement as HTMLElement);
    const focus = (n: number) => els[(n + els.length) % els.length]?.focus();
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown') focus(i + 1);
    else if (e.key === 'ArrowUp') focus(i - 1);
    else if (e.key === 'Home') focus(0);
    else if (e.key === 'End') focus(els.length - 1);
    else return;
    e.preventDefault();
  };

  return (
    <div ref={rootRef} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className={`absolute top-full z-30 mt-1 min-w-56 overflow-hidden rounded-xl border border-border bg-bg py-1 shadow-xl ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {items.map(({ label: itemLabel, icon: Icon, onSelect, danger }) => (
            <button
              key={itemLabel}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                setOpen(false);
                onSelect();
              }}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left font-bold hover:bg-surface-1 focus:bg-surface-1 focus:outline-none ${danger ? 'text-danger' : ''}`}
            >
              {Icon && <Icon size={18} aria-hidden />}
              {itemLabel}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
