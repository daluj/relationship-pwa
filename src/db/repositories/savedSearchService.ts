// Saved searches (features §8.13): a name plus the query and filters to run again.
import type { SavedSearch, SearchFilters } from '@/domain/types';
import { savedSearchRepo } from './entities';

export async function listSavedSearches(): Promise<SavedSearch[]> {
  return (await savedSearchRepo.list()).sort((a, b) => a.name.localeCompare(b.name));
}

export const saveSearch = (name: string, query: string, filters: SearchFilters) =>
  savedSearchRepo.create({ name, query: query.trim(), filters });

export const renameSavedSearch = (id: string, name: string) => savedSearchRepo.update(id, { name });
export const deleteSavedSearch = (id: string) => savedSearchRepo.softDelete(id);
export const restoreSavedSearch = (id: string) => savedSearchRepo.restore(id);
