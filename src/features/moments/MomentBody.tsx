import { Link } from 'react-router-dom';
import { fullName } from '@/domain/contact';
import { parseBody } from '@/domain/momentText';
import { useLookup } from './useLookup';

/**
 * Renders a moment body: text, line breaks, @mentions, #tags and links. Everything is React text
 * nodes — no HTML injection (SPEC §11). Missing contacts/tags fall back to the stored name as text.
 */
export function MomentBody({ body, className = '' }: { body: string; className?: string }) {
  const lookup = useLookup();
  return (
    <div className={`break-words whitespace-pre-wrap ${className}`}>
      {parseBody(body).map((s, i) => {
        switch (s.type) {
          case 'text':
            return s.text;
          case 'link':
            return (
              <a
                key={i}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-text hover:underline"
              >
                {s.text}
              </a>
            );
          case 'mention': {
            const c = lookup.contact(s.id);
            return c ? (
              <Link key={i} to={`/c/${c.id}`} className="text-accent-text hover:underline">
                @{fullName(c)}
              </Link>
            ) : (
              `@${s.name}`
            );
          }
          case 'tag': {
            const tag = lookup.tag(s.id);
            return tag ? (
              <Link key={i} to={`/tags/${tag.id}`} className="text-accent-text hover:underline">
                #{tag.name}
              </Link>
            ) : (
              `#${s.name}`
            );
          }
        }
      })}
    </div>
  );
}
