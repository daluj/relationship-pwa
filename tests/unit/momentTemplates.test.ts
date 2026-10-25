import { applyTemplate, momentTemplateIds, momentTemplates } from '@/domain/momentTemplates';
import en from '@/i18n/locales/en.json';
import es from '@/i18n/locales/es.json';

describe('applyTemplate (features §8.12)', () => {
  it('sets kind and activity type and prefills the text when the body is empty (AC-1)', () => {
    expect(applyTemplate('', 'coffee', 'Coffee with ')).toEqual({
      kind: 'activity',
      activityType: 'coffee',
      callDirection: undefined,
      body: 'Coffee with ',
    });
  });
  it('treats whitespace-only text as empty', () => {
    expect(applyTemplate('  \n', 'meal', 'Meal with ').body).toBe('Meal with ');
  });
  it('never overwrites typed text but still applies kind and type (AC-2)', () => {
    const p = applyTemplate('Great talk about the move', 'visit', 'Visited ');
    expect(p.body).toBe('Great talk about the move');
    expect(p).toMatchObject({ kind: 'activity', activityType: 'visit' });
  });
  it('the call template makes an outgoing call', () => {
    expect(applyTemplate('', 'call', 'Call with ')).toMatchObject({
      kind: 'call',
      callDirection: 'outgoing',
    });
  });
  it('every template has a label and text in both locales', () => {
    for (const lang of [en, es]) {
      for (const id of momentTemplateIds) {
        expect(lang.composer.templates[id].label).toBeTruthy();
        expect(lang.composer.templates[id].text).toBeTruthy();
      }
    }
    expect(Object.keys(momentTemplates).sort()).toEqual([...momentTemplateIds].sort());
  });
});
