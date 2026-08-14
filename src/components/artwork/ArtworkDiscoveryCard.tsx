import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { track } from '@/lib/analytics';
import { useImpressionTracker } from '@/hooks/useImpressionTracker';
import { Heart, Bookmark, Play, Music, Flag, MoreVertical } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useCurrencyFormat } from '@/hooks/useCurrencyFormat';
import { useSavedArtworks } from '@/hooks/useSavedArtworks';
import ReportDialog from '@/components/reports/ReportDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getOptimizedImageUrl, ImagePresets } from '@/lib/image-optimization';

interface ArtworkDiscoveryCardProps {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  artistAvatar?: string | null;
  type: string;
  imageUrl: string;
  likes: number;
  price?: number;
  currency?: string;
  /** Position in the result list, used for impression / click ranking analytics. */
  position?: number;
  /** Active search query (if any) when this card was rendered. */
  searchQuery?: string;
  /** Surface that rendered the card (e.g. "explore", "artwork_related"). */
  surface?: string;
}

/**
 * Image-first discovery card for uniform grids (Explore, Related Artwork).
 * Distinct from the shared ArtworkCard used on artist profiles / purchased
 * artworks — kept separate so this visual treatment doesn't ripple into
 * surfaces the redesign wasn't asked to touch.
 *
 * Every action (like/save/report) lives in the footer, not overlaid on the
 * image — a fixed-aspect image frame with no competing controls on top of it.
 */
const ArtworkDiscoveryCard = ({
  id,
  title,
  artist,
  artistId,
  artistAvatar,
  type,
  imageUrl,
  likes,
  price,
  currency = 'USD',
  position,
  searchQuery,
  surface,
}: ArtworkDiscoveryCardProps) => {
  const impressionRef = useImpressionTracker<HTMLDivElement>({
    id,
    event: 'artwork_impression',
    props: { artist_id: artistId, position, query: searchQuery, surface },
  });
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { format } = useCurrencyFormat();
  const { savedArtworkIds, toggleSaveArtwork, loading: isSaveLoading } = useSavedArtworks();

  const formattedPrice = price ? format(price, currency) : null;
  const isSaved = savedArtworkIds.has(id);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [currentLikes, setCurrentLikes] = useState(likes);
  const [isLiking, setIsLiking] = useState(false);
  const [animateLike, setAnimateLike] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function checkLikeStatus() {
      if (!user?.id) return;
      const { data } = await supabase
        .from('artwork_likes')
        .select('id')
        .eq('artwork_id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      setIsLiked(!!data);
    }
    checkLikeStatus();
  }, [id, user?.id]);

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user?.id) {
      toast({ title: "Sign in required", description: "Please sign in to like artworks." });
      return;
    }
    if (isLiking) return;
    setIsLiking(true);

    const previousLiked = isLiked;
    const previousLikes = currentLikes;
    setIsLiked(!isLiked);
    setCurrentLikes(prev => isLiked ? prev - 1 : prev + 1);
    if (!isLiked) {
      setAnimateLike(true);
      setTimeout(() => setAnimateLike(false), 300);
    }

    try {
      if (previousLiked) {
        const { error } = await supabase.from('artwork_likes').delete().eq('artwork_id', id).eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('artwork_likes').insert({ artwork_id: id, user_id: user.id });
        if (error) throw error;
      }
    } catch (err) {
      setIsLiked(previousLiked);
      setCurrentLikes(previousLikes);
      console.error('Error toggling like:', err);
    } finally {
      setIsLiking(false);
    }
  };

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user?.id) {
      toast({ title: "Sign in required", description: "Please sign in to save artworks." });
      return;
    }
    track(isSaved ? 'wishlist_removed' : 'wishlist_added', { artwork_id: id, artist_id: artistId, surface });
    toggleSaveArtwork(id);
  };

  const handleReportClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsReportOpen(true);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('a, button')) return;
    track('artwork_viewed', { artwork_id: id, artist_id: artistId, surface });
    if (searchQuery) {
      track('search_result_clicked', { query: searchQuery, position, entity_type: 'artwork', entity_id: id, surface });
    }
    navigate(`/artwork/${id}`);
  };

  return (
    <>
      <div
        ref={impressionRef}
        onClick={handleCardClick}
        className="group rounded-2xl overflow-hidden bg-card border border-border/20 shadow-sm hover:shadow-lg hover:shadow-black/5 transition-all duration-300 cursor-pointer"
      >
        {/* Fixed-aspect image frame — every card the same size, no overlaid controls */}
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted">
          {type === 'video' ? (
            <video
              src={imageUrl}
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <img
              src={getOptimizedImageUrl(imageUrl, ImagePresets.THUMBNAIL)}
              alt={title}
              loading="lazy"
              decoding="async"
              onLoad={() => setLoaded(true)}
              className={cn(
                "absolute inset-0 w-full h-full object-cover transition-all duration-700 group-hover:scale-105",
                loaded ? "opacity-100" : "opacity-0"
              )}
            />
          )}
          {!loaded && type !== 'video' && (
            <div className="absolute inset-0 bg-muted/60 animate-pulse" />
          )}

          {/* Media-type badge — the only overlay, small and purely informational */}
          {(type === 'video' || type === 'audio' || type === 'music') && (
            <div className="absolute top-2.5 left-2.5 h-6 w-6 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center">
              {type === 'video' ? <Play className="h-3 w-3 fill-current" /> : <Music className="h-3 w-3" />}
            </div>
          )}
        </div>

        {/* Footer — artist identity, title, and every action */}
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Link
              to={`/artist/${artistId}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 min-w-0 group/artist"
            >
              {artistAvatar ? (
                <img
                  src={artistAvatar}
                  alt={artist}
                  loading="lazy"
                  className="h-6 w-6 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                  {artist?.charAt(0)?.toUpperCase()}
                </div>
              )}
              <span className="text-xs font-semibold text-foreground truncate group-hover/artist:text-primary transition-colors">
                {artist}
              </span>
            </Link>
            {formattedPrice && (
              <span className="text-xs font-bold text-primary shrink-0">{formattedPrice}</span>
            )}
          </div>

          <h3 className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
            {title}
          </h3>

          <div className="flex items-center justify-between pt-1">
            <button
              onClick={handleLike}
              disabled={isLiking}
              aria-label={isLiked ? 'Unlike' : 'Like'}
              className={cn(
                "flex items-center gap-1.5 text-muted-foreground hover:text-red-500 transition-colors",
                isLiked && "text-red-500",
                animateLike && "scale-125"
              )}
            >
              <Heart className={cn("h-4 w-4 transition-transform", isLiked && "fill-current")} aria-hidden="true" />
              <span className="text-xs font-semibold">{currentLikes}</span>
            </button>

            <div className="flex items-center gap-1">
              <button
                onClick={handleSave}
                disabled={isSaveLoading}
                aria-label={isSaved ? 'Remove from saved' : 'Save artwork'}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  isSaved ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Bookmark className={cn("h-4 w-4", isSaved && "fill-current")} aria-hidden="true" />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                  <button aria-label="More options" className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                    <MoreVertical className="h-4 w-4" aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[140px]" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={handleReportClick} className="text-destructive text-xs font-medium cursor-pointer">
                    <Flag className="w-3.5 h-3.5 mr-2" />
                    Report
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      <ReportDialog
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        contentType="artwork"
        contentId={id}
      />
    </>
  );
};

export default ArtworkDiscoveryCard;
