// The only db/ entry point UI code may import (tech-stack §4).
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
  updateContactStatus,
  TRASH_RETENTION_DAYS,
} from './contactService';
export type { ContactDraft, NewImage } from './contactService';
export { useBlobUrl } from './hooks';
/** Sanctioned way for UI to compose repository reads into a live query (tech-stack §4). */
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
export { deleteTag, findOrCreateTag, listTags, mergeTags, renameTag } from './tagService';
export {
  completeReminder,
  deleteImportantDate,
  deleteReminder,
  ensureAutoReminders,
  importantDatesFor,
  listReminders,
  markNotified,
  remindersFor,
  reopenReminder,
  restoreReminder,
  saveImportantDate,
  saveReminder,
  snoozeReminder,
} from './reminderService';
export type { ImportantDateDraft, ReminderDraft } from './reminderService';
export {
  deleteRelationship,
  relationshipsFor,
  restoreRelationship,
  saveRelationship,
} from './relationshipService';
export type { RelationshipDraft } from './relationshipService';
export {
  addToGroup,
  deleteGroup,
  groupMemberCounts,
  groupMembers,
  groupTimeline,
  listGroups,
  removeFromGroup,
  restoreGroup,
  saveGroup,
} from './groupService';
export type { GroupDraft } from './groupService';
export {
  debtsFor,
  giftsFor,
  listOpenDebts,
  listTasks,
  petsFor,
  saveDebt,
  saveGift,
  savePet,
  saveTask,
  setContactTags,
  setTaskDone,
  settleDebt,
  starredContacts,
  starredMoments,
  tasksFor,
} from './profileItems';
export type { DebtDraft, GiftDraft, PetDraft, TaskDraft } from './profileItems';
export { ensureSearchIndex, rebuildSearchIndex, search, trendingTags } from './searchService';
export type { SearchResults } from './searchService';
export { mergeContacts } from './mergeService';
export {
  dataSince,
  deleteAllData,
  exportBackup,
  hasAnyData,
  onboardingSnapshot,
  importBackup,
  recordCounts,
} from './backupService';
export type { ImportSummary } from './backupService';
export { commitImport, contactsForExport, knownContacts } from './importService';
export type { CommitOptions, RowAction } from './importService';
export { loadDemoData, removeDemoData } from './demoService';
export { getBrief, getMilestones, getOnThisDay } from './recallService';
export type { Brief, Milestone, OnThisDayGroup } from './recallService';
