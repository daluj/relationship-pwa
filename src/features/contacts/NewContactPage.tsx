import { useTranslation } from 'react-i18next';
import { Placeholder } from '@/components/Placeholder';

export function NewContactPage() {
  const { t } = useTranslation();
  return <Placeholder title={t('pages.newContact')} milestone={2} back />;
}
