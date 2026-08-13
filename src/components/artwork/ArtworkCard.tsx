
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { track } from '@/lib/analytics';
import { useImpressionTracker } from '@/hooks/useImpressionTracker';
import { Heart, Eye, Play, ExternalLink, Bookmark, Flag, MoreVertical } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import GlassCard from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import LikeParticles from '@/components/ui/LikeParticles';
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
import { PayArtworkButton } from '@/components/payments/PayArtworkButton';

interface ArtworkCardProps {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  type: string;
  imageUrl: string;
  likes: number;
  views: number;
  price?: number;
  currency?: string;
  category?: string;
  audioUrl?: string;
  videoUrl?: string;
  tags?: string[];
  /** Position in the result list, used for impression / click ranking analytics. */
  position?: number;
  /** Active search query (if any) when this card was rendered. */
  searchQuery?: string;
  /** Surface that rendered the card (e.g. "explore", "trending", "recommendations"). */
  surface?: string;
  /** Hide the unlock/pay button (e.g. on the user's own Collection where the artwork is already purchased). */
  alreadyUnlocked?: boolean;
}

const ArtworkCard = ({
  id,
  title,
  artist,
  artistId,
  type,
  imageUrl,
  likes,
  views,
  price,
  currency = 'USD',
  category,
  tags,
  position,
  searchQuery,
  surface,
  alreadyUnlocked = false,
}: ArtworkCardProps) => {
  const impressionRef = useImpressionTracker<HTMLDivElement>({
    id,
    event: 'artwork_impression',
    props: { artist_id: artistId, category, position, query: searchQuery, surface },
  });
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { format } = useCurrencyFormat();
  const { savedArtworkIds, toggleSaveArtwork, loading: isSaveLoading } = useSavedArtworks();
  const location = useLocation();
  
  // Define formatPrice locally or pass the currency to format
  const formattedPrice = price ? format(price, currency) : null;
  const isSaved = savedArtworkIds.has(id);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [currentLikes, setCurrentLikes] = useState(likes);
  const [currentViews, setCurrentViews] = useState(views);
  const [isHovered, setIsHovered] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [animateLike, setAnimateLike] = useState(false);

  // Check if user has liked this artwork
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

  // Fetch initial counts once. Per-card realtime channels were removed —
  // they created 40–80 concurrent sockets on any grid page, driving huge
  // Realtime egress. The user's own like/view updates locally via
  // optimistic UI in handleLike; cross-user changes appear on next fetch.
  useEffect(() => {
    let isCancelled = false;
    (async () => {
      const [likesResult, viewsResult] = await Promise.all([
        supabase.from('artwork_likes').select('id', { count: 'exact', head: true }).eq('artwork_id', id),
        supabase.from('artwork_views').select('id', { count: 'exact', head: true }).eq('artwork_id', id),
      ]);
      if (isCancelled) return;
      setCurrentLikes(likesResult.count ?? 0);
      setCurrentViews(viewsResult.count ?? 0);
    })();
    return () => { isCancelled = true; };
  }, [id]);

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user?.id) {
      toast({
        title: "Sign in required",
        description: "Please sign in to like artworks.",
      });
      return;
    }

    if (isLiking) return;
    setIsLiking(true);

    // Optimistic update
    const previousLiked = isLiked;
    const previousLikes = currentLikes;
    setIsLiked(!isLiked);
    setCurrentLikes(prev => isLiked ? prev - 1 : prev + 1);
    
    // Trigger animation only when liking (not unliking)
    if (!isLiked) {
      setAnimateLike(true);
      setTimeout(() => setAnimateLike(false), 300);
    }

    try {
      if (previousLiked) {
        const { error } = await supabase
          .from('artwork_likes')
          .delete()
          .eq('artwork_id', id)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('artwork_likes')
          .insert({ artwork_id: id, user_id: user.id });
        if (error) throw error;
      }
    } catch (err) {
      // Revert on error
      setIsLiked(previousLiked);
      setCurrentLikes(previousLikes);
      console.error('Error toggling like:', err);
    } finally {
      setIsLiking(false);
    }
  };

  const handlePlay = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const getTypeIcon = () => {
    switch (type) {
      case 'music':
      case 'audio':
        return <Play className="w-4 h-4" />;
      case 'video':
        return <Play className="w-4 h-4" />;
      default:
        return <ExternalLink className="w-4 h-4" />;
    }
  };

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user?.id) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save artworks.",
      });
      return;
    }
    track(isSaved ? 'wishlist_removed' : 'wishlist_added', {
      artwork_id: id,
      artist_id: artistId,
      category,
      surface,
    });
    toggleSaveArtwork(id);
  };

  const handleReportClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsReportOpen(true);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // If the click was on a link or button, don't navigate
    if ((e.target as HTMLElement).closest('a, button')) {
      return;
    }
    track('artwork_viewed', { artwork_id: id, artist_id: artistId, category, surface });
    if (searchQuery) {
      track('search_result_clicked', {
        query: searchQuery,
        position,
        entity_type: 'artwork',
        entity_id: id,
        surface,
      });
    }
    navigate(`/artwork/${id}`);
  };

  return (
    <>
      <div
        ref={impressionRef}
        onClick={handleCardClick}
        className="block"
      >
        <GlassCard 
          className="group p-0 flex flex-col overflow-hidden hover:-translate-y-1 active:scale-[0.99] transition-all duration-500 ease-apple cursor-pointer rounded-2xl border-border/40 shadow-[0_1px_2px_hsl(var(--foreground)/0.04)] hover:shadow-[0_20px_40px_-20px_hsl(var(--foreground)/0.18)] bg-card"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Image/Video Container */}
          <div className="relative w-full aspect-[4/5] overflow-hidden bg-muted shrink-0">
            {type === 'video' ? (
              <video
                src={imageUrl}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover transition-transform duration-[900ms] ease-apple group-hover:scale-[1.04]"
              />
            ) : (
              <img
                src={getOptimizedImageUrl(imageUrl, ImagePresets.THUMBNAIL)}
                alt={title}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover transition-transform duration-[900ms] ease-apple group-hover:scale-[1.04]"
              />
            )}
            
            {/* Media type indicator */}
            <div className="absolute top-3 right-3">
              <div className="bg-background/70 backdrop-blur-xl p-1.5 rounded-full border border-border/40 text-foreground/80 shadow-sm">
                {getTypeIcon()}
              </div>
            </div>
          
          {/* Subtle gradient on hover only */}
          <div className={`absolute inset-0 bg-gradient-to-t from-foreground/50 via-transparent to-transparent transition-opacity duration-500 ease-apple flex items-end justify-center p-4 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
            {!alreadyUnlocked && price && price > 0 && (
              <div className="w-full translate-y-2 group-hover:translate-y-0 transition-transform duration-500 ease-apple">
                <PayArtworkButton 
                  artworkId={id}
                  amount={price}
                  artworkTitle={title}
                  className="w-full rounded-full h-10 font-semibold tracking-tight bg-background/90 backdrop-blur-xl text-foreground hover:bg-background shadow-lg"
                  size="default"
                />
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col flex-1 gap-2">
          <div className="flex justify-between items-start gap-3">
            <div className="flex flex-col min-w-0">
              <h3 className="font-semibold text-[15px] leading-snug text-foreground line-clamp-1 tracking-tight">
                {title}
              </h3>
              <Link 
                to={`/artist/${artistId}`}
                className="text-xs text-muted-foreground hover:text-primary transition-colors duration-300 font-medium mt-0.5 truncate"
                onClick={e => e.stopPropagation()}
              >
                {artist}
              </Link>
            </div>
            {formattedPrice && (
              <span className="shrink-0 text-xs font-semibold text-foreground bg-muted/60 px-2.5 py-1 rounded-full border border-border/40 tracking-tight">
                {formattedPrice}
              </span>
            )}
          </div>
          
          <div className="flex flex-wrap gap-1.5">
            {category && !['image', 'video', 'audio'].includes(category.toLowerCase()) && (
              <span className="inline-flex items-center text-muted-foreground text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted/50">
                {category}
              </span>
            )}
            {tags && tags.slice(0, 1).map((tag, idx) => (
              <span key={idx} className="inline-flex items-center text-muted-foreground text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted/50">
                {tag}
              </span>
            ))}
          </div>

          
          {/* Stats Row */}
          <div className="flex items-center justify-between pt-2 mt-auto border-t border-border/40">
            <div className="flex items-center gap-1 text-muted-foreground">
              <button 
                onClick={handleLike}
                disabled={isLiking}
                aria-label={isLiked ? 'Unlike' : 'Like'}
                className={cn(
                  "flex items-center gap-1.5 h-9 px-2 -ml-2 rounded-full transition-all duration-300 ease-apple hover:bg-muted/60 active:scale-95",
                  isLiked ? "text-primary" : "hover:text-foreground"
                )}
              >
                <Heart className={cn(
                  "w-[18px] h-[18px] transition-transform duration-300 ease-apple",
                  isLiked ? "fill-current" : "",
                  animateLike ? "scale-125" : ""
                )} />
                <span className="text-xs font-medium tabular-nums">{currentLikes}</span>
              </button>
              <div className="flex items-center gap-1.5 h-9 px-2">
                <Eye className="w-[18px] h-[18px] opacity-70" />
                <span className="text-xs font-medium tabular-nums">{currentViews}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-0.5">
              <button
                onClick={handleSave}
                disabled={isSaveLoading}
                className={cn(
                  "h-9 w-9 flex items-center justify-center rounded-full transition-all duration-300 ease-apple active:scale-95",
                  isSaved 
                    ? "text-primary bg-primary/10" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
                title={isSaved ? 'Remove from saved' : 'Save artwork'}
              >
                <Bookmark className={cn(
                  "w-[18px] h-[18px]",
                  isSaved ? "fill-current" : ""
                )} />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                  <button className="h-9 w-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-300 ease-apple active:scale-95">
                    <MoreVertical className="w-[18px] h-[18px]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[160px] rounded-xl" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={handleReportClick} className="text-destructive text-xs font-medium cursor-pointer rounded-lg">
                    <Flag className="w-3.5 h-3.5 mr-2" />
                    Report
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

        </div>
        </GlassCard>
      </div>

    {/* Report Dialog */}
    <ReportDialog
      isOpen={isReportOpen}
      onClose={() => setIsReportOpen(false)}
      contentType="artwork"
      contentId={id}
    />
  </>
  );
};

export default ArtworkCard;
