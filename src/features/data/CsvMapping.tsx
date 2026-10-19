import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { inputClass } from '@/components/form/fieldClass';
import { autoMap, csvTargets, rowsToContacts, type CsvTarget } from '@/domain/csvMapping';
import type { ParsedContact } from '@/domain/parsedContact';

interface Props {
  headers: string[];
  rows: string[][];
  onCancel: () => void;
  onDone: (contacts: ParsedContact[]) => void;
}

/** CSV column-mapping step with auto-detected Google/Outlook headers (SPEC §8.9). */
export function CsvMapping({ headers, rows, onCancel, onDone }: Props) {
  const { t } = useTranslation();
  const [mapping, setMapping] = useState<CsvTarget[]>(() => autoMap(headers));
  const hasName = mapping.some(
    (m) => m === 'firstName' || m === 'fullName' || m === 'lastName' || m === 'email',
  );
  const sample = (i: number) => rows.map((r) => r[i]?.trim()).find(Boolean) ?? '';

  return (
    <section aria-labelledby="csv-title">
      <div className="border-b border-border px-4 py-3">
        <h2 id="csv-title" className="text-xl font-extrabold">
          {t('csv.title')}
        </h2>
        <p className="text-sm text-muted">{t('csv.intro')}</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th className="px-4 py-2 font-bold">{t('csv.column')}</th>
            <th className="hidden px-2 py-2 font-bold sm:table-cell">{t('csv.sample')}</th>
            <th className="px-4 py-2 font-bold">{t('csv.mapsTo')}</th>
          </tr>
        </thead>
        <tbody>
          {headers.map((h, i) => (
            <tr key={`${h}-${i}`} className="border-b border-border">
              <td className="px-4 py-2 font-bold">{h || `#${i + 1}`}</td>
              <td className="hidden max-w-40 truncate px-2 py-2 text-muted sm:table-cell">
                {sample(i)}
              </td>
              <td className="px-4 py-2">
                <select
                  aria-label={`${t('csv.mapsTo')}: ${h}`}
                  value={mapping[i]}
                  onChange={(e) =>
                    setMapping((m) =>
                      m.map((x, j) => (j === i ? (e.target.value as CsvTarget) : x)),
                    )
                  }
                  className={`${inputClass} py-1.5`}
                >
                  {csvTargets.map((target) => (
                    <option key={target} value={target}>
                      {t(`csv.targets.${target}`)}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!hasName && (
        <p role="alert" className="px-4 pt-3 text-sm text-danger">
          {t('csv.needName')}
        </p>
      )}
      <div className="flex justify-end gap-2 px-4 py-4">
        <Button variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button disabled={!hasName} onClick={() => onDone(rowsToContacts(rows, mapping))}>
          {t('csv.continue')}
        </Button>
      </div>
    </section>
  );
}
