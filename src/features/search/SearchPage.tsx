import { useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Clock, Hash, Search, X } from 'lucide-react';
import { IconButton } from '@/components/IconButton';
import { Tabs } from '@/components/Tabs';
import { search, trendingTags, useLiveQuery, type SearchResults } from '@/db/repositories';
import { ContactRow } from '@/features/contacts/ContactRow';
import { Feed } from '@/features/moments/Feed';
import { addRecent, clearRecent, getRecent, removeRecent } from './recent';

const PAGE = 50;
const tabs = ['top', 'people', 'moments', 'tags'] as const;
type Tab = (typeof tabs)[number];

/** Runs a search and records its duration as a `kin-search` performance measure (SPEC §8.6 perf). */
async function timedSearch(q: string, limit: number): Promise<SearchResults> {
  const start = performance.now();
  const results = await search(q, limit);
  performance.measure('kin-search', { start, end: performance.now(), detail: { q } });
  return results;
}

/** `/search?q=`: Top · People · Moments · Tags; recent searches and tag trends when empty (SPEC §6.7). */
export function SearchPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const tab: Tab = (tabs as readonly string[]).includes(params.get('tab') ?? '')
    ? (params.get('tab') as Tab)
    : 'top';
  const [input, setInput] = useState(q);
  const [recent, setRecent] = useState(getRecent);
  const inputRef = useRef<HTMLInputElement>(null);

  // Typing updates the URL (debounced) so results are shareable within the app and survive reloads.
  useEffect(() => {
    if (input === q) return;
    const id = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (input.trim()) next.set('q', input);
      else next.delete('q');
      setParams(next, { replace: true });
    }, 120);
    return () => clearTimeout(id);
  }, [input, q, params, setParams]);

  // Keep the box in sync when navigating here with a new query (right-rail search).
  useEffect(() => setInput(q), [q]);
  useEffect(() => {
    if ((location.state as { commit?: boolean } | null)?.commit && q) setRecent(addRecent(q));
  }, [location.state, q]);

  const [limit, setLimit] = useState(PAGE);
  useEffect(() => setLimit(PAGE), [q]);
  const results = useLiveQuery(() => (q.trim() ? timedSearch(q, limit) : undefined), [q, limit]);
  const hasMore = !!results && results.moments.length < results.momentTotal;
  const loadMore = useCallback(() => hasMore && setLimit((l) => l + PAGE), [hasMore]);
  const trends = useLiveQuery(() => trendingTags(), []);

  const commit = () => setRecent(addRecent(input));
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    commit();
    setParams(input.trim() ? { q: input, ...(tab !== 'top' && { tab }) } : {}, { replace: true });
  };
  const onResultClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('a')) commit();
  };
  const setTab = (id: string) => {
    const next = new URLSearchParams(params);
    if (id === 'top') next.delete('tab');
    else next.set('tab', id);
    setParams(next, { replace: true });
  };

  const total = results ? results.contacts.length + results.momentTotal + results.tags.length : 0;

  return (
    <>
      <header className="sticky top-[53px] z-10 border-b border-border bg-bg/80 backdrop-blur-md md:top-0">
        <div className="flex items-center gap-3 px-4 py-1.5">
          <IconButton label={t('nav.back')} onClick={() => navigate(-1)} className="-ml-2">
            <ArrowLeft size={20} aria-hidden />
          </IconButton>
          <form role="search" onSubmit={onSubmit} className="flex-1">
            <label className="flex items-center gap-3 rounded-full border border-transparent bg-surface-2 px-4 py-2 focus-within:border-accent focus-within:bg-bg">
              <Search size={18} className="text-muted" aria-hidden />
              <h1 className="sr-only">{t('pages.search')}</h1>
              <input
                ref={inputRef}
                type="search"
                enterKeyHint="search"
                aria-label={t('search.label')}
                placeholder={t('search.placeholder')}
                value={input}
                autoFocus={!q}
                onChange={(e) => setInput(e.target.value)}
                className="w-full bg-transparent outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
              />
              {input && (
                <button
                  type="button"
                  aria-label={t('search.clear')}
                  onClick={() => {
                    setInput('');
                    inputRef.current?.focus();
                  }}
                  className="rounded-full bg-accent p-0.5 text-on-accent"
                >
                  <X size={14} aria-hidden />
                </button>
              )}
            </label>
          </form>
        </div>
        {q.trim() && (
          <Tabs
            label={t('pages.search')}
            items={tabs.map((id) => ({ id, label: t(`search.tabs.${id}`) }))}
            active={tab}
            onChange={setTab}
          />
        )}
      </header>

      {!q.trim() ? (
        <>
          {recent.length > 0 && (
            <section aria-labelledby="recent-searches" className="border-b border-border py-2">
              <div className="flex items-center justify-between px-4 py-2">
                <h2 id="recent-searches" className="text-xl font-extrabold">
                  {t('search.recent')}
                </h2>
                <button
                  type="button"
                  onClick={() => setRecent(clearRecent())}
                  className="text-sm font-bold text-accent hover:underline"
                >
                  {t('search.clearRecent')}
                </button>
              </div>
              <ul>
                {recent.map((r) => (
                  <li key={r} className="flex items-center gap-3 px-4 hover:bg-surface-1">
                    <Clock size={18} className="text-muted" aria-hidden />
                    <Link to={`/search?q=${encodeURIComponent(r)}`} className="flex-1 py-3">
                      {r}
                    </Link>
                    <IconButton
                      label={t('search.removeRecent', { q: r })}
                      onClick={() => setRecent(removeRecent(r))}
                    >
                      <X size={16} aria-hidden />
                    </IconButton>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section aria-labelledby="trends" className="py-2">
            <h2 id="trends" className="px-4 py-2 text-xl font-extrabold">
              {t('search.trends')}
            </h2>
            {trends && trends.length === 0 && (
              <p className="px-4 pb-4 text-muted">{t('search.trendsEmpty')}</p>
            )}
            <ul>
              {trends?.map(({ tag, count }) => (
                <li key={tag.id}>
                  <Link to={`/tags/${tag.id}`} className="block px-4 py-3 hover:bg-surface-1">
                    <p className="font-bold">#{tag.name}</p>
                    <p className="text-sm text-muted">{t('tags.moments', { count })}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : results && total === 0 ? (
        <div className="px-8 py-12 text-center">
          <p className="text-xl font-extrabold">{t('search.noResults', { q })}</p>
          <p className="mt-1 text-muted">{t('search.noResultsHint')}</p>
        </div>
      ) : results ? (
        <div onClick={onResultClick} data-testid="search-results">
          {(tab === 'top' || tab === 'people') && results.contacts.length > 0 && (
            <section aria-label={t('search.tabs.people')} className="border-b border-border">
              <ul>
                {(tab === 'top' ? results.contacts.slice(0, 3) : results.contacts).map((c) => (
                  <li key={c.id}>
                    <ContactRow
                      contact={c}
                      badges={
                        c.isArchived && (
                          <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-xs text-muted">
                            {t('contacts.archivedBadge')}
                          </span>
                        )
                      }
                    />
                  </li>
                ))}
              </ul>
              {tab === 'top' && results.contacts.length > 3 && (
                <button
                  type="button"
                  onClick={() => setTab('people')}
                  className="block w-full px-4 py-3 text-left text-accent hover:bg-surface-1"
                >
                  {t('search.showAllPeople')}
                </button>
              )}
            </section>
          )}
          {(tab === 'top' || tab === 'tags') && results.tags.length > 0 && (
            <section aria-label={t('search.tabs.tags')} className="border-b border-border">
              <ul>
                {(tab === 'top' ? results.tags.slice(0, 3) : results.tags).map((tag) => (
                  <li key={tag.id}>
                    <Link
                      to={`/tags/${tag.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-surface-1"
                    >
                      <Hash size={18} className="text-muted" aria-hidden />
                      <span className="font-bold">{tag.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {(tab === 'top' || tab === 'moments') && results.moments.length > 0 && (
            <section aria-label={t('search.tabs.moments')}>
              <Feed moments={results.moments} onEndReached={loadMore} />
            </section>
          )}
          {tab !== 'top' &&
            ((tab === 'people' && !results.contacts.length) ||
              (tab === 'moments' && !results.moments.length) ||
              (tab === 'tags' && !results.tags.length)) && (
              <p className="px-8 py-12 text-center text-muted">{t('search.noResults', { q })}</p>
            )}
        </div>
      ) : null}
    </>
  );
}
