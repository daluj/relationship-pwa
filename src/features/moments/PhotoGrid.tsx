import { useTranslation } from 'react-i18next';
import { thumbId, useBlobUrl } from '@/db/repositories';

function Photo({
  id,
  full,
  alt,
  className,
}: {
  id: string;
  full?: boolean;
  alt: string;
  className: string;
}) {
  const url = useBlobUrl(full ? id : thumbId(id));
  return url ? (
    <img src={url} alt={alt} loading="lazy" className={`h-full w-full object-cover ${className}`} />
  ) : (
    <div className={`h-full w-full bg-surface-2 ${className}`} />
  );
}

/** X-style photo grid: 1 / 2 side by side / 1+2 / 2×2 (ui §6.4). Feed uses thumbnails. */
export function PhotoGrid({ ids, full }: { ids: string[]; full?: boolean }) {
  const { t } = useTranslation();
  if (ids.length === 0) return null;
  const alt = (i: number) => t('moment.photoAlt', { n: i + 1, total: ids.length });
  if (ids.length === 1) {
    return (
      <div className="mt-3 overflow-hidden rounded-2xl border border-border">
        <Photo id={ids[0]!} full={full} alt={alt(0)} className="max-h-[510px]" />
      </div>
    );
  }
  return (
    <div
      className={`mt-3 grid aspect-video gap-0.5 overflow-hidden rounded-2xl border border-border ${ids.length === 2 ? 'grid-cols-2' : 'grid-cols-2 grid-rows-2'}`}
    >
      {ids.map((id, i) => (
        <div key={id} className={ids.length === 3 && i === 0 ? 'row-span-2' : ''}>
          <Photo id={id} full={full} alt={alt(i)} className="" />
        </div>
      ))}
    </div>
  );
}
