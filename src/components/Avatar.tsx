import { useBlobUrl } from '@/db/repositories';
import { avatarColors, initials } from '@/domain/contact';
import type { Contact } from '@/domain/types';

interface Props {
  contact: Pick<Contact, 'id' | 'firstName' | 'lastName' | 'avatarBlobId'>;
  size?: number;
  className?: string;
  /** Overrides the stored avatar (e.g. an unsaved crop preview). */
  src?: string;
}

/** Photo avatar, or initials on a deterministic color (SPEC §8.2). Decorative: names sit beside it. */
export function Avatar({ contact, size = 40, className = '', src }: Props) {
  const stored = useBlobUrl(src ? undefined : contact.avatarBlobId);
  const url = src ?? stored;
  const style = { width: size, height: size };
  if (url) {
    return (
      <img
        src={url}
        alt=""
        aria-hidden
        style={style}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }
  const { bg, fg } = avatarColors(contact.id);
  return (
    <span
      aria-hidden
      style={{ ...style, backgroundColor: bg, color: fg, fontSize: size * 0.4 }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold select-none ${className}`}
    >
      {initials(contact)}
    </span>
  );
}
