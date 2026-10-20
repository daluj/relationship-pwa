import { Link } from 'react-router-dom';
import { fullName } from '@/domain/contact';
import { parseBody } from '@/domain/momentText';
import { useLookup } from './useLookup';

/**
 * Links inside running text are underlined, not only coloured, so they stay distinguishable from the
 * surrounding text in every theme (WCAG 1.4.1, axe "link-in-text-block").
 */
export const inTextLink =
  'text-accent-text underline decoration-1 underline-offset-2 decoration-current/40 hover:decoration-current';

/**
 * Renders a moment body: text, line breaks, @mentions, #tags and links. Everything is React text
 * nodes — no HTML injection (tech-stack §11). Missing contacts/tags fall back to the stored name as text.
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
                className={inTextLink}
              >
                {s.text}
              </a>
            );
          case 'mention': {
            const c = lookup.contact(s.id);
            return c ? (
              <Link key={i} to={`/c/${c.id}`} className={inTextLink}>
                @{fullName(c)}
              </Link>
            ) : (
              `@${s.name}`
            );
          }
          case 'tag': {
            const tag = lookup.tag(s.id);
            return tag ? (
              <Link key={i} to={`/tags/${tag.id}`} className={inTextLink}>
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
