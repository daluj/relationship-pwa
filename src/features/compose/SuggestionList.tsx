import type { ReactNode } from 'react';

export interface Suggestion {
  key: string;
  label: ReactNode;
  secondary?: string;
  icon?: ReactNode;
  onSelect: () => void;
}

interface Props {
  id: string;
  label: string;
  items: Suggestion[];
  active: number;
  onHover: (i: number) => void;
}

/** ARIA listbox for combobox autocompletes (ui §6.10). */
export function SuggestionList({ id, label, items, active, onHover }: Props) {
  if (items.length === 0) return null;
  return (
    <ul
      id={id}
      role="listbox"
      aria-label={label}
      className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-border bg-bg py-1 shadow-xl"
    >
      {items.map((s, i) => (
        <li
          key={s.key}
          id={`${id}-${i}`}
          role="option"
          aria-selected={i === active}
          onMouseDown={(e) => {
            e.preventDefault(); // keep focus in the input
            s.onSelect();
          }}
          onMouseEnter={() => onHover(i)}
          className={`flex cursor-pointer items-center gap-3 px-4 py-2 ${i === active ? 'bg-surface-2' : ''}`}
        >
          {s.icon}
          <div className="min-w-0">
            <p className="truncate font-bold">{s.label}</p>
            {s.secondary && <p className="truncate text-sm text-muted">{s.secondary}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}
