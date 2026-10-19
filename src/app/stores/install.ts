import { create } from 'zustand';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallState {
  /** Chromium's deferred install prompt, when the app is installable and not yet installed. */
  deferred: BeforeInstallPromptEvent | null;
  /** iOS "Share → Add to Home Screen" instructions. */
  iosHelpOpen: boolean;
  install: () => Promise<boolean>;
}

/** Custom in-app install prompt (SPEC §9): capture `beforeinstallprompt`, show our own button. */
export const useInstall = create<InstallState>((set, get) => ({
  deferred: null,
  iosHelpOpen: false,
  install: async () => {
    const e = get().deferred;
    if (!e) return false;
    await e.prompt();
    const { outcome } = await e.userChoice;
    set({ deferred: null });
    return outcome === 'accepted';
  },
}));

/** Call once at start-up, before React renders, so the early event isn't missed. */
export function captureInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    useInstall.setState({ deferred: e as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => useInstall.setState({ deferred: null }));
}

export const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** iOS/iPadOS Safari, which has no install prompt: show "Share → Add to Home Screen" instead. */
export const isIosSafari = () => {
  const ua = navigator.userAgent;
  const ios =
    /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
};
