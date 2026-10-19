import {
  ageOn,
  formatPartialDate,
  formatRelativeDay,
  nextOccurrence,
  partialDateFromParts,
  toIsoDate,
} from '@/domain/partialDate';

const d = (s: string) => new Date(`${s}T12:00:00`);

describe('nextOccurrence', () => {
  it('returns today when the date is today', () => {
    expect(toIsoDate(nextOccurrence({ month: 3, day: 18 }, d('2026-03-18')))).toBe('2026-03-18');
  });
  it('rolls to next year once passed', () => {
    expect(toIsoDate(nextOccurrence({ month: 3, day: 18 }, d('2026-03-19')))).toBe('2027-03-18');
  });
  it('maps Feb 29 to Feb 28 in non-leap years and keeps it in leap years', () => {
    expect(toIsoDate(nextOccurrence({ month: 2, day: 29, year: 1992 }, d('2026-01-10')))).toBe(
      '2026-02-28',
    );
    expect(toIsoDate(nextOccurrence({ month: 2, day: 29 }, d('2028-01-10')))).toBe('2028-02-29');
  });
});

describe('ageOn', () => {
  it('counts whole years, birthday inclusive', () => {
    const pd = { year: 1987, month: 3, day: 18 };
    expect(ageOn(pd, d('2026-03-17'))).toBe(38);
    expect(ageOn(pd, d('2026-03-18'))).toBe(39);
  });
  it('is undefined without a year', () => {
    expect(ageOn({ month: 3, day: 18 }, d('2026-01-01'))).toBeUndefined();
  });
});

describe('formatting', () => {
  it('formats partial dates per locale', () => {
    expect(formatPartialDate({ month: 3, day: 18 }, 'en')).toBe('March 18');
    expect(formatPartialDate({ month: 3, day: 18, year: 1987 }, 'en')).toBe('March 18, 1987');
    expect(formatPartialDate({ month: 3, day: 18 }, 'es')).toBe('18 de marzo');
  });
  it('formats relative days and months', () => {
    expect(formatRelativeDay(d('2026-01-02'), d('2026-01-01'), 'en')).toBe('tomorrow');
    expect(formatRelativeDay(d('2026-01-13'), d('2026-01-01'), 'en')).toBe('in 12 days');
    expect(formatRelativeDay(d('2026-08-18'), d('2026-01-01'), 'en')).toBe('in 7 months');
    expect(formatRelativeDay(d('2026-01-01'), d('2026-01-01'), 'es')).toBe('hoy');
  });
});

describe('partialDateFromParts', () => {
  it('handles blank, partial and invalid input', () => {
    expect(partialDateFromParts('', '', '')).toBeNull();
    expect(partialDateFromParts('18', '3', '')).toEqual({ day: 18, month: 3 });
    expect(partialDateFromParts('18', '3', '1987')).toEqual({ day: 18, month: 3, year: 1987 });
    expect(partialDateFromParts('18', '', '')).toBe('invalid');
    expect(partialDateFromParts('31', '4', '')).toBe('invalid');
    expect(partialDateFromParts('29', '2', '2023')).toBe('invalid');
    expect(partialDateFromParts('29', '2', '')).toEqual({ day: 29, month: 2 });
  });
});
