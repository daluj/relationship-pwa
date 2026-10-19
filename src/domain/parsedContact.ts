import type { Address, ContactField, PartialDate } from './types';

/** A contact read from an import file (vCard or CSV), before it is saved (SPEC §8.9). */
export interface ParsedContact {
  firstName: string;
  lastName?: string;
  nickname?: string;
  birthday?: PartialDate;
  company?: string;
  jobTitle?: string;
  /** NOTE / Notes — becomes a note moment on import (SPEC §8.9). */
  note?: string;
  fields: Pick<ContactField, 'type' | 'label' | 'value'>[];
  addresses: Omit<Address, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'contactId'>[];
  /** Inline photo (vCard PHOTO base64). */
  photo?: { mime: string; base64: string };
}
