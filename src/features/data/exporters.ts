import Papa from 'papaparse';
import { contactsForExport } from '@/db/repositories';
import { contactToCsvRow, csvExportHeaders } from '@/domain/csvMapping';
import { toIsoDate } from '@/domain/partialDate';
import { saveFile } from '@/lib/download';

const stamp = () => toIsoDate(new Date());

/** CSV export of contacts (SPEC §8.9). */
export async function downloadCsv(): Promise<boolean> {
  const rows = await contactsForExport();
  const csv = Papa.unparse({
    fields: csvExportHeaders,
    data: rows.map((r) => contactToCsvRow(r.contact, r.fields, r.addresses[0])),
  });
  return saveFile(`kin-contacts-${stamp()}.csv`, 'text/csv', `\uFEFF${csv}`); // BOM: Excel reads UTF-8
}

export { downloadVCards } from './vcardExport';
export { downloadBackup } from './backupDownload';
