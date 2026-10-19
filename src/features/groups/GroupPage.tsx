import { useTranslation } from 'react-i18next';
import { Placeholder } from '@/components/Placeholder';

export function GroupPage() {
  const { t } = useTranslation();
  return <Placeholder title={t('pages.group')} milestone={5} back />;
}
