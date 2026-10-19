import { createContext, useContext } from 'react';
import type { Contact, Tag } from '@/domain/types';

export interface Lookup {
  contacts: Contact[];
  tags: Tag[];
  contact: (id: string) => Contact | undefined;
  tag: (id: string) => Tag | undefined;
}

export const LookupContext = createContext<Lookup | null>(null);

export function useLookup(): Lookup {
  const ctx = useContext(LookupContext);
  if (!ctx) throw new Error('useLookup must be used inside <EntityLookupProvider>');
  return ctx;
}
