import type { Reminder } from './types';

/** One calendar event per reminder (SPEC §8.5 "Export to calendar"). */
export interface IcsEvent {
  uid: string;
  title: string;
  description?: string;
  /** `YYYY-MM-DD` */
  date: string;
  /** `HH:mm`, local (floating) time; all-day when absent. */
  time?: string;
  recurrence: Reminder['recurrence'];
  interval?: number;
}

const escapeText = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** RFC 5545 line folding at 75 octets (UTF-8 aware). */
function fold(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = '';
  for (const ch of line) {
    const limit = out.length === 0 ? 75 : 74; // continuation lines start with a space
    if (enc.encode(cur + ch).length > limit) {
      out.push(cur);
      cur = ch;
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.join('\r\n ');
}

const compactDate = (d: string) => d.replace(/-/g, '');
const stamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

export function buildIcs(events: IcsEvent[], now = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kin//Personal CRM//EN',
    'CALSCALE:GREGORIAN',
  ];
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${stamp(now)}`);
    if (e.time) {
      const start = `${compactDate(e.date)}T${e.time.replace(':', '')}00`;
      lines.push(`DTSTART:${start}`, 'DURATION:PT30M');
    } else {
      lines.push(`DTSTART;VALUE=DATE:${compactDate(e.date)}`, 'DURATION:P1D');
    }
    if (e.recurrence !== 'none') {
      const interval = e.interval && e.interval > 1 ? `;INTERVAL=${e.interval}` : '';
      lines.push(`RRULE:FREQ=${e.recurrence.toUpperCase()}${interval}`);
    }
    lines.push(`SUMMARY:${escapeText(e.title)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    // Alert at the start (timed) or 09:00 on the day (all-day).
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(e.title)}`,
      `TRIGGER:${e.time ? 'PT0M' : 'PT9H'}`,
      'END:VALARM',
    );
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
