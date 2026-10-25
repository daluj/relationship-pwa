import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';

/** Only English ships in the first-load bundle; the other languages are separate chunks (tech-stack §10). */
export const localeLoaders = {
  es: () => import('./locales/es.json'),
  fr: () => import('./locales/fr.json'),
  de: () => import('./locales/de.json'),
  pt: () => import('./locales/pt.json'),
} as const;

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React escapes
  returnNull: false,
});

/**
 * Make sure `lng`'s strings are loaded. The chunks are precached by the service worker, so switching
 * language also works offline.
 */
export async function loadLocale(lng: string): Promise<void> {
  const load = localeLoaders[lng as keyof typeof localeLoaders];
  if (!load || i18n.hasResourceBundle(lng, 'translation')) return;
  const mod = await load();
  i18n.addResourceBundle(lng, 'translation', mod.default, true, true);
}

export default i18n;
