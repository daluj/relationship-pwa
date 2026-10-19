import { useTranslation } from 'react-i18next';
import { Placeholder } from '@/components/Placeholder';

export function StarredPage() {
  const { t } = useTranslation();
  return <Placeholder title={t('pages.starred')} milestone={5} />;
}
