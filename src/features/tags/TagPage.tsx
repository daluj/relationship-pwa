import { useTranslation } from 'react-i18next';
import { Placeholder } from '@/components/Placeholder';

export function TagPage() {
  const { t } = useTranslation();
  return <Placeholder title={t('pages.tag')} milestone={3} back />;
}
