import en from '@/i18n/locales/en.json';
import es from '@/i18n/locales/es.json';

const keys = (obj: object, prefix = ''): string[] =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v as object, `${prefix}${k}.`) : [`${prefix}${k}`],
  );

describe('locales (SPEC §12)', () => {
  it('es has exactly the same keys as en', () => {
    expect(keys(es).sort()).toEqual(keys(en).sort());
  });
});
