/**
 * Pexels Photo Search API — a free stock-photo source (no attribution
 * required by Pexels' license) used to seed the Reference Library's
 * curated ("By Revolio") Style/Character/Location/Element picks with real
 * photos, since Revolio has no photo library of its own to draw from. Only
 * called server-side (the admin "Import from stock" flow) — the API key
 * never reaches the browser.
 *
 * Get a free key at https://www.pexels.com/api/ and set it as
 * PEXELS_API_KEY. Until that's set, `searchPexelsPhotos` throws a clear
 * error rather than silently returning nothing.
 */

export interface PexelsPhoto {
  id: number;
  /** A large-but-not-original size — big enough for a reference image, far smaller than Pexels' full-res originals. */
  url: string;
  /** Small size for the results-grid thumbnail. */
  thumbnailUrl: string;
  photographer: string;
  photographerUrl: string;
  alt: string;
}

export async function searchPexelsPhotos(query: string, perPage = 15): Promise<PexelsPhoto[]> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    throw new Error("PEXELS_API_KEY is not set — get a free key at pexels.com/api and add it to your environment.");
  }
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${Math.min(
    Math.max(perPage, 1),
    80
  )}`;
  const res = await fetch(url, { headers: { Authorization: apiKey } });
  if (!res.ok) {
    throw new Error(`Pexels search failed (${res.status})`);
  }
  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const photos = (data.photos ?? []) as any[];
  return photos.map((p) => ({
    id: p.id,
    url: p.src?.large2x ?? p.src?.large ?? p.src?.original,
    thumbnailUrl: p.src?.medium ?? p.src?.small,
    photographer: p.photographer,
    photographerUrl: p.photographer_url,
    alt: p.alt || query,
  }));
}
