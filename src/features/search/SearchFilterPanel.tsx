import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ListFilter } from 'lucide-react';
import { SelectField } from '@/components/form/SelectField';
import { inputClass } from '@/components/form/fieldClass';
import { listGroups, useLiveQuery } from '@/db/repositories';
import { momentKinds } from '@/domain/schemas';
import { hasAnyFilter } from '@/domain/searchFilters';
import type { MomentKind, SearchFilters } from '@/domain/types';
import { useLookup } from '@/features/moments/useLookup';

const staleOptions = [30, 60, 90, 180, 365];

interface Props {
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
}

const clean = (f: SearchFilters): SearchFilters =>
  Object.fromEntries(
    Object.entries(f).filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0)),
  );

/** Filters for Search (features §8.13): kind, dates, tag, group, "not contacted in N days". */
export function SearchFilterPanel({ filters, onChange }: Props) {
  const { t } = useTranslation();
  const lookup = useLookup();
  const groups = useLiveQuery(listGroups, []);
  const [open, setOpen] = useState(() => hasAnyFilter(filters));
  const panelId = useId();
  const set = (patch: Partial<SearchFilters>) => onChange(clean({ ...filters, ...patch }));
  const toggleKind = (k: MomentKind) =>
    set({
      kinds: filters.kinds?.includes(k)
        ? filters.kinds.filter((x) => x !== k)
        : [...(filters.kinds ?? []), k],
    });
  const count = Object.keys(clean(filters)).length;

  return (
    <div className="border-b border-border px-4 py-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm font-bold hover:bg-surface-2"
      >
        <ListFilter size={16} aria-hidden />
        {t('search.filters.title')}
        {count > 0 && (
          <span className="rounded-full bg-accent px-1.5 text-xs text-on-accent">{count}</span>
        )}
      </button>
      {open && (
        <div id={panelId} className="mt-3 flex flex-col gap-3 pb-2">
          <fieldset>
            <legend className="mb-1 text-sm font-bold text-muted">
              {t('search.filters.kinds')}
            </legend>
            <div className="flex flex-wrap gap-2">
              {momentKinds.map((k) => (
                <label
                  key={k}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-tint"
                >
                  <input
                    type="checkbox"
                    checked={!!filters.kinds?.includes(k)}
                    onChange={() => toggleKind(k)}
                  />
                  {t(`moment.kinds.${k}`)}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-bold text-muted">
              {t('search.filters.from')}
              <input
                type="date"
                value={filters.from ?? ''}
                max={filters.to}
                onChange={(e) => set({ from: e.target.value || undefined })}
                className={`${inputClass} mt-1 font-normal text-text`}
              />
            </label>
            <label className="text-sm font-bold text-muted">
              {t('search.filters.to')}
              <input
                type="date"
                value={filters.to ?? ''}
                min={filters.from}
                onChange={(e) => set({ to: e.target.value || undefined })}
                className={`${inputClass} mt-1 font-normal text-text`}
              />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SelectField
              label={t('search.filters.tag')}
              value={filters.tagIds?.[0] ?? ''}
              onChange={(e) => set({ tagIds: e.target.value ? [e.target.value] : undefined })}
              options={[
                { value: '', label: t('contactFilters.allTags') },
                ...lookup.tags.map((tag) => ({ value: tag.id, label: `#${tag.name}` })),
              ]}
            />
            <SelectField
              label={t('search.filters.group')}
              value={filters.groupIds?.[0] ?? ''}
              onChange={(e) => set({ groupIds: e.target.value ? [e.target.value] : undefined })}
              options={[
                { value: '', label: t('contactFilters.allGroups') },
                ...(groups ?? []).map((g) => ({
                  value: g.id,
                  label: `${g.emoji ?? ''} ${g.name}`.trim(),
                })),
              ]}
            />
            <SelectField
              label={t('search.filters.notContacted')}
              value={String(filters.notContactedDays ?? '')}
              onChange={(e) =>
                set({ notContactedDays: e.target.value ? Number(e.target.value) : undefined })
              }
              options={[
                { value: '', label: t('search.filters.anyTime') },
                ...staleOptions.map((d) => ({
                  value: String(d),
                  label: t('search.filters.days', { count: d }),
                })),
              ]}
            />
          </div>
          {count > 0 && (
            <button
              type="button"
              onClick={() => onChange({})}
              className="self-start text-sm font-bold text-accent-text hover:underline"
            >
              {t('search.filters.clear')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
