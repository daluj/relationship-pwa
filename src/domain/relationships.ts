import type { RelationshipType } from './types';

/**
 * A relationship row `from → to` with type T reads "to is from's T"
 * (e.g. Élise → Marc 'parent' = Marc is Élise's parent). DECISIONS D-041.
 */
const asymmetric: Partial<Record<RelationshipType, RelationshipType>> = {
  parent: 'child',
  child: 'parent',
  grandparent: 'grandchild',
  grandchild: 'grandparent',
  'uncle-aunt': 'nephew-niece',
  'nephew-niece': 'uncle-aunt',
  godparent: 'godchild',
  godchild: 'godparent',
  boss: 'subordinate',
  subordinate: 'boss',
  mentor: 'protege',
  protege: 'mentor',
};

/** Type of the auto-created inverse row (SPEC §8.3); symmetric types mirror. */
export const inverseOf = (t: RelationshipType): RelationshipType => asymmetric[t] ?? t;

export const relationshipGroups = ['family', 'love', 'friends', 'work', 'other'] as const;
export type RelationshipGroup = (typeof relationshipGroups)[number];

const groupOfType: Record<RelationshipType, RelationshipGroup> = {
  parent: 'family',
  child: 'family',
  sibling: 'family',
  grandparent: 'family',
  grandchild: 'family',
  'uncle-aunt': 'family',
  'nephew-niece': 'family',
  cousin: 'family',
  'in-law': 'family',
  godparent: 'family',
  godchild: 'family',
  partner: 'love',
  spouse: 'love',
  'ex-partner': 'love',
  date: 'love',
  friend: 'friends',
  'best-friend': 'friends',
  colleague: 'work',
  boss: 'work',
  subordinate: 'work',
  mentor: 'work',
  protege: 'work',
  neighbour: 'other',
  other: 'other',
};

/** Details grouping: Family / Love / Friends / Work / Other (SPEC §8.3). */
export const groupOfRelationship = (t: RelationshipType): RelationshipGroup => groupOfType[t];

/** Counts per group for the profile "Following/Followers"-style row (SPEC §6.6). */
export function countByGroup(
  types: RelationshipType[],
): Partial<Record<RelationshipGroup, number>> {
  const out: Partial<Record<RelationshipGroup, number>> = {};
  for (const t of types) {
    const g = groupOfType[t];
    out[g] = (out[g] ?? 0) + 1;
  }
  return out;
}
