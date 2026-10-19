import { useEffect, useLayoutEffect, useSyncExternalStore, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { purgeExpiredTrash, useSettingsQuery } from '@/db/repositories';
import { resolveTheme } from '@/domain/settings';
import i18n from '@/i18n';
import { applyTheme, computeTheme } from './theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function useSystemPrefersDark(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = matchMedia(DARK_QUERY);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => matchMedia(DARK_QUERY).matches,
  );
}

/** Keeps <html> theme, accent, font size, and language in sync with stored settings. */
function SettingsSync() {
  const settings = useSettingsQuery();
  const prefersDark = useSystemPrefersDark();

  useLayoutEffect(() => {
    if (!settings) return; // keep whatever theme-boot.js applied until settings load
    applyTheme(
      computeTheme(resolveTheme(settings.theme, prefersDark), settings.accent, settings.fontSize),
    );
  }, [settings, prefersDark]);

  useEffect(() => {
    if (!settings) return;
    document.documentElement.lang = settings.locale;
    if (i18n.language !== settings.locale) void i18n.changeLanguage(settings.locale);
  }, [settings]);

  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  // Trash keeps items for 30 days (SPEC §5.1); purge on every app start.
  useEffect(() => {
    void purgeExpiredTrash();
  }, []);

  return (
    <I18nextProvider i18n={i18n}>
      <SettingsSync />
      {children}
    </I18nextProvider>
  );
}
