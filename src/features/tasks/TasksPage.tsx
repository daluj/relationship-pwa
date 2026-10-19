import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/PageHeader';
import { TaskList } from './TaskList';

/** `/tasks`: simple checklist across everyone (SPEC §6.7). */
export function TasksPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('pages.tasks')} />
      <TaskList />
    </>
  );
}
