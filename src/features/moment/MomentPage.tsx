import { useTranslation } from 'react-i18next';
import { Placeholder } from '@/components/Placeholder';

export function MomentPage() {
  const { t } = useTranslation();
  return <Placeholder title={t('pages.moment')} milestone={3} back />;
}
