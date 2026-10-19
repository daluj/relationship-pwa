import { useTranslation } from 'react-i18next';
import { Placeholder } from '@/components/Placeholder';

export function ProfilePage() {
  const { t } = useTranslation();
  return <Placeholder title={t('pages.profile')} milestone={2} back />;
}
