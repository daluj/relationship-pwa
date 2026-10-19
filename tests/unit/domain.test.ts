import { partialDateSchema } from '@/domain/schemas';
import { contrastRatio, onColor } from '@/domain/color';
import { accents, resolveTheme } from '@/domain/settings';
import { normalizeTagName } from '@/domain/tags';

describe('partialDateSchema', () => {
  it('accepts a date without a year, including Feb 29', () => {
    expect(partialDateSchema.safeParse({ month: 2, day: 29 }).success).toBe(true);
  });
  it('rejects Feb 29 in a non-leap year and impossible days', () => {
    expect(partialDateSchema.safeParse({ year: 2023, month: 2, day: 29 }).success).toBe(false);
    expect(partialDateSchema.safeParse({ month: 4, day: 31 }).success).toBe(false);
    expect(partialDateSchema.safeParse({ month: 13, day: 1 }).success).toBe(false);
  });
});

describe('resolveTheme', () => {
  it('follows prefers-color-scheme when set to system (dark → Lights out)', () => {
    expect(resolveTheme('system', true)).toBe('lights-out');
    expect(resolveTheme('system', false)).toBe('light');
  });
  it('respects an explicit choice', () => {
    expect(resolveTheme('dim', false)).toBe('dim');
  });
});

describe('normalizeTagName', () => {
  it('is case-insensitive and trims', () => {
    expect(normalizeTagName('  Family ')).toBe('family');
  });
});

describe('onColor / contrastRatio', () => {
  it('picks readable text for every accent (WCAG AA ≥ 4.5:1)', () => {
    for (const hex of Object.values(accents)) {
      expect(contrastRatio(hex, onColor(hex))).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('uses black on the default teal', () => {
    expect(onColor(accents.teal)).toBe('#000000');
  });
});
