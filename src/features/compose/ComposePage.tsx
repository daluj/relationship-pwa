import { useTranslation } from 'react-i18next';
import { Placeholder } from '@/components/Placeholder';

export function ComposePage() {
  const { t } = useTranslation();
  return <Placeholder title={t('pages.compose')} milestone={3} back />;
}
