// Kept apart from exporters.ts so the profile menu doesn't pull the CSV library into the main bundle.
import { contactsForExport } from '@/db/repositories';
import { fullName } from '@/domain/contact';
import { toIsoDate } from '@/domain/partialDate';
import { serializeVCard } from '@/domain/vcard';
import { blobToBase64 } from '@/lib/base64';
import { saveFile } from '@/lib/download';

const safeName = (s: string) => s.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'contact';

async function vcards(ids?: string[]): Promise<{ text: string; first?: string }> {
  const rows = await contactsForExport(ids);
  const cards = await Promise.all(
    rows.map(async (r) =>
      serializeVCard({
        contact: r.contact,
        fields: r.fields,
        addresses: r.addresses,
        photo: r.avatar
          ? { mime: r.avatar.mime, base64: await blobToBase64(r.avatar.data) }
          : undefined,
      }),
    ),
  );
  return { text: cards.join(''), first: rows[0] && fullName(rows[0].contact) };
}

/** vCard export: one contact (profile menu) or everyone (SPEC §8.9). */
export async function downloadVCards(ids?: string[]): Promise<boolean> {
  const { text, first } = await vcards(ids);
  const name =
    ids?.length === 1 && first ? safeName(first) : `kin-contacts-${toIsoDate(new Date())}`;
  return saveFile(`${name}.vcf`, 'text/vcard', text);
}
