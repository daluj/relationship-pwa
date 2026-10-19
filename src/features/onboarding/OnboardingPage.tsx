import { useTranslation } from 'react-i18next';
import { Placeholder } from '@/components/Placeholder';

export function OnboardingPage() {
  const { t } = useTranslation();
  return <Placeholder title={t('pages.onboarding')} milestone={8} />;
}
