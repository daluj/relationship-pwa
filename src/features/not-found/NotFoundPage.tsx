import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('pages.notFound')} />
      <section className="px-8 py-12 text-center">
        <Link to="/" className="font-bold text-accent hover:underline">
          {t('placeholder.backHome')}
        </Link>
      </section>
    </>
  );
}
