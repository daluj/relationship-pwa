import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { useToasts } from '@/app/stores/toast';
import { Button } from '@/components/Button';
import { inputClass } from '@/components/form/fieldClass';
import { commitImport, knownContacts, type RowAction } from '@/db/repositories';
import { fullName } from '@/domain/contact';
import {
  candidateOf,
  findDuplicates,
  type DuplicateReason,
  type KnownContact,
} from '@/domain/duplicates';
import type { ParsedContact } from '@/domain/parsedContact';
import type { Contact } from '@/domain/types';
import { preparePhoto } from './preparePhoto';

interface Row {
  parsed: ParsedContact;
  existing?: { contact: Contact; reason: DuplicateReason };
  dupOfRow?: number;
}

/** Duplicate warnings against existing contacts and earlier rows of the same file (SPEC §8.2). */
function analyse(parsed: ParsedContact[], known: KnownContact[]): Row[] {
  const earlier: KnownContact[] = [];
  return parsed.map((p, i) => {
    const cand = candidateOf(fullName(p), p.fields);
    const existing = findDuplicates(cand, known)[0];
    const inFile = findDuplicates(cand, earlier)[0];
    earlier.push({
      contact: { id: String(i), firstName: p.firstName, lastName: p.lastName } as Contact,
      fields: p.fields,
    });
    return { parsed: p, existing, dupOfRow: inFile ? Number(inFile.contact.id) + 1 : undefined };
  });
}

const defaultAction = (r: Row): RowAction =>
  r.existing
    ? { kind: 'merge', into: r.existing.contact.id }
    : r.dupOfRow
      ? { kind: 'skip' }
      : { kind: 'import' };

const encode = (a: RowAction) => (a.kind === 'merge' ? `merge:${a.into}` : a.kind);
const decode = (v: string): RowAction =>
  v.startsWith('merge:') ? { kind: 'merge', into: v.slice(6) } : { kind: v as 'import' | 'skip' };

/** Review vCard/CSV contacts with per-row include / merge / skip before committing (SPEC §8.9). */
export function ImportPreview({
  contacts,
  onCancel,
  onDone,
}: {
  contacts: ParsedContact[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const showToast = useToasts((s) => s.show);
  const [rows, setRows] = useState<Row[]>();
  const [actions, setActions] = useState<RowAction[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void knownContacts().then((known) => {
      const analysed = analyse(contacts, known);
      setRows(analysed);
      setActions(analysed.map(defaultAction));
    });
  }, [contacts]);

  const count = useMemo(() => actions.filter((a) => a.kind !== 'skip').length, [actions]);
  if (!rows) return null;

  const commit = async () => {
    setBusy(true);
    try {
      const r = await commitImport(
        rows.map((row, i) => ({ parsed: row.parsed, action: actions[i]! })),
        { preparePhoto },
      );
      showToast({ message: t('importPreview.done', r) });
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="preview-title">
      <div className="border-b border-border px-4 py-3">
        <h2 id="preview-title" className="text-xl font-extrabold">
          {t('importPreview.title')}
        </h2>
        <p className="text-sm text-muted">{t('importPreview.intro', { count: rows.length })}</p>
      </div>
      <ul>
        {rows.map((row, i) => {
          const p = row.parsed;
          const name = fullName(p);
          const details = [
            ...p.fields.map((f) => f.value),
            p.company,
            p.note && t('importPreview.hasNote'),
            p.photo && t('importPreview.hasPhoto'),
          ].filter(Boolean);
          return (
            <li
              key={i}
              data-testid="import-row"
              className="flex flex-wrap items-start gap-3 border-b border-border px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-bold">{name}</p>
                {details.length > 0 && (
                  <p className="truncate text-sm text-muted">{details.join(' · ')}</p>
                )}
                {(row.existing || row.dupOfRow) && (
                  <p className="mt-1 flex items-center gap-1 text-sm text-danger">
                    <AlertTriangle size={14} aria-hidden />
                    {row.existing
                      ? t('importPreview.dupExisting', {
                          name: fullName(row.existing.contact),
                          reason: t(`importPreview.reasons.${row.existing.reason}`),
                        })
                      : t('importPreview.dupInFile', { row: row.dupOfRow })}
                  </p>
                )}
              </div>
              <select
                aria-label={t('importPreview.action', { name })}
                value={encode(actions[i]!)}
                onChange={(e) =>
                  setActions((a) => a.map((x, j) => (j === i ? decode(e.target.value) : x)))
                }
                className={`${inputClass} w-auto py-1.5 text-sm`}
              >
                <option value="import">{t('importPreview.import')}</option>
                {row.existing && (
                  <option value={`merge:${row.existing.contact.id}`}>
                    {t('importPreview.mergeInto', { name: fullName(row.existing.contact) })}
                  </option>
                )}
                <option value="skip">{t('importPreview.skip')}</option>
              </select>
            </li>
          );
        })}
      </ul>
      <div className="flex justify-end gap-2 px-4 py-4">
        <Button variant="outline" onClick={onCancel} disabled={busy}>
          {t('importPreview.cancel')}
        </Button>
        <Button onClick={() => void commit()} disabled={busy || count === 0}>
          {busy ? t('importPreview.importing') : t('importPreview.commit', { count })}
        </Button>
      </div>
    </section>
  );
}
