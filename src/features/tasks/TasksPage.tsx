import { useTranslation } from 'react-i18next';
import { Placeholder } from '@/components/Placeholder';

export function TasksPage() {
  const { t } = useTranslation();
  return <Placeholder title={t('pages.tasks')} milestone={5} />;
}
