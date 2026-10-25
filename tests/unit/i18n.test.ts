import de from '@/i18n/locales/de.json';
import en from '@/i18n/locales/en.json';
import es from '@/i18n/locales/es.json';
import fr from '@/i18n/locales/fr.json';
import pt from '@/i18n/locales/pt.json';
import { locales } from '@/domain/settings';
import i18n, { loadLocale, localeLoaders } from '@/i18n';

const keys = (obj: object, prefix = ''): string[] =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? keys(v as object, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );

const values = (obj: object): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === 'object' && !Array.isArray(v)
        ? Object.entries(values(v)).map(([k2, v2]) => [`${k}.${k2}`, v2])
        : [[k, v]],
    ),
  );

const placeholders = (s: unknown) =>
  typeof s === 'string' ? [...new Set(s.match(/\{\{\w+\}\}/g) ?? [])].sort() : [];

/** CLDR plural categories i18next needs per language: `many` exists for French and Portuguese. */
const pluralSuffixes: Record<string, string[]> = {
  en: ['one', 'other'],
  es: ['one', 'other'],
  de: ['one', 'other'],
  fr: ['one', 'many', 'other'],
  pt: ['one', 'many', 'other'],
};

const all = { en, es, fr, de, pt };

describe('locales (tech-stack §12, features §8.14 AC-6)', () => {
  it('every language in settings has a resource bundle', () => {
    expect(['en', ...Object.keys(localeLoaders)].sort()).toEqual([...locales].sort());
  });

  it('es has exactly the same keys as en', () => {
    expect(keys(es).sort()).toEqual(keys(en).sort());
  });

  it.each(['fr', 'de', 'pt'] as const)(
    '%s has every en key (plus plural forms) and nothing else',
    (lang) => {
      const base = new Set(keys(en));
      const got = new Set(keys(all[lang]));
      const wanted = new Set(base);
      if (pluralSuffixes[lang]!.includes('many')) {
        for (const k of base) if (k.endsWith('_other')) wanted.add(`${k.slice(0, -6)}_many`);
      }
      expect([...wanted].filter((k) => !got.has(k))).toEqual([]); // missing
      expect([...got].filter((k) => !wanted.has(k))).toEqual([]); // extra
    },
  );

  it.each(['es', 'fr', 'de', 'pt'] as const)('%s keeps the same {{placeholders}} as en', (lang) => {
    const en_ = values(en);
    const got = values(all[lang]);
    const bad = Object.keys(got).filter((k) => {
      const ref = en_[k.endsWith('_many') ? `${k.slice(0, -5)}_other` : k];
      return Array.isArray(ref) ? false : placeholders(ref).join() !== placeholders(got[k]).join();
    });
    expect(bad).toEqual([]);
  });

  it.each(['es', 'fr', 'de', 'pt'] as const)('%s has no empty strings and names itself', (lang) => {
    const empty = Object.entries(values(all[lang])).filter(([, v]) => v === '');
    expect(empty).toEqual([]);
    expect(Object.keys(all[lang].settings.languages).sort()).toEqual([...locales].sort());
  });

  it('template starter text keeps its trailing space in every language', () => {
    for (const lang of Object.values(all)) {
      for (const t of Object.values(lang.composer.templates)) {
        expect(t.text.endsWith(' ')).toBe(true);
      }
    }
  });

  it('non-English bundles load on demand and plural forms resolve (1, 2 and 1,000,000)', async () => {
    expect(i18n.hasResourceBundle('fr', 'translation')).toBe(false);
    for (const lng of ['fr', 'de', 'pt'] as const) {
      await loadLocale(lng);
      await i18n.changeLanguage(lng);
      for (const count of [1, 2, 1_000_000]) {
        const text = i18n.t('contacts.count', { count });
        expect(text, `${lng} ${count}`).toContain(String(count));
        expect(text).not.toContain('contacts.count');
      }
    }
    await i18n.changeLanguage('en');
  });
});
