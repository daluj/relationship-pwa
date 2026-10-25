import type { Reminder } from './types';

/** One calendar event per reminder (features §8.5 "Export to calendar"). */
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

// ── Import (features §8.14) ──────────────────────────────────────────────────

export type IcsSkipReason = 'not-yearly' | 'timed' | 'invalid';

/** A yearly all-day event read from an `.ics` file, ready for the import preview. */
export interface ParsedIcsEvent {
  title: string;
  month: number;
  day: number;
  /** Absent when the year is unknown (Apple uses 1604 or earlier for "no year"). */
  year?: number;
  /** `birthday` when the title says so, otherwise an anniversary-style important date. */
  kind: 'birthday' | 'date';
  /** Person guessed from a birthday title ("Marc's birthday" → "Marc"). */
  name?: string;
  /** Why the event cannot be imported; such rows are listed but never written. */
  skip?: IcsSkipReason;
}

/** Undo RFC 5545 line folding (CRLF or LF plus one space or tab). */
const unfold = (text: string) =>
  text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n|\r/g, '\n')
    .replace(/\n[ \t]/g, '');

const unescapeText = (s: string) =>
  s.replace(/\\([nN,;\\])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));

const birthdayWords =
  /birthday|cumplea[ñn]os|anniversaire|geburtstag|compleanno|anivers[áa]rio|🎂/i;

const birthdayPatterns: RegExp[] = [
  /^(.+?)['’]s\s+(?:\d+(?:st|nd|rd|th)\s+)?birthday\b/i,
  /^birthday\s*(?:of\s+)?[:\-–]\s*(.+)$/i,
  /^birthday\s+of\s+(.+)$/i,
  /^cumplea[ñn]os\s+(?:de\s+)?(.+)$/i,
  /^anniversaire\s+(?:de\s+)?(.+)$/i,
  /^geburtstag\s+(?:von\s+)?(.+)$/i,
  /^(.+?)\s*[-–:]\s*(?:birthday|cumplea[ñn]os)$/i,
];

/** "Marc's birthday", "Birthday: Marc", "Cumpleaños de Marc" → "Marc". */
export function guessPersonFromTitle(title: string): string | undefined {
  const clean = title.replace(/🎂|🎉|🎈/g, '').trim();
  for (const re of birthdayPatterns) {
    const m = re.exec(clean);
    const name = m?.[1]?.trim();
    if (name) return name;
  }
  return undefined;
}

function daysIn(month: number, year?: number): number {
  return new Date(year ?? 2000, month, 0).getDate();
}

/** Reads yearly all-day events; everything else is returned with a `skip` reason (AC-2, AC-3). */
export function parseIcs(text: string): ParsedIcsEvent[] {
  const events: ParsedIcsEvent[] = [];
  let current: Record<string, { params: string; value: string }> | null = null;
  for (const raw of unfold(text).split('\n')) {
    const line = raw.trimEnd();
    if (/^BEGIN:VEVENT$/i.test(line)) current = {};
    else if (/^END:VEVENT$/i.test(line)) {
      if (current) events.push(toEvent(current));
      current = null;
    } else if (current) {
      const colon = line.indexOf(':');
      if (colon < 1) continue;
      const [name = '', ...params] = line.slice(0, colon).split(';');
      current[name.toUpperCase()] ??= {
        params: params.join(';').toUpperCase(),
        value: line.slice(colon + 1),
      };
    }
  }
  return events;
}

function toEvent(props: Record<string, { params: string; value: string }>): ParsedIcsEvent {
  const title = unescapeText(props.SUMMARY?.value ?? '').trim();
  const kind = birthdayWords.test(title) ? 'birthday' : 'date';
  const base = {
    title,
    kind,
    name: kind === 'birthday' ? guessPersonFromTitle(title) : undefined,
  } as const;
  const bad = (skip: IcsSkipReason): ParsedIcsEvent => ({ ...base, month: 0, day: 0, skip });

  const start = props.DTSTART;
  const m = start ? /^(\d{4})(\d{2})(\d{2})(T.*)?$/.exec(start.value.trim()) : null;
  if (!title || !m) return bad('invalid');
  const [, y, mo, d, time] = m;
  const month = Number(mo);
  const day = Number(d);
  // A DATE value (or a bare date) is all-day; a time part makes it a timed event.
  if (time && !start!.params.includes('VALUE=DATE')) return { ...base, month, day, skip: 'timed' };
  const year = Number(y) >= 1900 ? Number(y) : undefined;
  if (month < 1 || month > 12 || day < 1 || day > daysIn(month, year)) return bad('invalid');
  const yearly = /(^|;)FREQ=YEARLY(;|$)/i.test(props.RRULE?.value ?? '');
  return { ...base, month, day, year, ...(!yearly && { skip: 'not-yearly' as const }) };
}
