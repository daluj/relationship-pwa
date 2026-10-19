import { useTranslation } from 'react-i18next';
import { Placeholder } from '@/components/Placeholder';

export function TrashPage() {
  const { t } = useTranslation();
  return <Placeholder title={t('pages.trash')} milestone={2} back />;
}
