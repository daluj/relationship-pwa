import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';
import { PageHeader } from '@/components/PageHeader';
import { clearLog, formatLog, readLog } from '@/lib/diagnostics';
import { saveFile } from '@/lib/download';

/** Settings › About: what Kin is, privacy, and the local diagnostics log (tech-stack §11). */
export function AboutPage() {
  const { t } = useTranslation();
  const [log, setLog] = useState(readLog);
  const privacy = t('about.privacy', { returnObjects: true }) as string[];

  const exportLog = () =>
    void saveFile(
      `kin-diagnostics-${new Date().toISOString().slice(0, 10)}.txt`,
      'text/plain',
      formatLog(log, {
        app: `Kin ${__APP_VERSION__}`,
        userAgent: navigator.userAgent,
        exportedAt: new Date().toISOString(),
      }),
    );

  return (
    <>
      <PageHeader title={t('pages.about')} back />
      <section className="flex flex-col items-center gap-2 border-b border-border px-4 py-6 text-center">
        <Logo size={48} />
        <p className="text-xl font-extrabold">{t('app.name')}</p>
        <p className="text-sm text-muted" data-testid="app-version">
          {t('about.version', { version: __APP_VERSION__ })}
        </p>
        <p className="max-w-md">{t('about.what')}</p>
      </section>
      <section
        id="privacy"
        className="scroll-mt-28 border-b border-border px-4 py-5"
        aria-labelledby="privacy-title"
      >
        <h2 id="privacy-title" className="mb-2 text-lg font-extrabold">
          {t('about.privacyTitle')}
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          {privacy.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>
      <section className="px-4 py-5" aria-labelledby="diag-title">
        <h2 id="diag-title" className="mb-1 text-lg font-extrabold">
          {t('about.diagnosticsTitle')}
        </h2>
        <p className="mb-3 text-sm text-muted">{t('about.diagnosticsIntro')}</p>
        {log.length === 0 ? (
          <p className="mb-3 text-sm" data-testid="diagnostics-empty">
            {t('about.noErrors')}
          </p>
        ) : (
          <ol
            className="mb-3 max-h-64 overflow-auto rounded-md border border-border bg-surface-1 p-3 font-mono text-xs"
            data-testid="diagnostics-log"
          >
            {log
              .slice()
              .reverse()
              .map((e) => (
                <li key={e.at + e.message} className="mb-2 break-words">
                  <span className="text-muted">{e.at}</span> {e.message}
                </li>
              ))}
          </ol>
        )}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportLog}>
            <Download size={16} aria-hidden /> {t('about.exportLog')}
          </Button>
          {log.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                clearLog();
                setLog([]);
              }}
            >
              <Trash2 size={16} aria-hidden /> {t('about.clearLog')}
            </Button>
          )}
        </div>
      </section>
    </>
  );
}
