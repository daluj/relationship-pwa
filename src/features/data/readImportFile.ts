import Papa from 'papaparse';
import { BackupError, parseBackup, type ParsedBackup } from '@/domain/backup';
import type { ParsedContact } from '@/domain/parsedContact';
import { parseIcs, type ParsedIcsEvent } from '@/domain/ics';
import { parseVCards } from '@/domain/vcard';

export type ImportFile =
  | { kind: 'backup'; backup: ParsedBackup }
  | { kind: 'contacts'; contacts: ParsedContact[]; source: 'vcf' }
  | { kind: 'csv'; headers: string[]; rows: string[][] }
  | { kind: 'ics'; events: ParsedIcsEvent[] };

export class ImportFileError extends Error {
  constructor(readonly code: 'unsupported' | 'read' | 'empty' | BackupError['code']) {
    super(code);
  }
}

const ext = (name: string) => name.toLowerCase().split('.').pop() ?? '';

/** Identify and parse an import file: Kin backup (.json), vCard (.vcf) or CSV (features §8.9). */
export async function readImportFile(file: File): Promise<ImportFile> {
  const e = ext(file.name);
  const type = file.type.toLowerCase();
  let text: string;
  try {
    text = await file.text();
  } catch {
    throw new ImportFileError('read');
  }
  // Fall back to sniffing the content when the name/type doesn't say (shared or renamed files).
  const head = text
    .replace(/^\uFEFF/, '')
    .trimStart()
    .slice(0, 20)
    .toUpperCase();
  const known =
    ['json', 'vcf', 'vcard', 'csv', 'ics'].includes(e) || /json|vcard|csv|calendar/.test(type);
  const sniffed = known
    ? undefined
    : head.startsWith('{')
      ? 'json'
      : head.startsWith('BEGIN:VCARD')
        ? 'vcf'
        : head.startsWith('BEGIN:VCALENDAR')
          ? 'ics'
          : undefined;

  if (e === 'json' || type === 'application/json' || sniffed === 'json') {
    try {
      return { kind: 'backup', backup: parseBackup(JSON.parse(text)) };
    } catch (err) {
      throw new ImportFileError(err instanceof BackupError ? err.code : 'not-kin');
    }
  }
  if (e === 'vcf' || e === 'vcard' || type.includes('vcard') || sniffed === 'vcf') {
    const contacts = parseVCards(text);
    if (!contacts.length) throw new ImportFileError('empty');
    return { kind: 'contacts', contacts, source: 'vcf' };
  }
  if (e === 'ics' || type === 'text/calendar' || sniffed === 'ics') {
    const events = parseIcs(text);
    if (!events.length) throw new ImportFileError('empty');
    return { kind: 'ics', events };
  }
  if (e === 'csv' || type === 'text/csv') {
    const result = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), { skipEmptyLines: 'greedy' });
    const [headers, ...rows] = result.data;
    if (!headers || !rows.length) throw new ImportFileError('empty');
    return { kind: 'csv', headers, rows };
  }
  throw new ImportFileError('unsupported');
}
