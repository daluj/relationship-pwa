/** Key for case-insensitive tag uniqueness (data-model §5.1). */
export function normalizeTagName(name: string): string {
  return name.trim().toLowerCase();
}
