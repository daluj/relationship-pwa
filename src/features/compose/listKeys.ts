import type { Suggestion } from './SuggestionList';

/** Arrow/Enter/Tab/Escape handling shared by the composer and people picker. Returns true if handled. */
export function handleListKeys(
  e: { key: string; ctrlKey?: boolean; metaKey?: boolean; preventDefault: () => void },
  items: Suggestion[],
  active: number,
  setActive: (i: number) => void,
  close: () => void,
): boolean {
  if (items.length === 0 || e.ctrlKey || e.metaKey) return false;
  if (e.key === 'ArrowDown') setActive((active + 1) % items.length);
  else if (e.key === 'ArrowUp') setActive((active - 1 + items.length) % items.length);
  else if (e.key === 'Enter' || e.key === 'Tab') items[active]?.onSelect();
  else if (e.key === 'Escape') close();
  else return false;
  e.preventDefault();
  return true;
}
