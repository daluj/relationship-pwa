import { filtersToParams } from '@/domain/searchFilters';
import type { SavedSearch } from '@/domain/types';

/** In-app URL that runs a saved search again. */
export const savedSearchPath = (s: Pick<SavedSearch, 'query' | 'filters'>) => {
  const p = filtersToParams(s.filters);
  if (s.query) p.set('q', s.query);
  return `/search?${p.toString()}`;
};
