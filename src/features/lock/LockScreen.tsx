import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Fingerprint, Lock } from 'lucide-react';
import { setLockFlag, useLock } from '@/app/stores/lock';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import { inputClass } from '@/components/form/fieldClass';
import { Logo } from '@/components/Logo';
import { deleteAllData } from '@/db/repositories';
import type { AppLockConfig } from '@/domain/appLock';
import {
  clearFailures,
  lockoutRemaining,
  recordFailure,
  unlockWithPasskey,
  verifyPin,
} from '@/lib/appLock';

/** Full-screen lock (features §8.10). `config` is undefined while settings are still loading. */
export function LockScreen({ config }: { config?: AppLockConfig }) {
  const { t } = useTranslation();
  const unlock = useLock((s) => s.unlock);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(() => lockoutRemaining());
  const [forgot, setForgot] = useState(false);
  const [typed, setTyped] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!wait) return;
    const id = setInterval(() => setWait(lockoutRemaining()), 500);
    return () => clearInterval(id);
  }, [wait]);

  const ok = () => {
    clearFailures();
    unlock();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!config || busy || lockoutRemaining()) return;
    setBusy(true);
    try {
      if (await verifyPin(pin, config.pin)) return ok();
      recordFailure();
      setPin('');
      setWait(lockoutRemaining());
      setError(t('lock.wrongPin'));
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const passkey = async () => {
    if (!config?.passkey) return;
    try {
      if (await unlockWithPasskey(config.passkey)) return ok();
    } catch {
      // cancelled or unavailable
    }
    setError(t('lock.passkeyFailed'));
  };

  const word = t('data.deleteWord');
  const reset = async () => {
    await deleteAllData();
    try {
      for (const k of Object.keys(localStorage))
        if (k.startsWith('kin.')) localStorage.removeItem(k);
    } catch {
      // ignore
    }
    setLockFlag(false);
    location.assign('/');
  };

  const seconds = Math.ceil(wait / 1000);
  return (
    <main
      id="main"
      className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-bg px-6 text-text"
      data-testid="lock-screen"
    >
      <Logo size={56} />
      <h1 className="flex items-center gap-2 text-2xl font-extrabold">
        <Lock size={22} aria-hidden /> {t('lock.locked')}
      </h1>
      <form onSubmit={(e) => void submit(e)} className="flex w-full max-w-xs flex-col gap-3">
        <label className="text-sm font-bold text-muted" htmlFor="lock-pin">
          {t('lock.enterPin')}
        </label>
        <input
          id="lock-pin"
          ref={inputRef}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          autoFocus
          value={pin}
          disabled={!config || seconds > 0}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, ''));
            setError(undefined);
          }}
          aria-invalid={!!error}
          aria-describedby="lock-error"
          className={`${inputClass} text-center text-2xl tracking-[0.5em]`}
        />
        <p id="lock-error" role="alert" className="min-h-5 text-sm text-danger">
          {seconds > 0 ? t('lock.tooMany', { seconds }) : error}
        </p>
        <Button type="submit" size="lg" disabled={!config || pin.length < 4 || busy || seconds > 0}>
          {t('lock.unlock')}
        </Button>
        {config?.passkey && (
          <Button variant="outline" onClick={() => void passkey()}>
            <Fingerprint size={18} aria-hidden /> {t('lock.usePasskey')}
          </Button>
        )}
      </form>
      <button
        type="button"
        onClick={() => setForgot(true)}
        className="text-sm text-accent-text hover:underline"
      >
        {t('lock.forgot')}
      </button>
      <Dialog
        open={forgot}
        onClose={() => setForgot(false)}
        title={t('lock.forgotTitle')}
        footer={
          <Button variant="danger" disabled={typed.trim() !== word} onClick={() => void reset()}>
            {t('lock.reset')}
          </Button>
        }
      >
        <p className="mb-3 text-muted">{t('lock.forgotBody', { word })}</p>
        <input
          aria-label={t('data.typeToConfirm', { word })}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          className={inputClass}
        />
      </Dialog>
    </main>
  );
}
