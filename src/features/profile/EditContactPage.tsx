import { useTranslation } from 'react-i18next';
import { Placeholder } from '@/components/Placeholder';

export function EditContactPage() {
  const { t } = useTranslation();
  return <Placeholder title={t('pages.editContact')} milestone={2} back />;
}
