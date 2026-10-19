import { useTranslation } from 'react-i18next';
import { Placeholder } from '@/components/Placeholder';

export function SearchPage() {
  const { t } = useTranslation();
  return <Placeholder title={t('pages.search')} milestone={6} />;
}
