import type { ContactField } from './types';

const handle = (v: string) => v.trim().replace(/^@/, '');
const isHttpUrl = (v: string) => /^https?:\/\//i.test(v.trim());

function safeHttp(url: string): string | undefined {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Link for a contact field (SPEC §6.6 Details). Only http(s), tel: and mailto: are ever produced,
 * so user text can't become a `javascript:` URL.
 */
export function contactFieldHref(field: Pick<ContactField, 'type' | 'value'>): string | undefined {
  const v = field.value.trim();
  if (!v) return undefined;
  const social = (base: string) =>
    isHttpUrl(v) ? safeHttp(v) : safeHttp(base + encodeURIComponent(handle(v)));
  switch (field.type) {
    case 'phone':
      return `tel:${v.replace(/[^\d+]/g, '')}`;
    case 'email':
      return /^[^\s@]+@[^\s@]+$/.test(v) ? `mailto:${v}` : undefined;
    case 'website':
      return safeHttp(isHttpUrl(v) ? v : `https://${v}`);
    case 'whatsapp':
      return isHttpUrl(v) ? safeHttp(v) : `https://wa.me/${v.replace(/\D/g, '')}`;
    case 'telegram':
      return social('https://t.me/');
    case 'instagram':
      return social('https://instagram.com/');
    case 'linkedin':
      return social('https://www.linkedin.com/in/');
    case 'x':
      return social('https://x.com/');
    case 'facebook':
      return social('https://facebook.com/');
    case 'signal':
    case 'other':
      return isHttpUrl(v) ? safeHttp(v) : undefined;
  }
}
