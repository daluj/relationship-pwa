import { db } from '@/db/db';
import {
  deleteContact,
  deleteMoment,
  deleteTag,
  findOrCreateTag,
  mergeTags,
  rebuildSearchIndex,
  renameTag,
  restoreContact,
  restoreMoment,
  saveContact,
  saveMoment,
  search,
  setContactTags,
  trendingTags,
  updateContactStatus,
} from '@/db/repositories';
import { mentionToken, tagToken } from '@/domain/momentText';
import { indexTokens, parseQuery, tokenize } from '@/domain/search';
import { resetDb } from './helpers';

beforeEach(resetDb);

const contact = (firstName: string, extra: Record<string, unknown> = {}) =>
  saveContact(undefined, { contact: { firstName, ...extra }, fields: [], addresses: [] });
const moment = (body: string, extra: Record<string, unknown> = {}) =>
  saveMoment(undefined, {
    kind: 'note',
    body,
    happenedAt: '2026-10-01T10:00:00.000Z',
    contactIds: [],
    photos: [],
    ...extra,
  });

describe('tokenizer (SPEC §8.6)', () => {
  it('lowercases, strips diacritics, splits on non-alphanumerics', () => {
    expect(tokenize('Élise Aubert, café-crème @Lyon!')).toEqual([
      'elise',
      'aubert',
      'cafe',
      'creme',
      'lyon',
    ]);
    expect(indexTokens('a b 7 de de lise@example.com')).toEqual([
      '7',
      'de',
      'lise',
      'example',
      'com',
    ]);
  });
  it('treats the last token as a prefix unless followed by a space', () => {
    expect(parseQuery('lyon cof')).toEqual({ exact: ['lyon'], prefix: 'cof' });
    expect(parseQuery('lyon cof ')).toEqual({ exact: ['lyon', 'cof'] });
    expect(parseQuery('l')).toEqual({ exact: ['l'] });
    expect(parseQuery('  ')).toEqual({ exact: [] });
  });
});

describe('search', () => {
  it('"eli" finds "Élise" (AC); people rank above moments', async () => {
    const e = await contact('Élise', { lastName: 'Aubert' });
    await contact('Marc');
    const m = await moment(`Lunch with ${mentionToken(e.id, 'Élise Aubert')}`);
    const r = await search('eli');
    expect(r.contacts.map((c) => c.firstName)).toEqual(['Élise']);
    expect(r.moments.map((x) => x.id)).toEqual([m.id]);
  });

  it('"lyon coffee" finds a moment containing both words, in any field (AC)', async () => {
    const both = await moment('Great coffee', { location: 'Lyon' });
    await moment('Coffee in Paris');
    await moment('Lyon trip');
    expect((await search('lyon coffee')).moments.map((m) => m.id)).toEqual([both.id]);
    expect((await search('LYON Cof')).moments.map((m) => m.id)).toEqual([both.id]);
    expect((await search('lyo coffee')).moments).toEqual([]); // only the last token is a prefix
  });

  it('indexes contact fields, addresses, work, notes and tags', async () => {
    const c = await saveContact(undefined, {
      contact: { firstName: 'Zoé', company: 'Le Petit Sud', bio: 'Climbs on weekends' },
      fields: [{ type: 'email', value: 'zoe@example.com' }],
      addresses: [{ city: 'Bordeaux', isCurrent: true }],
    });
    for (const q of ['petit sud', 'climbs', 'zoe@example', 'bordeaux']) {
      expect(
        (await search(q)).contacts.map((x) => x.id),
        q,
      ).toEqual([c.id]);
    }
    const tag = await findOrCreateTag('Climbing');
    await setContactTags(c.id, [tag.id]);
    expect((await search('climbing')).contacts.map((x) => x.id)).toEqual([c.id]);
  });

  it('keeps archived contacts searchable (sorted last); drops deleted ones until restored', async () => {
    const a = await contact('Anna');
    const b = await contact('Annabel');
    await updateContactStatus(a.id, { isArchived: true });
    expect((await search('ann')).contacts.map((c) => c.firstName)).toEqual(['Annabel', 'Anna']);
    await deleteContact(b.id);
    expect((await search('ann')).contacts.map((c) => c.firstName)).toEqual(['Anna']);
    await restoreContact(b.id);
    expect((await search('annabel')).contacts).toHaveLength(1);
  });

  it('updates with moment delete/restore and contact/tag renames', async () => {
    const c = await contact('Marc');
    const tag = await findOrCreateTag('family');
    const m = await moment(
      `Dinner with ${mentionToken(c.id, 'Marc')} ${tagToken(tag.id, 'family')}`,
    );
    await deleteMoment(m.id);
    expect((await search('dinner')).moments).toEqual([]);
    await restoreMoment(m.id);
    expect((await search('dinner')).moments).toHaveLength(1);

    await saveContact(c.id, { contact: { firstName: 'Marco' }, fields: [], addresses: [] });
    expect((await search('marco')).moments.map((x) => x.id)).toEqual([m.id]);

    await renameTag(tag.id, 'Familia');
    expect((await search('familia')).moments.map((x) => x.id)).toEqual([m.id]);
    expect((await search('family ')).moments).toEqual([]);

    const other = await findOrCreateTag('kin');
    await mergeTags(tag.id, other.id);
    expect((await search('kin')).moments.map((x) => x.id)).toEqual([m.id]);
    await deleteTag(other.id);
    // Deleted tags keep their words as plain text in the body, so the moment is still found by it.
    expect((await search('kin')).moments.map((x) => x.id)).toEqual([m.id]);
  });

  it('tags tab matches tag names; trends rank tags by moment count', async () => {
    const fam = await findOrCreateTag('family');
    const work = await findOrCreateTag('work');
    await moment(tagToken(fam.id, 'family'));
    await moment(tagToken(fam.id, 'family'));
    await moment(tagToken(work.id, 'work'));
    expect((await search('fam')).tags.map((t) => t.name)).toEqual(['family']);
    expect((await trendingTags()).map((x) => [x.tag.name, x.count])).toEqual([
      ['family', 2],
      ['work', 1],
    ]);
  });

  it('returns the newest page of moments plus the total, via either strategy', async () => {
    for (let i = 0; i < 60; i++) {
      await moment(`walk ${i}`, { happenedAt: new Date(Date.UTC(2026, 0, 1 + i)).toISOString() });
    }
    // 60 hits among 60 moments → walks the happenedAt index from the newest end.
    const many = await search('walk', 50);
    expect(many.momentTotal).toBe(60);
    expect(many.moments).toHaveLength(50);
    expect(many.moments[0]!.body).toBe('walk 59');
    expect(many.moments.at(-1)!.body).toBe('walk 10');
    // One hit → loads and sorts directly.
    const one = await search('walk 7 ', 50);
    expect(one.moments.map((m) => m.body)).toEqual(['walk 7']);
  });

  it('rebuildSearchIndex re-creates the index from data', async () => {
    await contact('Élise');
    await db.searchIndex.clear();
    expect((await search('elise')).contacts).toEqual([]);
    await rebuildSearchIndex();
    expect((await search('elise')).contacts).toHaveLength(1);
  });
});
