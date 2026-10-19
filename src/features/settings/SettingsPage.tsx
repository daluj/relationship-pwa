import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Check, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { settingsRepo, useSettings } from '@/db/repositories';
import { accents, fontSizes, locales, type Accent, type ThemePreference } from '@/domain/settings';

const themeOptions: ThemePreference[] = ['system', 'light', 'dim', 'lights-out'];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-border px-4 py-4">
      <h2 className="mb-3 text-lg font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

/** Settings › Display + Language (M1). Data, notifications, etc. arrive in later milestones. */
export function SettingsPage() {
  const { t } = useTranslation();
  const settings = useSettings();

  return (
    <>
      <PageHeader title={t('pages.settings')} />

      <Section title={t('settings.display')}>
        <fieldset className="mb-5">
          <legend className="mb-2 font-bold">{t('settings.theme')}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {themeOptions.map((opt) => (
              <label
                key={opt}
                className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-3 ${settings.theme === opt ? 'border-accent' : 'border-border'}`}
              >
                <input
                  type="radio"
                  name="theme"
                  value={opt}
                  checked={settings.theme === opt}
                  onChange={() => void settingsRepo.set('theme', opt)}
                  className="accent-[var(--accent)]"
                />
                {t(`settings.themes.${opt}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mb-5">
          <legend className="mb-2 font-bold">{t('settings.accent')}</legend>
          <div className="flex flex-wrap gap-3">
            {(Object.keys(accents) as Accent[]).map((key) => {
              const selected = settings.accent === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={selected}
                  aria-label={t(`settings.accents.${key}`)}
                  onClick={() => void settingsRepo.set('accent', key)}
                  className="flex h-11 w-11 items-center justify-center rounded-full"
                  style={{ backgroundColor: accents[key] }}
                >
                  {selected && <Check size={22} strokeWidth={3} color="#fff" aria-hidden />}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 font-bold">{t('settings.fontSize')}</legend>
          <div className="flex items-center gap-2">
            {fontSizes.map((size) => (
              <button
                key={size}
                type="button"
                aria-pressed={settings.fontSize === size}
                aria-label={t('settings.fontSizeValue', { size })}
                onClick={() => void settingsRepo.set('fontSize', size)}
                className={`h-10 flex-1 rounded-md border ${settings.fontSize === size ? 'border-accent bg-accent-tint font-bold' : 'border-border'}`}
                style={{ fontSize: size }}
              >
                Aa
              </button>
            ))}
          </div>
        </fieldset>
      </Section>

      <Section title={t('settings.language')}>
        <select
          value={settings.locale}
          onChange={(e) =>
            void settingsRepo.set('locale', e.target.value as (typeof locales)[number])
          }
          aria-label={t('settings.language')}
          className="w-full rounded-md border border-border bg-bg px-3 py-3"
        >
          {locales.map((l) => (
            <option key={l} value={l}>
              {t(`settings.languages.${l}`)}
            </option>
          ))}
        </select>
      </Section>

      <nav aria-label={t('settings.sections')}>
        {[
          { to: '/settings/data', label: t('pages.data') },
          { to: '/settings/trash', label: t('pages.trash') },
          { to: '/settings/about', label: t('pages.about') },
        ].map(({ to, label }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center justify-between border-b border-border px-4 py-4 hover:bg-surface-1"
          >
            {label} <ChevronRight size={18} className="text-muted" aria-hidden />
          </Link>
        ))}
      </nav>
    </>
  );
}
