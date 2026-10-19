import { useTranslation } from 'react-i18next';
import { Placeholder } from '@/components/Placeholder';

export function ContactsPage() {
  const { t } = useTranslation();
  return <Placeholder title={t('pages.contacts')} milestone={2} />;
}
