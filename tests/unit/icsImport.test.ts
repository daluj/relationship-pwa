import fs from 'node:fs';
import path from 'node:path';
import { guessPersonFromTitle, parseIcs } from '@/domain/ics';

const fixture = (name: string) => fs.readFileSync(path.resolve('tests/fixtures', name), 'utf8');

describe('parseIcs (features §8.14 AC-1..3)', () => {
  it('reads yearly all-day events from a Google Calendar export', () => {
    const events = parseIcs(fixture('google.ics'));
    expect(events).toHaveLength(4);
    expect(events[0]).toEqual({
      title: "Marc's birthday",
      month: 3,
      day: 18,
      year: 1987,
      kind: 'birthday',
      name: 'Marc',
    });
    expect(events[1]).toMatchObject({
      title: 'Wedding anniversary, Élise & Marc', // escaped comma
      month: 6,
      day: 1,
      year: 2015,
      kind: 'date',
    });
    expect(events[1]!.skip).toBeUndefined();
  });

  it('skips timed events and one-off all-day events with a reason', () => {
    const [, , timed, oneOff] = parseIcs(fixture('google.ics'));
    expect(timed).toMatchObject({ title: 'Dinner with Zoé', skip: 'timed' });
    expect(oneOff).toMatchObject({ title: 'Team offsite', skip: 'not-yearly' });
  });

  it('handles Apple exports: CRLF, unknown year (1604), Feb 29, impossible dates, folded lines', () => {
    const events = parseIcs(fixture('apple.ics'));
    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({
      month: 2,
      day: 29,
      year: undefined,
      kind: 'birthday',
      name: 'Zoé',
    });
    expect(events[0]!.skip).toBeUndefined();
    expect(events[1]).toMatchObject({ title: "Marc's birthday", skip: 'invalid' }); // Feb 30
    expect(events[2]).toMatchObject({ skip: 'timed' });
    expect(events[2]!.title).toBe(
      'A very long folded title that goes on and on and on and on and on until it wraps over the line limit',
    );
  });

  it('accepts LF line endings and a BOM, and ignores events without a start or title', () => {
    const text =
      "\uFEFFBEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:20200105\nRRULE:FREQ=YEARLY\nSUMMARY:Anna\\'s birthday\nEND:VEVENT\nBEGIN:VEVENT\nSUMMARY:No start\nEND:VEVENT\nEND:VCALENDAR";
    const events = parseIcs(text);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ month: 1, day: 5, year: 2020, kind: 'birthday' });
    expect(events[1]).toMatchObject({ skip: 'invalid' });
  });

  it('returns nothing for text that is not a calendar', () => {
    expect(parseIcs('hello')).toEqual([]);
  });
});

describe('guessPersonFromTitle', () => {
  it.each([
    ["Marc's birthday", 'Marc'],
    ['Élise Aubert’s 40th Birthday', 'Élise Aubert'],
    ['Birthday: Zoé', 'Zoé'],
    ['Birthday of Léa', 'Léa'],
    ['Cumpleaños de Ana María', 'Ana María'],
    ['Anniversaire de Hugo', 'Hugo'],
    ['Geburtstag von Jan', 'Jan'],
    ['Marc - birthday', 'Marc'],
    ['🎂 Sofía’s birthday', 'Sofía'],
  ])('%s → %s', (title, name) => expect(guessPersonFromTitle(title)).toBe(name));
  it('returns undefined when no person can be read', () => {
    expect(guessPersonFromTitle('Birthday')).toBeUndefined();
    expect(guessPersonFromTitle('Team offsite')).toBeUndefined();
  });
});
