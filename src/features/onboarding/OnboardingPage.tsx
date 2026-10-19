import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Bell, FileUp, HardDrive, ShieldCheck, Sparkles, UserPlus } from 'lucide-react';
import { Button } from '@/components/Button';
import { InstallButton } from '@/components/InstallButton';
import { Logo } from '@/components/Logo';
import { loadDemoData, settingsRepo, useSettings } from '@/db/repositories';
import { locales, type ThemePreference } from '@/domain/settings';
import { notificationsSupported } from '@/features/reminders/notify';
import { markOnboarded } from './onboardingState';

const themes: ThemePreference[] = ['system', 'light', 'dim', 'lights-out'];
const STEPS = 5; // language, theme, storage, notifications, first contacts

type StorageState = 'idle' | 'granted' | 'denied' | 'unsupported';

/** First run (SPEC §8.1): welcome → language → theme → storage → notifications → first contacts. */
export function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const settings = useSettings();
  const [step, setStep] = useState(0);
  const [storage, setStorage] = useState<StorageState>('idle');
  const [notif, setNotif] = useState<NotificationPermission | 'unsupported'>(() =>
    notificationsSupported() ? Notification.permission : 'unsupported',
  );
  const [loadingDemo, setLoadingDemo] = useState(false);

  const finish = async (to: string) => {
    await markOnboarded();
    navigate(to, { replace: true });
  };
  const persist = async () => {
    if (!navigator.storage?.persist) return setStorage('unsupported');
    setStorage((await navigator.storage.persist()) ? 'granted' : 'denied');
  };
  const demo = async () => {
    setLoadingDemo(true);
    await loadDemoData(settings.locale);
    await finish('/');
  };

  const choice = (selected: boolean) =>
    `flex cursor-pointer items-center gap-3 rounded-xl border p-4 ${selected ? 'border-accent bg-accent-tint' : 'border-border hover:bg-surface-1'}`;

  const screens: ReactNode[] = [
    <section key="welcome" className="flex flex-col items-center gap-6 text-center">
      <Logo size={64} />
      <div>
        <h1 className="text-3xl font-extrabold">{t('onboarding.welcome')}</h1>
        <p className="mt-2 text-muted">{t('onboarding.tagline')}</p>
      </div>
      <ul className="flex flex-col gap-3 text-left">
        {(['local', 'install', 'backup'] as const).map((k, i) => {
          const Icon = [ShieldCheck, HardDrive, FileUp][i]!;
          return (
            <li key={k} className="flex items-start gap-3">
              <Icon size={20} className="mt-0.5 shrink-0 text-accent-text" aria-hidden />
              {t(`onboarding.points.${k}`)}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap justify-center gap-3">
        <InstallButton />
        <Button size="lg" onClick={() => setStep(1)}>
          {t('onboarding.start')}
        </Button>
      </div>
    </section>,

    <fieldset key="language" className="flex flex-col gap-3">
      <legend className="mb-3 text-2xl font-extrabold">{t('onboarding.languageTitle')}</legend>
      {locales.map((l) => (
        <label key={l} className={choice(settings.locale === l)}>
          <input
            type="radio"
            name="locale"
            checked={settings.locale === l}
            onChange={() => void settingsRepo.set('locale', l)}
            className="accent-[var(--accent)]"
          />
          {t(`settings.languages.${l}`)}
        </label>
      ))}
    </fieldset>,

    <fieldset key="theme" className="flex flex-col gap-3">
      <legend className="mb-3 text-2xl font-extrabold">{t('onboarding.themeTitle')}</legend>
      {themes.map((th) => (
        <label key={th} className={choice(settings.theme === th)}>
          <input
            type="radio"
            name="theme"
            checked={settings.theme === th}
            onChange={() => void settingsRepo.set('theme', th)}
            className="accent-[var(--accent)]"
          />
          {t(`settings.themes.${th}`)}
        </label>
      ))}
    </fieldset>,

    <section key="storage" className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold">{t('onboarding.storageTitle')}</h1>
      <p className="text-muted">{t('onboarding.storageBody')}</p>
      {storage === 'idle' ? (
        <Button className="self-start" onClick={() => void persist()}>
          <HardDrive size={16} aria-hidden /> {t('onboarding.storageButton')}
        </Button>
      ) : (
        <p role="status" className="font-bold">
          {t(
            `onboarding.storage${storage === 'granted' ? 'Granted' : storage === 'denied' ? 'Denied' : 'Unsupported'}`,
          )}
        </p>
      )}
    </section>,

    <section key="notifications" className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold">{t('onboarding.notificationsTitle')}</h1>
      <p className="text-muted">{t('onboarding.notificationsBody')}</p>
      <p className="text-sm text-muted">{t('notifications.honesty')}</p>
      {notif === 'default' ? (
        <Button
          className="self-start"
          onClick={() => void Notification.requestPermission().then(setNotif)}
        >
          <Bell size={16} aria-hidden /> {t('notifications.enable')}
        </Button>
      ) : (
        <p role="status" className="font-bold">
          {t(`notifications.status.${notif}`)}
        </p>
      )}
    </section>,

    <section key="contacts" className="flex flex-col gap-3">
      <h1 className="mb-2 text-2xl font-extrabold">{t('onboarding.contactsTitle')}</h1>
      <button type="button" className={choice(false)} onClick={() => void finish('/contacts/new')}>
        <UserPlus size={22} className="text-accent-text" aria-hidden />
        <span className="font-bold">{t('onboarding.addContact')}</span>
      </button>
      <button type="button" className={choice(false)} onClick={() => void finish('/settings/data')}>
        <FileUp size={22} className="text-accent-text" aria-hidden />
        <span className="text-left">
          <span className="block font-bold">{t('onboarding.importContacts')}</span>
          <span className="block text-sm text-muted">{t('onboarding.importHint')}</span>
        </span>
      </button>
      <button
        type="button"
        className={choice(false)}
        disabled={loadingDemo}
        onClick={() => void demo()}
      >
        <Sparkles size={22} className="text-accent-text" aria-hidden />
        <span className="text-left">
          <span className="block font-bold">
            {loadingDemo ? t('onboarding.loadingDemo') : t('onboarding.demo')}
          </span>
          <span className="block text-sm text-muted">{t('onboarding.demoHint')}</span>
        </span>
      </button>
      <Button variant="ghost" className="self-center" onClick={() => void finish('/')}>
        {t('onboarding.startEmpty')}
      </Button>
    </section>,
  ];

  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 py-10">
      {step > 0 && (
        <p className="mb-6 text-sm text-muted" aria-live="polite">
          {t('onboarding.step', { n: step, total: STEPS })}
        </p>
      )}
      <div className="flex-1">{screens[step]}</div>
      {step > 0 && (
        <nav
          className="mt-8 flex items-center justify-between"
          aria-label={t('onboarding.step', { n: step, total: STEPS })}
        >
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
            {t('onboarding.back')}
          </Button>
          {step < STEPS && (
            <Button onClick={() => setStep((s) => s + 1)}>{t('onboarding.next')}</Button>
          )}
        </nav>
      )}
    </main>
  );
}
