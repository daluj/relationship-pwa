import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserPlus } from 'lucide-react';
import { inputClass } from '@/components/form/fieldClass';
import type { Contact } from '@/domain/types';
import { useLookup } from '@/features/moments/useLookup';
import { handleListKeys } from './listKeys';
import { SuggestionList } from './SuggestionList';
import { contactSuggestions } from './suggestions';

interface Props {
  contacts: Contact[];
  exclude: string[];
  onPick: (c: Contact) => void;
  /** Omit to hide "Create contact" (e.g. picking an existing contact to merge with). */
  onCreate?: (name: string) => Promise<void>;
}

/** Explicit "add person" picker next to the @mention flow (data-model §5.1 contactIds). */
export function PeoplePicker({ contacts, exclude, onPick, onCreate }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const done = () => {
    setQuery('');
    setOpen(false);
  };
  const { loaded } = useLookup();
  const items =
    open && loaded
      ? contactSuggestions(
          contacts,
          query,
          t,
          (c) => {
            onPick(c);
            done();
          },
          onCreate ? (name) => void onCreate(name).then(done) : undefined,
          exclude,
        )
      : [];

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus());
        }}
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-sm text-accent-text hover:bg-accent-tint"
      >
        <UserPlus size={14} aria-hidden /> {t('composer.addPerson')}
      </button>
    );
  }
  return (
    <div className="relative w-56">
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={items.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={items.length ? `${listId}-${active}` : undefined}
        aria-label={t('composer.searchPeople')}
        placeholder={t('composer.searchPeople')}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (!handleListKeys(e, items, active, setActive, done) && e.key === 'Escape') done();
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
  );
}
