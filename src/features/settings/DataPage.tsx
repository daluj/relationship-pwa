import { useTranslation } from 'react-i18next';
import { Placeholder } from '@/components/Placeholder';

export function DataPage() {
  const { t } = useTranslation();
  return <Placeholder title={t('pages.data')} milestone={7} back />;
}
