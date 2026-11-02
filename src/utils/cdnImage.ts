/** Routes Vercel Blob photos through our own cached /img endpoint; other URLs are left untouched. */
export function cdnImage(url?: string | null): string {
  if (!url) return '';
  try {
    if (/^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i.test(url)) {
      return `/img?u=${encodeURIComponent(url)}`;
    }
  } catch {
    /* fall through */
  }
  return url;
}
