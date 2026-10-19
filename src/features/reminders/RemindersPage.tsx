import { useTranslation } from 'react-i18next';
import { Placeholder } from '@/components/Placeholder';

export function RemindersPage() {
  const { t } = useTranslation();
  return <Placeholder title={t('pages.reminders')} milestone={4} />;
}
