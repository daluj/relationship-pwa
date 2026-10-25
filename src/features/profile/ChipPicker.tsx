import { useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import { inputClass } from '@/components/form/fieldClass';
import { fuzzyFilter, normalizeText } from '@/domain/fuzzy';
import { handleListKeys } from '@/features/compose/listKeys';
import { SuggestionList, type Suggestion } from '@/features/compose/SuggestionList';

export interface ChipOption {
  id: string;
  label: string;
  href?: string;
  icon?: ReactNode;
}

interface Props {
  title: string;
  options: ChipOption[];
  selected: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  /** Omit to pick from the options only (no create-on-the-fly). */
  onCreate?: (name: string) => Promise<void>;
  labels: {
    add: string;
    search: string;
    remove: (name: string) => string;
    create?: (name: string) => string;
  };
  renderChip?: (o: ChipOption) => ReactNode;
  /** Options have loaded; until then nothing (not even "Create …") is offered. */
  ready?: boolean;
}

/** Chips with remove buttons and an add combobox with create-on-the-fly (tags, groups). */
export function ChipPicker({
  title,
  options,
  selected,
  onAdd,
  onRemove,
  onCreate,
  labels,
  renderChip,
  ready = true,
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const chosen = selected
    .map((id) => options.find((o) => o.id === id))
    .filter((o): o is ChipOption => !!o);

  const done = () => {
    setQuery('');
    setOpen(false);
  };
  const items: Suggestion[] =
    open && ready
      ? fuzzyFilter(
          options.filter((o) => !selected.includes(o.id)),
          query,
          (o) => [o.label],
        ).map((o) => ({
          key: o.id,
          label: o.label,
          icon: o.icon,
          onSelect: () => {
            onAdd(o.id);
            done();
          },
        }))
      : [];
  const name = query.trim();
  if (
    onCreate &&
    labels.create &&
    open &&
    ready &&
    name &&
    !options.some((o) => normalizeText(o.label) === normalizeText(name))
  ) {
    items.push({
      key: 'create',
      label: labels.create!(name),
      icon: <Plus size={18} className="m-1 text-accent-text" aria-hidden />,
      onSelect: () => void onCreate!(name).then(done),
    });
  }

  return (
    <section className="border-b border-border px-4 py-4" aria-label={title}>
      <h3 className="mb-2 font-extrabold">{title}</h3>
      <div className="flex flex-wrap items-center gap-2">
        {chosen.map((o) => (
          <span
            key={o.id}
            className="inline-flex items-center gap-1 rounded-full bg-surface-2 py-1 pr-1 pl-3 text-sm"
          >
            {renderChip ? renderChip(o) : o.label}
            <button
              type="button"
              aria-label={labels.remove(o.label)}
              onClick={() => onRemove(o.id)}
              className="rounded-full p-0.5 hover:bg-bg"
            >
              <X size={14} aria-hidden />
            </button>
          </span>
        ))}
        {open ? (
          <div className="relative w-56">
            <input
              ref={inputRef}
              role="combobox"
              aria-expanded={items.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={items.length ? `${listId}-${active}` : undefined}
              aria-label={labels.search}
              placeholder={labels.search}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (!handleListKeys(e, items, active, setActive, done) && e.key === 'Escape')
                  done();
              }}
              onBlur={(e) => {
                const el = e.currentTarget;
                setTimeout(() => document.activeElement !== el && done(), 150); // ignore if refocused
              }}
              className={`${inputClass} py-1.5 text-sm`}
            />
            <SuggestionList
              id={listId}
              label={t('composer.suggestions')}
              items={items}
              active={active}
              onHover={setActive}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setTimeout(() => inputRef.current?.focus());
            }}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-sm text-accent-text hover:bg-accent-tint"
          >
            <Plus size={14} aria-hidden /> {labels.add}
          </button>
        )}
      </div>
    </section>
  );
}
