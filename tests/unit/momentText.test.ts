import {
  applyCompletion,
  bodyToDraft,
  bodyToPlainText,
  draftToBody,
  extractIds,
  findTrigger,
  mentionToken,
  parseBody,
  replaceEntity,
  tagToken,
} from '@/domain/momentText';
import { fuzzyFilter, fuzzyScore } from '@/domain/fuzzy';
import { shortRelative } from '@/domain/relativeTime';

const LISE = '11111111-1111-4111-8111-111111111111';
const MARC = '22222222-2222-4222-8222-222222222222';
const FAM = '33333333-3333-4333-8333-333333333333';

describe('tokens (SPEC §8.4)', () => {
  const body = `Coffee with ${mentionToken(LISE, 'Élise Aubert')} and ${mentionToken(MARC, 'Marc')} ${tagToken(FAM, 'family')}\nhttps://example.com/x.`;

  it('parses mentions, tags, links and text', () => {
    expect(parseBody(body)).toEqual([
      { type: 'text', text: 'Coffee with ' },
      { type: 'mention', id: LISE, name: 'Élise Aubert' },
      { type: 'text', text: ' and ' },
      { type: 'mention', id: MARC, name: 'Marc' },
      { type: 'text', text: ' ' },
      { type: 'tag', id: FAM, name: 'family' },
      { type: 'text', text: '\n' },
      { type: 'link', href: 'https://example.com/x', text: 'https://example.com/x' },
      { type: 'text', text: '.' },
    ]);
  });

  it('extracts unique ids', () => {
    expect(extractIds(`${body} ${mentionToken(LISE, 'x')}`)).toEqual({
      contactIds: [LISE, MARC],
      tagIds: [FAM],
    });
  });

  it('renders plain text with current names (rename without rewriting bodies)', () => {
    expect(
      bodyToPlainText(body, {
        contact: (id) => (id === LISE ? 'Lise A.' : undefined),
        tag: () => 'kin',
      }),
    ).toBe('Coffee with @Lise A. and @Marc #kin\nhttps://example.com/x.');
  });

  it('never treats HTML or javascript: as anything but text', () => {
    expect(parseBody('<img src=x onerror=alert(1)> javascript:alert(1)')).toEqual([
      { type: 'text', text: '<img src=x onerror=alert(1)> javascript:alert(1)' },
    ]);
  });

  it('keeps tokens with a mismatched sigil as text and sanitizes names', () => {
    expect(parseBody(`#[x](contact:${LISE})`)[0]).toEqual({
      type: 'text',
      text: `#[x](contact:${LISE})`,
    });
    expect(mentionToken(LISE, 'A [b]')).toBe(`@[A  b](contact:${LISE})`);
  });

  it('replaces entity references (tag merge)', () => {
    expect(replaceEntity(tagToken(FAM, 'family'), 'tag', FAM, MARC, 'kin')).toBe(
      tagToken(MARC, 'kin'),
    );
  });
});

describe('composer draft ⇄ body', () => {
  it('round-trips', () => {
    const body = `${mentionToken(LISE, 'Élise Aubert')} moved! ${tagToken(FAM, 'family')}`;
    const draft = bodyToDraft(body);
    expect(draft.text).toBe('@Élise Aubert moved! #family');
    expect(draftToBody(draft.text, draft.entities)).toBe(body);
  });

  it('prefers the longest display and respects word boundaries', () => {
    const entities = [
      { kind: 'contact' as const, id: LISE, display: '@Ana' },
      { kind: 'contact' as const, id: MARC, display: '@Ana López' },
    ];
    expect(draftToBody('@Ana López and @Ana and @Anabel', entities)).toBe(
      `${mentionToken(MARC, 'Ana López')} and ${mentionToken(LISE, 'Ana')} and @Anabel`,
    );
  });

  it('edited display text becomes plain text', () => {
    expect(
      draftToBody('@Élise Aub', [{ kind: 'contact', id: LISE, display: '@Élise Aubert' }]),
    ).toBe('@Élise Aub');
  });
});

describe('findTrigger / applyCompletion', () => {
  it('detects @ and # before the caret', () => {
    expect(findTrigger('hi @eli', 7)).toEqual({ sigil: '@', query: 'eli', start: 3 });
    expect(findTrigger('hi @Élise Au', 12)).toEqual({ sigil: '@', query: 'Élise Au', start: 3 });
    expect(findTrigger('#fam', 4)).toEqual({ sigil: '#', query: 'fam', start: 0 });
    expect(findTrigger('@', 1)).toEqual({ sigil: '@', query: '', start: 0 });
  });
  it('ignores emails, spaces after #, and finished words', () => {
    expect(findTrigger('mail a@b', 8)).toBeNull();
    expect(findTrigger('#fam ily', 8)).toBeNull();
    expect(findTrigger('@eli is here', 12)).toBeNull();
  });
  it('inserts the completion with a trailing space', () => {
    const t = findTrigger('hi @eli', 7)!;
    expect(applyCompletion('hi @eli', t, 7, '@Élise Aubert')).toEqual({
      text: 'hi @Élise Aubert ',
      caret: 17,
    });
  });
});

describe('fuzzy', () => {
  it('matches ignoring accents and case, prefix first', () => {
    expect(fuzzyScore('eli', 'Élise Aubert')).toBeGreaterThan(fuzzyScore('eli', 'Nathalie'));
    expect(fuzzyScore('aub', 'Élise Aubert')).toBeGreaterThan(0);
    expect(fuzzyScore('xyz', 'Élise')).toBe(0);
    const people = ['Marc', 'Élise Aubert', 'Eliot'];
    expect(fuzzyFilter(people, 'eli', (p) => [p])).toEqual(['Eliot', 'Élise Aubert']);
  });
});

describe('shortRelative (SPEC §12)', () => {
  const now = new Date('2026-10-19T12:00:00');
  it('is compact and localized', () => {
    expect(shortRelative(new Date('2026-10-19T10:00:00'), now, 'en')).toBe('2h ago');
    expect(shortRelative(new Date('2026-10-16T12:00:00'), now, 'es')).toBe('hace 3 d');
    expect(shortRelative(new Date('2026-03-18T12:00:00'), now, 'en')).toBe('Mar 18');
    expect(shortRelative(new Date('2024-03-18T12:00:00'), now, 'en')).toBe('Mar 18, 2024');
  });
});
