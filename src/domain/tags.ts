/** Key for case-insensitive tag uniqueness (SPEC §5.1). */
export function normalizeTagName(name: string): string {
  return name.trim().toLowerCase();
}
