import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Fingerprint, Lock } from 'lucide-react';
import { setLockFlag, useLock } from '@/app/stores/lock';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import { inputClass } from '@/components/form/fieldClass';
import { settingsRepo, useSettings } from '@/db/repositories';
import { createPasskey, hashPin, passkeyAvailable, PIN_RE, verifyPin } from '@/lib/appLock';

const lockAfterOptions = [1, 5, 15, 60];

type Mode = 'set' | 'change' | 'off' | null;

/** Settings › App lock (features §8.10). Clearly a screen lock, not encryption. */
export function AppLockSection() {
  const { t } = useTranslation();
  const settings = useSettings();
  const config = settings.appLock;
  const lock = useLock((s) => s.lock);
  const [mode, setMode] = useState<Mode>(null);
  const [current, setCurrent] = useState('');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string>();
  const [canPasskey, setCanPasskey] = useState(false);
  useEffect(() => {
    void passkeyAvailable().then(setCanPasskey);
  }, []);

  const open = (m: Mode) => {
    setMode(m);
    setCurrent('');
    setPin('');
    setConfirm('');
    setError(undefined);
  };
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 6);

  const save = async () => {
    if (
      (mode === 'change' || mode === 'off') &&
      !(config && (await verifyPin(current, config.pin)))
    ) {
      return setError(t('lock.wrongPin'));
    }
    if (mode === 'off') {
      await settingsRepo.remove('appLock');
      setLockFlag(false);
      return setMode(null);
    }
    if (!PIN_RE.test(pin)) return setError(t('lock.invalidPin'));
    if (pin !== confirm) return setError(t('lock.mismatch'));
    await settingsRepo.set('appLock', {
      pin: await hashPin(pin),
      passkey: config?.passkey,
      lockAfterMinutes: config?.lockAfterMinutes ?? 5,
    });
    setLockFlag(true);
    setMode(null);
  };

  const addPasskey = async () => {
    if (!config) return;
    try {
      await settingsRepo.set('appLock', { ...config, passkey: await createPasskey() });
    } catch {
      // cancelled
    }
  };

  const pinInput = (label: string, value: string, set: (v: string) => void, autoFocus = false) => (
    <label className="text-sm font-bold text-muted">
      {label}
      <input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => {
          set(digits(e.target.value));
          setError(undefined);
        }}
        className={`${inputClass} mt-1 font-normal tracking-[0.3em] text-text`}
      />
    </label>
  );

  return (
    <section className="border-b border-border px-4 py-4" aria-labelledby="lock-title">
      <h2 id="lock-title" className="mb-1 flex items-center gap-2 text-lg font-extrabold">
        <Lock size={18} aria-hidden /> {t('lock.title')}
        <span className="text-sm font-normal text-muted" data-testid="lock-status">
          · {config ? t('lock.on') : t('lock.off')}
        </span>
      </h2>
      <p className="mb-2 text-sm text-muted">{t('lock.intro')}</p>
      <p className="mb-3 text-sm text-muted">{t('lock.notEncryption')}</p>
      {!config ? (
        <Button size="sm" onClick={() => open('set')}>
          {t('lock.turnOn')}
        </Button>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => lock()}>
              {t('lock.lockNow')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => open('change')}>
              {t('lock.changePin')}
            </Button>
            {config.passkey ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void settingsRepo.set('appLock', { ...config, passkey: undefined })}
              >
                <Fingerprint size={16} aria-hidden /> {t('lock.removePasskey')}
              </Button>
            ) : (
              canPasskey && (
                <Button size="sm" variant="outline" onClick={() => void addPasskey()}>
                  <Fingerprint size={16} aria-hidden /> {t('lock.addPasskey')}
                </Button>
              )
            )}
            <Button size="sm" variant="danger" onClick={() => open('off')}>
              {t('lock.turnOff')}
            </Button>
          </div>
          <label className="text-sm font-bold text-muted">
            {t('lock.lockAfter')}
            <select
              value={config.lockAfterMinutes}
              onChange={(e) =>
                void settingsRepo.set('appLock', {
                  ...config,
                  lockAfterMinutes: Number(e.target.value),
                })
              }
              className={`${inputClass} mt-1 font-normal text-text`}
            >
              {lockAfterOptions.map((m) => (
                <option key={m} value={m}>
                  {t('lock.minutes', { count: m })}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <Dialog
        open={mode !== null}
        onClose={() => setMode(null)}
        title={mode === 'off' ? t('lock.offTitle') : t('lock.setTitle')}
        footer={
          <Button variant={mode === 'off' ? 'danger' : 'primary'} onClick={() => void save()}>
            {mode === 'off' ? t('lock.turnOff') : t('common.save')}
          </Button>
        }
      >
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {(mode === 'change' || mode === 'off') &&
            pinInput(t('lock.currentPin'), current, setCurrent, true)}
          {mode !== 'off' && pinInput(t('lock.pin'), pin, setPin, mode === 'set')}
          {mode !== 'off' && pinInput(t('lock.confirmPin'), confirm, setConfirm)}
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <button type="submit" hidden />
        </form>
      </Dialog>
    </section>
  );
}
