import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/Avatar';
import { fullName } from '@/domain/contact';
import type { Contact } from '@/domain/types';

interface Props {
  contact: Contact;
  /** Right-side controls (rendered outside the link to avoid nested interactives). */
  actions?: ReactNode;
  badges?: ReactNode;
  secondary?: ReactNode;
  linkTo?: string | null;
}

/** X "Following"-style row: avatar, name, @nickname, bio snippet (ui §6.7). */
export function ContactRow({ contact, actions, badges, secondary, linkTo }: Props) {
  const name = fullName(contact);
  const body = (
    <>
      <Avatar contact={contact} size={40} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2">
          <span data-testid="contact-name" className="truncate font-bold">
            {name}
          </span>
          {badges}
        </p>
        {contact.nickname && <p className="truncate text-muted">@{contact.nickname}</p>}
        {secondary ?? (contact.bio && <p className="mt-1 line-clamp-2 text-sm">{contact.bio}</p>)}
      </div>
    </>
  );
  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-surface-1">
      {linkTo === null ? (
        <div className="flex min-w-0 flex-1 items-start gap-3">{body}</div>
      ) : (
        <Link to={linkTo ?? `/c/${contact.id}`} className="flex min-w-0 flex-1 items-start gap-3">
          {body}
        </Link>
      )}
      {actions}
    </div>
  );
}
