
import { supabase } from '@/integrations/supabase/client';

/**
 * Generates an optimized Supabase transformation URL for an image.
 * Uses Supabase's built-in image resizing to reduce Egress (data transfer).
 */
export const getOptimizedImageUrl = (
  url: string | null | undefined, 
  options: { 
    width?: number; 
    height?: number; 
    quality?: number;
    format?: 'origin' | 'webp';
    resize?: 'contain' | 'cover' | 'fill';
  } = {}
) => {
  if (!url) return '';
  
  // Only transform if it's a Supabase storage URL
  if (!url.includes('.supabase.co/storage/v1/object/public/')) {
    return url;
  }

  const { 
    width = 800, 
    height, 
    quality = 80, 
    format = 'webp', 
    resize = 'cover' 
  } = options;

  // IMPORTANT: Reverting to original URL because Supabase Image Transformation 
  // is returning a 400 error for this project. 
  // Custom transformations require a Pro/Pay-as-you-go plan or extra configuration.
  // We will rely on our 'Client-Side Compression on upload' to save egress instead.
  return url;
};

/**
 * Common presets for different UI components
 * Increased for higher visual fidelity (Retina/DPI support)
 */
export const ImagePresets = {
  THUMBNAIL: { width: 800, quality: 85 },       // Sharp artwork cards
  AVATAR: { width: 160, height: 160, quality: 85 }, // User avatars
  PROFILE_COVER: { width: 1440, quality: 85 },  // Header banners
  ARTWORK_DETAIL: { width: 1920, quality: 90 }, // Detail view
};
