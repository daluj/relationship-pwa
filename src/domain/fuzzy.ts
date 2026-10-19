/** Lowercase, diacritic-free form for matching ("Élise" → "elise"). */
export function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * Score how well `query` matches `candidate` (higher is better, 0 = no match).
 * Whole-string prefix > word prefix > substring > in-order subsequence.
 */
export function fuzzyScore(query: string, candidate: string): number {
  const q = normalizeText(query.trim());
  const c = normalizeText(candidate);
  if (!q) return 1;
  if (c.startsWith(q)) return 100 - Math.min(50, c.length - q.length);
  if (c.split(/[\s\-_.@]+/).some((w) => w.startsWith(q))) return 70;
  if (c.includes(q)) return 50;
  let i = 0;
  for (const ch of c) if (ch === q[i]) i++;
  return i === q.length ? 20 : 0;
}

/** Best matches first; each item may have several searchable strings. */
export function fuzzyFilter<T>(
  items: T[],
  query: string,
  keys: (item: T) => (string | undefined)[],
  limit = 8,
): T[] {
  return items
    .map((item) => ({
      item,
      score: Math.max(0, ...keys(item).map((k) => (k ? fuzzyScore(query, k) : 0))),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.item);
}
