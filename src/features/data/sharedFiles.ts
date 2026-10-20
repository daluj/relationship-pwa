/** Cache the service worker uses to hand shared files to the page (Web Share Target, pwa §9). */
export const SHARE_CACHE = 'kin-share';

/** Read and remove files the service worker stored from a share. */
export async function takeSharedFiles(): Promise<File[]> {
  if (!('caches' in window)) return [];
  const cache = await caches.open(SHARE_CACHE);
  const files: File[] = [];
  for (const req of await cache.keys()) {
    const res = await cache.match(req);
    if (res) {
      const name = decodeURIComponent(res.headers.get('x-file-name') ?? 'shared');
      files.push(
        new File([await res.blob()], name, { type: res.headers.get('content-type') ?? '' }),
      );
    }
    await cache.delete(req);
  }
  return files;
}
