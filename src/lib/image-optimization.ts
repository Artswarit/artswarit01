/**
 * Image URL optimizer.
 *
 * Supabase's built-in image transforms require a Pro plan. To avoid egress
 * quota issues on the Free plan, we route public Supabase storage URLs
 * through images.weserv.nl — a free, globally-cached image proxy that
 * fetches the original once and serves resized/re-encoded variants from its
 * own CDN. This shifts image egress OFF Supabase entirely.
 *
 * Docs: https://images.weserv.nl/docs/
 */

export interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'jpg' | 'png' | 'origin';
  resize?: 'contain' | 'cover' | 'fill';
}

const WESERV_ENDPOINT = 'https://images.weserv.nl/';

const resizeToFit: Record<NonNullable<ImageOptimizationOptions['resize']>, string> = {
  cover: 'cover',
  contain: 'contain',
  fill: 'fill',
};

export const getOptimizedImageUrl = (
  url: string | null | undefined,
  options: ImageOptimizationOptions = {},
): string => {
  if (!url) return '';

  // Only proxy public Supabase storage URLs — leave everything else alone
  // (blob:, data:, local /assets, other CDNs).
  const isSupabasePublic = url.includes('.supabase.co/storage/v1/object/public/');
  if (!isSupabasePublic) return url;

  const {
    width = 800,
    height,
    quality = 80,
    format = 'webp',
    resize = 'cover',
  } = options;

  // weserv expects the source URL WITHOUT the protocol in the `url` param.
  const stripped = url.replace(/^https?:\/\//, '');

  const params = new URLSearchParams();
  params.set('url', stripped);
  params.set('w', String(width));
  if (height) params.set('h', String(height));
  params.set('q', String(quality));
  params.set('fit', resizeToFit[resize]);
  if (format !== 'origin') params.set('output', format);
  // Enable long-lived CDN caching (weserv default is already aggressive,
  // but be explicit).
  params.set('maxage', '1y');

  return `${WESERV_ENDPOINT}?${params.toString()}`;
};

/**
 * Presets tuned to actual render sizes to minimize bytes transferred.
 * Do NOT request larger than the display size — this is where egress savings come from.
 */
export const ImagePresets = {
  THUMBNAIL: { width: 500, quality: 78 } as ImageOptimizationOptions,        // Grid cards
  AVATAR: { width: 128, height: 128, quality: 80 } as ImageOptimizationOptions, // Round avatars
  PROFILE_COVER: { width: 1280, quality: 80 } as ImageOptimizationOptions,   // Header banners
  ARTWORK_DETAIL: { width: 1600, quality: 85 } as ImageOptimizationOptions,  // Detail view
};
