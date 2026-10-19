import { useEffect } from 'react';
import { useComposer } from './stores/composer';

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

/** `n` opens the composer (SPEC §6.5). The full shortcut set arrives in M8. */
export function useGlobalShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (
        e.key === 'n' &&
        !useComposer.getState().open &&
        !document.querySelector('dialog[open]')
      ) {
        e.preventDefault();
        useComposer.getState().openComposer();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
}
