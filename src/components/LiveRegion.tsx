import { useAnnouncer } from '@/app/stores/announce';

/** Visually hidden polite live region, mounted once in the app shell (ui §6.10). */
export function LiveRegion() {
  const message = useAnnouncer((s) => s.message);
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}
