/** Original Kin mark: two overlapping rounded "people" shapes. */
export function Logo({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className={className}>
      <circle cx="12" cy="11" r="5" fill="var(--accent)" />
      <circle cx="21" cy="13" r="4" fill="var(--accent)" opacity="0.6" />
      <path d="M3 27c0-5 4-9 9-9s9 4 9 9z" fill="var(--accent)" />
      <path d="M15 27c0-4 3-7 6-7s8 3 8 7z" fill="var(--accent)" opacity="0.6" />
    </svg>
  );
}
