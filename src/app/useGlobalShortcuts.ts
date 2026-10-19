import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useComposer } from './stores/composer';

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

/** Shortcut reference shown on `?` (SPEC §6.9). Keys are literal; descriptions are i18n keys. */
export const shortcuts = [
  { keys: ['n'], action: 'compose' },
  { keys: ['/'], action: 'search' },
  { keys: ['g', 'h'], action: 'home' },
  { keys: ['g', 'r'], action: 'reminders' },
  { keys: ['g', 'c'], action: 'contacts' },
  { keys: ['j'], action: 'next' },
  { keys: ['k'], action: 'previous' },
  { keys: ['s'], action: 'star' },
  { keys: ['Enter'], action: 'open' },
  { keys: ['?'], action: 'help' },
] as const;

const cards = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-testid="moment-card"]'));

/** Move focus between moment cards (`j` / `k`), like X. */
function moveCard(step: 1 | -1) {
  const list = cards();
  if (!list.length) return;
  const current = list.indexOf(document.activeElement as HTMLElement);
  const next =
    list[
      current < 0
        ? step === 1
          ? 0
          : list.length - 1
        : Math.min(list.length - 1, Math.max(0, current + step))
    ];
  next?.focus();
  next?.scrollIntoView({ block: 'nearest' });
}

/**
 * Global keyboard shortcuts (SPEC §6.9): n, /, g h, g r, g c, j/k, s, ?.
 * Ignored while typing, with modifier keys, or when a dialog is open.
 */
export function useGlobalShortcuts(): { helpOpen: boolean; setHelpOpen: (v: boolean) => void } {
  const navigate = useNavigate();
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    let pendingG = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (useComposer.getState().open || document.querySelector('dialog[open]')) return;
      const now = Date.now();
      const afterG = now - pendingG < 1000;
      pendingG = 0;

      const run = (fn: () => void) => {
        e.preventDefault();
        fn();
      };
      if (afterG) {
        const to = { h: '/', r: '/reminders', c: '/contacts' }[e.key];
        if (to) return run(() => navigate(to));
      }
      switch (e.key) {
        case 'g':
          pendingG = now;
          return;
        case 'n':
          return run(() => useComposer.getState().openComposer());
        case '/':
          return run(() => {
            const box = Array.from(
              document.querySelectorAll<HTMLInputElement>('input[type="search"]'),
            ).find((el) => el.offsetParent !== null);
            if (box) box.focus();
            else navigate('/search');
          });
        case 'j':
          return run(() => moveCard(1));
        case 'k':
          return run(() => moveCard(-1));
        case 's': {
          const card = (document.activeElement as HTMLElement | null)?.closest(
            '[data-testid="moment-card"]',
          );
          const star = card?.querySelector<HTMLButtonElement>(
            'button[aria-pressed][data-action="star"]',
          );
          if (star) run(() => star.click());
          return;
        }
        case '?':
          return run(() => setHelpOpen(true));
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navigate]);

  return { helpOpen, setHelpOpen };
}
