import { buildIcs } from '@/domain/ics';
import { toIsoDate } from '@/domain/partialDate';
import {
  addDays,
  addRecurrence,
  nextRecurringDate,
  parseIsoDate,
  yearlyReminderDate,
} from '@/domain/recurrence';
import { dueReminders, effectiveDate, groupOf, needsNotification } from '@/domain/reminders';
import type { Reminder } from '@/domain/types';

const iso = (d: Date) => toIsoDate(d);
const day = (s: string) => parseIsoDate(s);

describe('addRecurrence (SPEC §8.5)', () => {
  it('clamps month ends', () => {
    expect(iso(addRecurrence(day('2026-01-31'), 'monthly'))).toBe('2026-02-28');
    expect(iso(addRecurrence(day('2028-01-31'), 'monthly'))).toBe('2028-02-29');
    expect(iso(addRecurrence(day('2026-12-31'), 'monthly', 2))).toBe('2027-02-28');
    expect(iso(addRecurrence(day('2026-03-31'), 'monthly', -1))).toBe('2026-02-28');
  });
  it('maps Feb 29 to Feb 28 in non-leap years', () => {
    expect(iso(addRecurrence(day('2028-02-29'), 'yearly'))).toBe('2029-02-28');
    expect(iso(addRecurrence(day('2028-02-29'), 'yearly', 4))).toBe('2032-02-29');
  });
  it('handles days and weeks across DST and year ends', () => {
    expect(iso(addRecurrence(day('2026-03-28'), 'daily', 2))).toBe('2026-03-30');
    expect(iso(addRecurrence(day('2026-12-28'), 'weekly'))).toBe('2027-01-04');
  });
});

describe('nextRecurringDate', () => {
  it('advances past today, at least once', () => {
    expect(nextRecurringDate('2026-03-18', 'yearly', 1, day('2026-03-18'))).toBe('2027-03-18');
    expect(nextRecurringDate('2026-10-01', 'daily', 1, day('2026-10-19'))).toBe('2026-10-20');
    expect(nextRecurringDate('2026-12-01', 'weekly', 2, day('2026-10-19'))).toBe('2026-12-15');
  });
});

describe('yearlyReminderDate', () => {
  it('subtracts the lead time and picks the next reminder on/after today', () => {
    const anniversary = { month: 6, day: 10 };
    expect(yearlyReminderDate(anniversary, 3, day('2026-06-01'))).toBe('2026-06-07');
    expect(yearlyReminderDate(anniversary, 3, day('2026-06-07'))).toBe('2026-06-07');
    expect(yearlyReminderDate(anniversary, 3, day('2026-06-07'), true)).toBe('2027-06-07');
    // Jan 2 − 5 days = Dec 28; on Dec 29 that has passed → next one is Dec 28, 2027.
    expect(yearlyReminderDate({ month: 1, day: 2 }, 5, day('2026-12-29'))).toBe('2027-12-28');
  });
  it('handles leads that cross into the previous year and Feb 29', () => {
    expect(yearlyReminderDate({ month: 1, day: 2 }, 5, day('2026-12-20'))).toBe('2026-12-28');
    expect(yearlyReminderDate({ month: 2, day: 29 }, 0, day('2026-01-01'))).toBe('2026-02-28');
  });
  it('addDays', () => {
    expect(addDays('2026-02-27', 2)).toBe('2026-03-01');
  });
});

const r = (over: Partial<Reminder>): Reminder => ({
  id: crypto.randomUUID(),
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  title: 'x',
  dueDate: '2026-10-19',
  recurrence: 'none',
  source: 'manual',
  ...over,
});

describe('reminder status', () => {
  const today = day('2026-10-19');
  it('groups by effective (snoozed) date', () => {
    expect(groupOf(r({ dueDate: '2026-10-18' }), today)).toBe('overdue');
    expect(groupOf(r({}), today)).toBe('today');
    expect(groupOf(r({ dueDate: '2026-10-25' }), today)).toBe('week');
    expect(groupOf(r({ dueDate: '2026-11-18' }), today)).toBe('month');
    expect(groupOf(r({ dueDate: '2026-12-25' }), today)).toBe('later');
    expect(groupOf(r({ dueDate: '2026-10-01', snoozedUntil: '2026-10-21' }), today)).toBe('week');
    expect(effectiveDate(r({ snoozedUntil: '2026-10-21' }))).toBe('2026-10-21');
  });
  it('counts due (today + overdue), excluding done, deleted and snoozed-later', () => {
    const list = [
      r({}),
      r({ dueDate: '2026-10-01' }),
      r({ dueDate: '2026-10-20' }),
      r({ completedAt: '2026-10-19T08:00:00.000Z' }),
      r({ deletedAt: '2026-10-19T08:00:00.000Z' }),
      r({ snoozedUntil: '2026-10-22' }),
    ];
    expect(dueReminders(list, today)).toHaveLength(2);
  });
  it('notifies once per due date', () => {
    expect(needsNotification(r({}), today)).toBe(true);
    expect(
      needsNotification(r({ lastNotifiedAt: new Date(2026, 9, 19, 8).toISOString() }), today),
    ).toBe(false);
    expect(
      needsNotification(
        r({
          dueDate: '2026-10-01',
          lastNotifiedAt: new Date(2026, 9, 1, 8).toISOString(),
          snoozedUntil: '2026-10-19',
        }),
        today,
      ),
    ).toBe(true);
    expect(needsNotification(r({ dueDate: '2026-10-20' }), today)).toBe(false);
  });
});

describe('buildIcs', () => {
  const ics = buildIcs(
    [
      {
        uid: 'a@kin',
        title: 'Élise Aubert, birthday; party',
        date: '2026-03-18',
        recurrence: 'yearly',
      },
      {
        uid: 'b@kin',
        title: 'Call mum',
        description: 'Line 1\nLine 2',
        date: '2026-10-20',
        time: '18:30',
        recurrence: 'weekly',
        interval: 2,
      },
    ],
    new Date('2026-10-19T12:00:00Z'),
  );
  it('produces RFC 5545 events with recurrence and alarms', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics).toContain('DTSTART;VALUE=DATE:20260318\r\n');
    expect(ics).toContain('RRULE:FREQ=YEARLY\r\n');
    expect(ics).toContain('SUMMARY:Élise Aubert\\, birthday\\; party\r\n');
    expect(ics).toContain('DTSTART:20261020T183000\r\n');
    expect(ics).toContain('RRULE:FREQ=WEEKLY;INTERVAL=2\r\n');
    expect(ics).toContain('DESCRIPTION:Line 1\\nLine 2\r\n');
    expect(ics).toContain('DTSTAMP:20261019T120000Z');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });
  it('folds long lines at 75 octets', () => {
    const long = buildIcs([
      { uid: 'x', title: 'é'.repeat(100), date: '2026-01-01', recurrence: 'none' },
    ]);
    for (const line of long.split('\r\n'))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
});
