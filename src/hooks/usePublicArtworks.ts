import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PublicArtwork {
  id: string;
  title: string;
  description: string | null;
  category: string;
  type: string;
  media_type: string;
  imageUrl: string;
  media_url: string;
  price: number;
  currency?: string;
  status: string;
  approval_status: string;
  tags: string[];
  metadata: any;
  created_at: string;
  updated_at: string;
  artist_id: string;
  artist: string;
  artistId: string;
  artistLocation: string | null;
  artistAvatar: string | null;
  likes: number;
  views: number;
  is_pinned: boolean;
  is_for_sale: boolean;
  audioUrl: string | null;
  videoUrl: string | null;
}

const PAGE_SIZE = 12;

export const usePublicArtworks = () => {
  const [artworks, setArtworks] = useState<PublicArtwork[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPage = useCallback(async (pageIndex: number, append: boolean = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      
      setError(null);

      const from = pageIndex * PAGE_SIZE;

      // Public discovery must never expose premium/exclusive artwork — that
      // filtering happens server-side, in get_public_artworks(), not here.
      // A client-side `.filter(access_type === 'free')` after the fact is
      // not an access-control boundary: it doesn't stop someone calling the
      // REST API directly with the anon key.
      const { data: artworksData, error: artworksError } = await supabase
        .rpc('get_public_artworks', {
          p_limit: PAGE_SIZE,
          p_offset: from,
        });

      if (artworksError) throw artworksError;

      // Get unique artist IDs
      const artistIds = [...new Set((artworksData || []).map(a => a.artist_id))];
      
      // Fetch artist details from public_profiles view
      const { data: artistsData } = artistIds.length > 0
        ? await supabase
            .from('public_profiles')
            .select('id, full_name, location, avatar_url')
            .in('id', artistIds)
        : { data: [] as any[] };

      // Create artist map
      const artistMap = new Map((artistsData || []).map(a => [a.id, { name: a.full_name, location: a.location, avatar: a.avatar_url }]));

      const publicArtworks = artworksData || [];

      // Fetch LIVE likes and views counts for accurate data (not stale metadata)
      const artworkIds = publicArtworks.map(a => a.id);
      const [likesResult, viewsResult] = artworkIds.length > 0
        ? await Promise.all([
            supabase.from('artwork_likes').select('artwork_id').in('artwork_id', artworkIds),
            supabase.from('artwork_views').select('artwork_id').in('artwork_id', artworkIds),
          ])
        : [{ data: [] }, { data: [] }];

      const liveLikes = new Map<string, number>();
      const liveViews = new Map<string, number>();
      (likesResult.data || []).forEach(r => { liveLikes.set(r.artwork_id, (liveLikes.get(r.artwork_id) || 0) + 1); });
      (viewsResult.data || []).forEach(r => { liveViews.set(r.artwork_id, (liveViews.get(r.artwork_id) || 0) + 1); });

      // Transform data to match component expectations
      const transformedArtworks: PublicArtwork[] = publicArtworks.map(artwork => {
        const artistInfo = artistMap.get(artwork.artist_id);
        return {
          id: artwork.id,
          title: artwork.title,
          description: artwork.description,
          category: artwork.category,
          type: artwork.media_type,
          media_type: artwork.media_type,
          imageUrl: artwork.media_url,
          media_url: artwork.media_url,
          price: artwork.price || 0,
          currency: (artwork.metadata as any)?.currency || 'USD',
          status: artwork.status,
          approval_status: artwork.status,
          tags: artwork.tags || [],
          metadata: artwork.metadata || {},
          created_at: artwork.created_at,
          updated_at: artwork.updated_at,
          artist_id: artwork.artist_id,
          artist: artistInfo?.name || 'Unknown Artist',
          artistId: artwork.artist_id,
          artistLocation: artistInfo?.location || null,
          artistAvatar: artistInfo?.avatar || null,
          likes: liveLikes.get(artwork.id) || 0,
          views: liveViews.get(artwork.id) || 0,
          is_pinned: (artwork.metadata as any)?.is_pinned || false,
          is_for_sale: !!artwork.price,
          audioUrl: artwork.media_type === 'audio' ? artwork.media_url : null,
          videoUrl: artwork.media_type === 'video' ? artwork.media_url : null
        };
      });

      setArtworks(prev => append ? [...prev, ...transformedArtworks] : transformedArtworks);
      setPage(pageIndex);
      // Filtering now happens server-side before the LIMIT is applied, so a
      // full page really does mean "there may be more" (previously this
      // checked the pre-filter count, which under/over-reported hasMore
      // whenever a page contained any premium/exclusive rows).
      setHasMore(publicArtworks.length === PAGE_SIZE);
    } catch (err) {
      console.error('Error fetching public artworks:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch artworks');
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    fetchPage(page + 1, true);
  }, [fetchPage, page, hasMore, loadingMore]);

  const refetch = useCallback(() => {
    fetchPage(0, false);
  }, [fetchPage]);

  useEffect(() => {
    fetchPage(0, false);
  }, [fetchPage]);

  return {
    artworks,
    loading,
    error,
    refetch,
    loadMore,
    hasMore,
    loadingMore,
    page
  };
};
