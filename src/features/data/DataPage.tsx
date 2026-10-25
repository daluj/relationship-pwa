import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download, FileUp, Trash2 } from 'lucide-react';
import { useToasts } from '@/app/stores/toast';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import { PageHeader } from '@/components/PageHeader';
import { inputClass } from '@/components/form/fieldClass';
import { deleteAllData, useSettings } from '@/db/repositories';
import type { ParsedBackup } from '@/domain/backup';
import type { ParsedIcsEvent } from '@/domain/ics';
import type { ParsedContact } from '@/domain/parsedContact';
import { formatRelativeDay } from '@/domain/partialDate';
import { CsvMapping } from './CsvMapping';
import { downloadBackup, downloadCsv, downloadVCards } from './exporters';
import { IcsPreview } from './IcsPreview';
import { ImportPreview } from './ImportPreview';
import { ImportFileError, readImportFile } from './readImportFile';
import { RecentMerges } from './RecentMerges';
import { RestoreDialog } from './RestoreDialog';
import { StorageSection } from './StorageSection';
import { takeSharedFiles } from './sharedFiles';

type Step =
  | { kind: 'idle' }
  | { kind: 'csv'; headers: string[]; rows: string[][] }
  | { kind: 'preview'; contacts: ParsedContact[] }
  | { kind: 'ics'; events: ParsedIcsEvent[] };

const errorKey = (code: ImportFileError['code']) =>
  code === 'not-kin' || code === 'too-new' || code === 'invalid'
    ? (`restore.errors.${code}` as const)
    : code === 'empty'
      ? 'data.noContacts'
      : code === 'unsupported'
        ? 'data.unsupported'
        : 'data.readError';

/** Settings › Your data: export, import (file, drop, share target, file handler), delete all (features §8.9–8.10). */
export function DataPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const showToast = useToasts((s) => s.show);
  const settings = useSettings();
  const [params, setParams] = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);
  const [includePhotos, setIncludePhotos] = useState(true);
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const [backup, setBackup] = useState<ParsedBackup | null>(null);
  const [error, setError] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typed, setTyped] = useState('');

  const open = useCallback(
    async (file: File) => {
      setError(undefined);
      try {
        const f = await readImportFile(file);
        if (f.kind === 'backup') setBackup(f.backup);
        else if (f.kind === 'csv') setStep({ kind: 'csv', headers: f.headers, rows: f.rows });
        else if (f.kind === 'ics') setStep({ kind: 'ics', events: f.events });
        else setStep({ kind: 'preview', contacts: f.contacts });
      } catch (e) {
        setError(t(errorKey(e instanceof ImportFileError ? e.code : 'read')));
      }
    },
    [t],
  );

  // Files arriving via the Web Share Target (stored by the service worker) or the File Handling API.
  useEffect(() => {
    if (params.get('shared') === '1') {
      void takeSharedFiles().then((files) => {
        if (files[0]) {
          showToast({ message: t('data.sharedFile') });
          void open(files[0]);
        }
      });
      setParams({}, { replace: true });
    }
    const launchQueue = (
      window as unknown as {
        launchQueue?: { setConsumer: (cb: (p: { files: FileSystemFileHandle[] }) => void) => void };
      }
    ).launchQueue;
    launchQueue?.setConsumer(async ({ files }) => {
      if (files[0]) void open(await files[0].getFile());
    });
  }, [params, setParams, open, showToast, t]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void open(file);
  };

  const exportJson = async () => {
    if (await downloadBackup(includePhotos)) showToast({ message: t('data.exported') });
  };
  const word = t('data.deleteWord');
  const wipe = async () => {
    await deleteAllData();
    try {
      for (const k of Object.keys(localStorage))
        if (k.startsWith('kin.')) localStorage.removeItem(k);
    } catch {
      // ignore
    }
    setConfirmDelete(false);
    showToast({ message: t('data.deleted') });
    navigate('/', { replace: true });
  };

  if (step.kind === 'csv') {
    return (
      <>
        <PageHeader title={t('pages.data')} back />
        <CsvMapping
          headers={step.headers}
          rows={step.rows}
          onCancel={() => setStep({ kind: 'idle' })}
          onDone={(contacts) => setStep({ kind: 'preview', contacts })}
        />
      </>
    );
  }
  if (step.kind === 'ics') {
    return (
      <>
        <PageHeader title={t('pages.data')} back />
        <IcsPreview
          events={step.events}
          onCancel={() => setStep({ kind: 'idle' })}
          onDone={() => navigate('/contacts')}
        />
      </>
    );
  }
  if (step.kind === 'preview') {
    return (
      <>
        <PageHeader title={t('pages.data')} back />
        <ImportPreview
          contacts={step.contacts}
          onCancel={() => setStep({ kind: 'idle' })}
          onDone={() => navigate('/contacts')}
        />
      </>
    );
  }

  const section = 'border-b border-border px-4 py-5';
  return (
    <>
      <PageHeader title={t('pages.data')} back />

      <section className={section} aria-labelledby="backup-title">
        <h2 id="backup-title" className="mb-1 text-lg font-extrabold">
          {t('data.backup')}
        </h2>
        <p className="mb-3 text-sm text-muted">{t('data.backupIntro')}</p>
        <p className="mb-3 text-sm" data-testid="last-backup">
          {settings.lastBackupAt
            ? t('data.lastBackup', {
                relative: formatRelativeDay(
                  new Date(settings.lastBackupAt),
                  new Date(),
                  i18n.language,
                ),
              })
            : t('data.neverBackedUp')}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void exportJson()}>
            <Download size={16} aria-hidden /> {t('data.exportJson')}
          </Button>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includePhotos}
              onChange={(e) => setIncludePhotos(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            {t('data.includePhotos')}
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void downloadVCards()}>
            {t('data.exportVcf')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void downloadCsv()}>
            {t('data.exportCsv')}
          </Button>
        </div>
      </section>

      <section className={section} aria-labelledby="import-title">
        <h2 id="import-title" className="mb-1 text-lg font-extrabold">
          {t('data.import')}
        </h2>
        <p className="mb-3 text-sm text-muted">{t('data.importIntro')}</p>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          data-testid="drop-zone"
          className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center ${dragging ? 'border-accent bg-accent-tint' : 'border-border'}`}
        >
          <FileUp size={28} className="text-muted" aria-hidden />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            {t('data.chooseFile')}
          </Button>
          <p className="text-sm text-muted">{t('data.dropHere')}</p>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.vcf,.vcard,.csv,.ics,application/json,text/vcard,text/csv,text/calendar"
            aria-label={t('data.chooseFile')}
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void open(f);
            }}
          />
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
      </section>

      <RecentMerges className={section} />

      <StorageSection />

      <section className={section} aria-labelledby="danger-title">
        <h2 id="danger-title" className="mb-1 text-lg font-extrabold text-danger">
          {t('data.danger')}
        </h2>
        <p className="mb-3 text-sm text-muted">{t('data.deleteAllIntro')}</p>
        <Button variant="danger" onClick={() => setConfirmDelete(true)}>
          <Trash2 size={16} aria-hidden /> {t('data.deleteAll')}
        </Button>
      </section>

      <RestoreDialog backup={backup} onClose={() => setBackup(null)} />
      <Dialog
        open={confirmDelete}
        onClose={() => {
          setConfirmDelete(false);
          setTyped('');
        }}
        title={t('data.deleteConfirmTitle')}
        footer={
          <Button variant="danger" disabled={typed.trim() !== word} onClick={() => void wipe()}>
            {t('data.deleteAll')}
          </Button>
        }
      >
        <p className="mb-3 text-muted">{t('data.deleteConfirmBody', { word })}</p>
        <input
          aria-label={t('data.typeToConfirm', { word })}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          className={inputClass}
        />
      </Dialog>
    </>
  );
}
