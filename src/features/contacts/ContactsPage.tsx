import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { CheckSquare, Star, UserPlus } from 'lucide-react';
import { buttonClass } from '@/components/buttonClass';
import { IconButton } from '@/components/IconButton';
import { PageHeader } from '@/components/PageHeader';
import { SelectField } from '@/components/form/SelectField';
import { contactRepo, listGroups, useLiveList, useLiveQuery } from '@/db/repositories';
import { useLookup } from '@/features/moments/useLookup';
import { fullName, sortContacts, sortLetter, type ContactSort } from '@/domain/contact';
import type { Contact } from '@/domain/types';
import { BulkBar } from './BulkBar';
import { ContactRow } from './ContactRow';

const sorts: ContactSort[] = ['az', 'recent-interaction', 'recently-added'];
const filters = ['all', 'starred', 'archived'] as const;
type Filter = (typeof filters)[number];

const applyFilter = (list: Contact[], f: Filter) =>
  list.filter((c) =>
    f === 'archived' ? c.isArchived : !c.isArchived && (f === 'all' || c.isStarred),
  );

/** Contacts list (ui §6.7): sort, filter, virtualized, A–Z jump on mobile. */
export function ContactsPage() {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const sort = (sorts as string[]).includes(params.get('sort') ?? '')
    ? (params.get('sort') as ContactSort)
    : 'az';
  const filter = (filters as readonly string[]).includes(params.get('filter') ?? '')
    ? (params.get('filter') as Filter)
    : 'all';
  const all = useLiveList(contactRepo);
  const lookup = useLookup();
  const groups = useLiveQuery(listGroups, []);
  const tagId = params.get('tag') ?? '';
  const groupId = params.get('group') ?? '';
  const visible = useMemo(
    () =>
      sortContacts(
        applyFilter(all ?? [], filter).filter(
          (c) => (!tagId || c.tagIds.includes(tagId)) && (!groupId || c.groupIds.includes(groupId)),
        ),
        sort,
        i18n.language,
      ),
    [all, filter, sort, i18n.language, tagId, groupId],
  );

  // Selection mode (features §8.13): Space toggles, Shift+click selects a range, Esc leaves.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const anchor = useRef<number>(-1);
  useEffect(() => {
    if (!selecting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[role="menu"]')) {
        setSelecting(false);
        setSelected(new Set());
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selecting]);
  const exitSelection = () => {
    setSelecting(false);
    setSelected(new Set());
    anchor.current = -1;
  };
  const toggle = (index: number, shift: boolean) => {
    setSelected((cur) => {
      const next = new Set(cur);
      const id = visible[index]!.id;
      if (shift && anchor.current >= 0) {
        const [a, b] = [anchor.current, index].sort((x, y) => x - y) as [number, number];
        const turnOn = !cur.has(id);
        for (let i = a; i <= b; i++) {
          if (turnOn) next.add(visible[i]!.id);
          else next.delete(visible[i]!.id);
        }
      } else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    anchor.current = index;
  };

  const setParam = (key: string, value: string, fallback: string) => {
    const next = new URLSearchParams(params);
    if (value === fallback) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader
        title={t('pages.contacts')}
        subtitle={all ? t('contacts.count', { count: visible.length }) : undefined}
        tabs={filters.map((f) => ({ id: f, label: t(`contacts.filter.${f}`) }))}
        activeTab={filter}
        onTabChange={(f) => setParam('filter', f, 'all')}
        actions={
          <>
            <button
              type="button"
              aria-pressed={selecting}
              onClick={() => (selecting ? exitSelection() : setSelecting(true))}
              className={buttonClass('outline', 'sm')}
            >
              <CheckSquare size={16} aria-hidden />
              <span className="hidden sm:inline">{t('bulk.select')}</span>
              <span className="sr-only sm:hidden">{t('bulk.select')}</span>
            </button>
            <Link to="/contacts/new" className={buttonClass('primary', 'sm')}>
              <UserPlus size={16} aria-hidden />
              <span className="hidden sm:inline">{t('contacts.new')}</span>
              <span className="sr-only sm:hidden">{t('contacts.new')}</span>
            </Link>
          </>
        }
      />
      {selecting && (
        <BulkBar
          ids={[...selected]}
          total={visible.length}
          onSelectAll={() => setSelected(new Set(visible.map((c) => c.id)))}
          onDone={exitSelection}
        />
      )}
      <div className="flex flex-wrap justify-end gap-2 border-b border-border px-4 py-2">
        {lookup.tags.length > 0 && (
          <SelectField
            label={t('contactFilters.tag')}
            hideLabel
            value={tagId}
            onChange={(e) => setParam('tag', e.target.value, '')}
            options={[
              { value: '', label: t('contactFilters.allTags') },
              ...lookup.tags.map((tag) => ({ value: tag.id, label: `#${tag.name}` })),
            ]}
            className="w-44"
          />
        )}
        {!!groups?.length && (
          <SelectField
            label={t('contactFilters.group')}
            hideLabel
            value={groupId}
            onChange={(e) => setParam('group', e.target.value, '')}
            options={[
              { value: '', label: t('contactFilters.allGroups') },
              ...groups.map((g) => ({ value: g.id, label: `${g.emoji ?? ''} ${g.name}`.trim() })),
            ]}
            className="w-44"
          />
        )}
        <SelectField
          label={t('contacts.sort.label')}
          hideLabel
          value={sort}
          onChange={(e) => setParam('sort', e.target.value, 'az')}
          options={sorts.map((s) => ({ value: s, label: t(`contacts.sort.${s}`) }))}
          className="w-56"
        />
      </div>
      {all && visible.length === 0 ? (
        <p className="px-8 py-12 text-center text-muted">
          {all.length === 0 ? t('contacts.empty') : t('contacts.emptyFiltered')}
        </p>
      ) : (
        <VirtualList
          contacts={visible}
          showJump={sort === 'az' && !selecting}
          selection={selecting ? { selected, onToggle: toggle } : undefined}
        />
      )}
    </>
  );
}

interface Selection {
  selected: ReadonlySet<string>;
  onToggle: (index: number, shift: boolean) => void;
}

function VirtualList({
  contacts,
  showJump,
  selection,
}: {
  contacts: Contact[];
  showJump: boolean;
  selection?: Selection;
}) {
  const { t } = useTranslation();
  const listRef = useRef<HTMLUListElement>(null);
  const [offset, setOffset] = useState(0);
  useLayoutEffect(() => setOffset(listRef.current?.offsetTop ?? 0), []);

  const virtualizer = useWindowVirtualizer({
    count: contacts.length,
    estimateSize: () => 72,
    overscan: 8,
    scrollMargin: offset,
    scrollPaddingStart: 120, // sticky headers
  });

  const letters = useMemo(() => {
    const first = new Map<string, number>();
    contacts.forEach((c, i) => {
      const l = sortLetter(c);
      if (!first.has(l)) first.set(l, i);
    });
    return [...first];
  }, [contacts]);

  return (
    <div className="relative">
      <ul ref={listRef} style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((item) => {
          const c = contacts[item.index]!;
          return (
            <li
              key={c.id}
              data-index={item.index}
              ref={virtualizer.measureElement}
              className="absolute inset-x-0 top-0"
              style={{
                transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)`,
              }}
            >
              <ContactRow
                contact={c}
                badges={
                  <>
                    {c.isArchived && <Badge>{t('contacts.archivedBadge')}</Badge>}
                    {c.isDeceased && <Badge>{t('contacts.deceasedBadge')}</Badge>}
                  </>
                }
                actions={selection ? undefined : <StarButton contact={c} />}
                select={
                  selection && {
                    checked: selection.selected.has(c.id),
                    label: t('bulk.selectContact', { name: fullName(c) }),
                    onToggle: (shift) => selection.onToggle(item.index, shift),
                  }
                }
              />
            </li>
          );
        })}
      </ul>
      {showJump && letters.length > 1 && (
        <nav
          aria-label={t('contacts.jumpTo')}
          className="fixed top-1/2 right-1 z-10 flex -translate-y-1/2 flex-col md:hidden"
        >
          {letters.map(([letter, index]) => (
            <button
              key={letter}
              type="button"
              aria-label={t('contacts.jumpLetter', { letter })}
              onClick={() => virtualizer.scrollToIndex(index, { align: 'start' })}
              className="px-1.5 py-0.5 text-[11px] font-bold text-accent-text"
            >
              {letter}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

function Badge({ children }: { children: string }) {
  return (
    <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-xs text-muted">
      {children}
    </span>
  );
}

export function StarButton({ contact }: { contact: Contact }) {
  const { t } = useTranslation();
  const name = fullName(contact);
  return (
    <IconButton
      label={t('contacts.star', { name })}
      aria-pressed={contact.isStarred}
      tone="accent"
      onClick={() => void contactRepo.update(contact.id, { isStarred: !contact.isStarred })}
      className={contact.isStarred ? 'text-accent-text' : 'text-muted'}
    >
      <Star size={18} fill={contact.isStarred ? 'currentColor' : 'none'} aria-hidden />
    </IconButton>
  );
}
