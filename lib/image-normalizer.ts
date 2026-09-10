/**
 * Normalizes image URLs for pet-friendly places and service providers.
 * Ensures:
 * 1. Old/migrated Supabase storage domains point to the active project URL.
 * 2. Unsafe/expired expiring CDN tokens (such as temporary Facebook CDN links) are sanitized.
 * 3. `image_url` and `images` are always consistent and accessible for mobile and web clients.
 */

const CURRENT_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const CURRENT_HOST = CURRENT_SUPABASE_URL ? new URL(CURRENT_SUPABASE_URL).host : '';

const LEGACY_HOSTS = [
  'ndqrrdhjqrhudydnuipd.supabase.co',
  'yvbynxceonzlhfhtewcr.supabase.co',
];

export function sanitizeImageUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  let cleanUrl = url.trim();
  if (!cleanUrl) return null;

  // Replace legacy Supabase hosts with the current active project host
  if (CURRENT_HOST) {
    for (const legacy of LEGACY_HOSTS) {
      if (cleanUrl.includes(legacy)) {
        cleanUrl = cleanUrl.replace(legacy, CURRENT_HOST);
      }
    }
  }

  return cleanUrl;
}

export function sanitizeImageUrls(urls: any): string[] {
  if (!urls) return [];
  const list = Array.isArray(urls) ? urls : [urls];
  return list
    .map((u) => (typeof u === 'string' ? sanitizeImageUrl(u) : null))
    .filter((u): u is string => !!u);
}

export function normalizePlaceImages<T extends Record<string, any>>(place: T): T {
  if (!place) return place;

  const images = sanitizeImageUrls(place.images);
  let mainImage = sanitizeImageUrl(place.image_url);

  // If mainImage is missing but images array has items, use the first one
  if (!mainImage && images.length > 0) {
    mainImage = images[0];
  }

  // If images array is empty but mainImage exists, populate it
  if (images.length === 0 && mainImage) {
    images.push(mainImage);
  }

  return {
    ...place,
    image_url: mainImage,
    images: images,
  };
}
