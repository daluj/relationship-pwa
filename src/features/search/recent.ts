// Recent searches are a per-device convenience (ui §6.7), kept in localStorage.
const KEY = 'kin.recentSearches';
const MAX = 8;

export function getRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function write(list: string[]): string[] {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage unavailable — recent searches just won't persist.
  }
  return list;
}

export const addRecent = (q: string) => {
  const term = q.trim();
  if (!term) return getRecent();
  return write(
    [term, ...getRecent().filter((x) => x.toLowerCase() !== term.toLowerCase())].slice(0, MAX),
  );
};
export const removeRecent = (q: string) => write(getRecent().filter((x) => x !== q));
export const clearRecent = () => write([]);
