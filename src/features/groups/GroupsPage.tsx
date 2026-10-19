import { useTranslation } from 'react-i18next';
import { Placeholder } from '@/components/Placeholder';

export function GroupsPage() {
  const { t } = useTranslation();
  return <Placeholder title={t('pages.groups')} milestone={5} />;
}
