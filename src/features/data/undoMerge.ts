import type { TFunction } from 'i18next';
import { MergeUndoError, undoMerge } from '@/db/repositories';

/** Undo a merge and say what happened, including why it was refused (features §8.14 AC-4, AC-5). */
export async function undoMergeWithMessage(
  snapshotId: string,
  t: TFunction,
  show: (toast: { message: string }) => void,
): Promise<boolean> {
  try {
    await undoMerge(snapshotId);
    show({ message: t('merge.undone') });
    return true;
  } catch (e) {
    show({
      message: t(`merge.undoErrors.${e instanceof MergeUndoError ? e.code : 'changed'}`),
    });
    return false;
  }
}
