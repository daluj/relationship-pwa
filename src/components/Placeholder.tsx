import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PageHeader } from './PageHeader';

/** Stand-in screen for routes whose feature lands in a later milestone. */
export function Placeholder({
  title,
  milestone,
  back,
}: {
  title: string;
  milestone: number;
  back?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={title} back={back} />
      <section className="px-8 py-12 text-center">
        <p className="text-muted">{t('placeholder.comingIn', { milestone: `M${milestone}` })}</p>
        <Link to="/" className="mt-4 inline-block font-bold text-accent-text hover:underline">
          {t('placeholder.backHome')}
        </Link>
      </section>
    </>
  );
}
