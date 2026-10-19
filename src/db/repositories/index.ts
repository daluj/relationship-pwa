// The only db/ entry point UI code may import (SPEC §4).
export * from './entities';
export { settingsRepo } from './settingsRepo';
export { blobRepo } from './blobRepo';
export { useLiveList, useLiveRecord, useSettings, useSettingsQuery } from './hooks';
export { DuplicateError, RecordNotFoundError, ValidationError } from './errors';
export type { CreateInput, UpdatePatch, Repository } from './createRepository';
export {
  contactDetails,
  deleteContact,
  listTrashedContacts,
  purgeContact,
  restoreContact,
  saveContact,
  TRASH_RETENTION_DAYS,
} from './contactService';
export type { ContactDraft, NewImage } from './contactService';
export { useBlobUrl } from './hooks';
/** Sanctioned way for UI to compose repository reads into a live query (SPEC §4). */
export { useLiveQuery } from 'dexie-react-hooks';
export { purgeExpiredTrash } from './trashService';
export {
  deleteMoment,
  feed,
  listTrashedMoments,
  momentsForContact,
  momentsForTag,
  purgeMoment,
  restoreMoment,
  saveMoment,
  setMomentDate,
  setMomentPinned,
  setMomentStarred,
  thumbId,
} from './momentService';
export type { MomentDraft, MomentPhotoDraft } from './momentService';
export { deleteTag, findOrCreateTag, listTags, mergeTags } from './tagService';
