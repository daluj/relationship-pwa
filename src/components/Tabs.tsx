import { NavLink } from 'react-router-dom';

export interface TabItem {
  id: string;
  label: string;
  /** When set, the tab is a link (route-driven tabs). */
  to?: string;
}

interface Props {
  label: string;
  items: TabItem[];
  active?: string;
  onChange?: (id: string) => void;
  className?: string;
}

const inner = (selected: boolean) =>
  `py-4 border-b-4 ${selected ? 'border-accent' : 'border-transparent'}`;
const outer = (selected: boolean) =>
  `flex flex-1 shrink-0 justify-center px-4 whitespace-nowrap hover:bg-surface-1 ${selected ? 'font-bold text-text' : 'text-muted'}`;

/** X-style tab strip with accent underline. */
export function Tabs({ label, items, active, onChange, className = '' }: Props) {
  return (
    <div role="tablist" aria-label={label} className={`flex overflow-x-auto ${className}`}>
      {items.map((tab) => {
        const selected = tab.id === active;
        return tab.to ? (
          <NavLink
            key={tab.id}
            to={tab.to}
            role="tab"
            aria-selected={selected}
            className={outer(selected)}
            replace
          >
            <span className={inner(selected)}>{tab.label}</span>
          </NavLink>
        ) : (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => onChange?.(tab.id)}
            className={outer(selected)}
          >
            <span className={inner(selected)}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
