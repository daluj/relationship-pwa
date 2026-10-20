import { useMemo, type ReactNode } from 'react';
import { contactRepo, listTags, useLiveList, useLiveQuery } from '@/db/repositories';
import { LookupContext, type Lookup } from './useLookup';

/**
 * One live query for all contacts and tags, shared by every moment card, so renamed contacts and
 * tags re-render everywhere without rewriting bodies (features §8.4, §8.8).
 */
export function EntityLookupProvider({ children }: { children: ReactNode }) {
  const contacts = useLiveList(contactRepo);
  const tags = useLiveQuery(listTags, []);
  const value = useMemo<Lookup>(() => {
    const c = new Map((contacts ?? []).map((x) => [x.id, x]));
    const t = new Map((tags ?? []).map((x) => [x.id, x]));
    return {
      loaded: contacts !== undefined && tags !== undefined,
      contacts: contacts ?? [],
      tags: tags ?? [],
      contact: (id) => c.get(id),
      tag: (id) => t.get(id),
    };
  }, [contacts, tags]);
  return <LookupContext.Provider value={value}>{children}</LookupContext.Provider>;
}
