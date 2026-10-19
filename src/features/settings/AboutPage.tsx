import { useTranslation } from 'react-i18next';
import { Placeholder } from '@/components/Placeholder';

export function AboutPage() {
  const { t } = useTranslation();
  return <Placeholder title={t('pages.about')} milestone={8} back />;
}
