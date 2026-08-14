import { useParams, Link, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  ArrowLeft, Eye, Heart, Maximize2, Bookmark,
  Crown, Music, MessageCircle, Share2, X
} from "lucide-react";
import ArtworkFeedback from "@/components/artwork/ArtworkFeedback";
import ArtworkDiscoveryCard from "@/components/artwork/ArtworkDiscoveryCard";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import LikeParticles from "@/components/ui/LikeParticles";
import {
  Dialog, DialogContent, DialogTrigger,
  DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import LogoLoader from "@/components/ui/LogoLoader";
import { trackOncePerSession } from "@/lib/analytics";
import { getOptimizedImageUrl, ImagePresets } from "@/lib/image-optimization";
import { PayArtworkButton } from "@/components/payments/PayArtworkButton";

interface RelatedArtwork {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  artistAvatar: string | null;
  type: string;
  imageUrl: string;
  likes: number;
  price: number;
  currency: string;
}

export default function ArtworkDetails({ isModal = false }: { isModal?: boolean }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [artwork, setArtwork] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewCount, setViewCount] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [animateLike, setAnimateLike] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [doubleTapLike, setDoubleTapLike] = useState(false);
  const lastTapRef = useRef(0);
  const { format } = useCurrencyFormat();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [relatedArtworks, setRelatedArtworks] = useState<RelatedArtwork[]>([]);

  useEffect(() => {
    // Reset state before loading new artwork
    setArtwork(null);
    setViewCount(0);
    setLikeCount(0);
    setIsLiked(false);
    setIsBookmarked(false);
    setAccessDenied(false);

    async function init() {
      if (!id) return;

      const viewData: { artwork_id: string; user_id?: string } = { artwork_id: id };
      if (user?.id) viewData.user_id = user.id;
      supabase.from("artwork_views").insert(viewData).then(() => {});

      setLoading(true);
      const [artworkRes, viewsRes, likesRes] = await Promise.all([
        supabase.from("artworks").select("*").eq("id", id).maybeSingle(),
        supabase.from("artwork_views").select("id").eq("artwork_id", id),
        supabase.from("artwork_likes").select("id").eq("artwork_id", id),
      ]);

      setViewCount(viewsRes.data?.length || 0);
      setLikeCount(likesRes.data?.length || 0);

      if (artworkRes.error || !artworkRes.data) {
        setArtwork(null);
        setLoading(false);
        return;
      }

      const data = artworkRes.data;
      const meta = (data.metadata as any) || {};
      
      // Block access to banned content immediately
      if (meta.admin_banned) {
        setArtwork(null);
        setLoading(false);
        toast({
          title: "Content Unavailable",
          description: "This artwork has been removed for violating community guidelines.",
          variant: "destructive"
        });
        return;
      }

      const accessType = meta.access_type || "free";

      if (accessType === "premium" || accessType === "exclusive") {
        if (!user?.id) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }
        const isOwner = data.artist_id === user.id;
        if (!isOwner) {
          const { data: purchase } = await supabase
            .from("artwork_unlocks")
            .select("id")
            .eq("artwork_id", id)
            .eq("user_id", user.id)
            .maybeSingle();
          if (!purchase) {
            setAccessDenied(true);
            setLoading(false);
            return;
          }
        }
      }

      const { data: artist } = await supabase
        .from("public_profiles")
        .select("full_name, avatar_url")
        .eq("id", data.artist_id)
        .maybeSingle();

      if (user?.id) {
        const [likeRes, bookRes] = await Promise.all([
          supabase.from("artwork_likes").select("id").eq("artwork_id", id).eq("user_id", user.id).maybeSingle(),
          supabase.from("saved_artworks").select("id").eq("artwork_id", id).eq("user_id", user.id).maybeSingle(),
        ]);
        setIsLiked(!!likeRes.data);
        setIsBookmarked(!!bookRes.data);
      }

      setArtwork({
        id: data.id,
        title: data.title,
        description: data.description,
        category: data.category,
        type: data.media_type,
        imageUrl: data.media_url,
        audioUrl: data.media_type === "audio" ? data.media_url : null,
        videoUrl: data.media_type === "video" ? data.media_url : null,
        price: data.price || 0,
        currency: meta.currency || "USD",
        accessType,
        artistId: data.artist_id,
        artist: artist?.full_name || "Unknown Artist",
        artistAvatar: artist?.avatar_url || null,
        tags: data.tags || [],
      });
      trackOncePerSession(`artwork:${data.id}`, 'artwork_viewed', {
        artwork_id: data.id,
        artist_id: data.artist_id,
        category: data.category,
        medium: data.media_type,
        price: data.price || 0,
        access_type: accessType,
        surface: 'artwork_details',
      });
      setLoading(false);

      if (isCancelled) return;

      const uniqueId = Math.random().toString(36).substring(7);
      
      likesChannel = supabase
        .channel(`details-likes-${id}-${uniqueId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "artwork_likes", filter: `artwork_id=eq.${id}` },
          async () => {
            const { data: l } = await supabase.from("artwork_likes").select("id").eq("artwork_id", id);
            if (!isCancelled) setLikeCount(l?.length || 0);

            if (user?.id) {
              const { data: userLike } = await supabase.from("artwork_likes").select("id").eq("artwork_id", id).eq("user_id", user.id).maybeSingle();
              if (!isCancelled) setIsLiked(!!userLike);
            }
          })
        .subscribe();

      viewsChannel = supabase
        .channel(`details-views-${id}-${uniqueId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "artwork_views", filter: `artwork_id=eq.${id}` },
          () => setViewCount((p) => p + 1))
        .subscribe();
    }

    let isCancelled = false;
    let likesChannel: any = null;
    let viewsChannel: any = null;

    init();
    
    return () => {
      isCancelled = true;
      if (likesChannel) supabase.removeChannel(likesChannel);
      if (viewsChannel) supabase.removeChannel(viewsChannel);
    };
  }, [id, user?.id]);

  // Related artwork — same category first, backfilled with recent public
  // pieces so the section is never empty just because the category is niche.
  useEffect(() => {
    if (!artwork?.id) {
      setRelatedArtworks([]);
      return;
    }
    let isCancelled = false;

    (async () => {
      const RELATED_LIMIT = 8;
      const baseQuery = supabase
        .from('artworks')
        .select('id, title, media_url, media_type, price, metadata, artist_id')
        .eq('status', 'public')
        .neq('id', artwork.id)
        .limit(RELATED_LIMIT);

      const { data: sameCategory } = artwork.category
        ? await baseQuery.eq('category', artwork.category)
        : { data: [] as any[] };

      let pool = sameCategory || [];
      if (pool.length < RELATED_LIMIT) {
        const { data: recent } = await supabase
          .from('artworks')
          .select('id, title, media_url, media_type, price, metadata, artist_id')
          .eq('status', 'public')
          .neq('id', artwork.id)
          .order('created_at', { ascending: false })
          .limit(RELATED_LIMIT);
        const seen = new Set(pool.map(a => a.id));
        pool = [...pool, ...(recent || []).filter(a => !seen.has(a.id))].slice(0, RELATED_LIMIT);
      }

      if (pool.length === 0) {
        if (!isCancelled) setRelatedArtworks([]);
        return;
      }

      const artistIds = [...new Set(pool.map(a => a.artist_id).filter(Boolean))];
      const artworkIds = pool.map(a => a.id);

      const [{ data: artists }, { data: likeRows }] = await Promise.all([
        artistIds.length > 0
          ? supabase.from('public_profiles').select('id, full_name, avatar_url').in('id', artistIds)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from('artwork_likes').select('artwork_id').in('artwork_id', artworkIds),
      ]);

      const artistMap = new Map((artists || []).map(a => [a.id, a]));
      const likeCounts = new Map<string, number>();
      (likeRows || []).forEach(r => likeCounts.set(r.artwork_id, (likeCounts.get(r.artwork_id) || 0) + 1));

      const transformed: RelatedArtwork[] = pool.map(a => {
        const meta = (a.metadata as any) || {};
        const artistInfo = artistMap.get(a.artist_id);
        return {
          id: a.id,
          title: a.title,
          artist: artistInfo?.full_name || 'Unknown Artist',
          artistId: a.artist_id,
          artistAvatar: artistInfo?.avatar_url || null,
          type: a.media_type,
          imageUrl: a.media_url,
          likes: likeCounts.get(a.id) || 0,
          price: a.price || 0,
          currency: meta.currency || 'USD',
        };
      });

      if (!isCancelled) setRelatedArtworks(transformed);
    })();

    return () => { isCancelled = true; };
  }, [artwork?.id, artwork?.category]);

  const handleLike = async () => {
    if (!user?.id) {
      toast({ title: "Sign in required", description: "Please sign in to like artworks." });
      return;
    }
    if (isLiking || !id) return;
    setIsLiking(true);
    const prev = isLiked;
    const prevCount = likeCount;
    setIsLiked(!prev);
    setLikeCount((c) => (prev ? c - 1 : c + 1));
    if (!prev) { setAnimateLike(true); setTimeout(() => setAnimateLike(false), 700); }
    try {
      if (prev) {
        await supabase.from("artwork_likes").delete().eq("artwork_id", id).eq("user_id", user.id);
      } else {
        await supabase.from("artwork_likes").insert({ artwork_id: id, user_id: user.id });
      }
    } catch {
      setIsLiked(prev);
      setLikeCount(prevCount);
    } finally {
      setIsLiking(false);
    }
  };

  const handleBookmark = async () => {
    if (!user?.id) {
      toast({ title: "Sign in required", description: "Please sign in to save artworks." });
      return;
    }
    if (!id) return;
    const prev = isBookmarked;
    setIsBookmarked(!prev);
    try {
      if (prev) {
        await supabase.from("saved_artworks").delete().eq("artwork_id", id).eq("user_id", user.id);
        toast({ title: "Removed from saved" });
      } else {
        await supabase.from("saved_artworks").insert({ artwork_id: id, user_id: user.id });
        toast({ title: "Saved to your collection!" });
      }
    } catch {
      setIsBookmarked(prev);
    }
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (!isLiked) {
        handleLike();
        setDoubleTapLike(true);
        setTimeout(() => setDoubleTapLike(false), 1000);
      }
    }
    lastTapRef.current = now;
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: artwork?.title, url });
      } catch {
        // User dismissed the native share sheet — nothing to do.
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied!" });
    }
  };

  const openComments = () => setCommentsOpen(true);

  // ── Loading ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className={cn("min-h-screen flex flex-col bg-background", isModal && "min-h-0 h-[400px]")}>
        {!isModal && <Navbar />}
        <div className="flex-1 flex items-center justify-center pt-24">
          <LogoLoader text="Loading artwork…" />
        </div>
      </div>
    );
  }

  // ── Access Denied ─────────────────────────────────────────
  if (accessDenied) {
    return (
      <div className={cn("min-h-screen flex flex-col bg-background", isModal && "min-h-0")}>
        {!isModal && <Navbar />}
        <main className="flex-1 flex items-center justify-center px-4 pt-20">
          <div className="max-w-sm w-full text-center space-y-6 p-8 rounded-2xl border border-border/40 bg-card shadow-xl">
            <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
              <Crown className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight mb-2">Premium Content</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Purchase this artwork to unlock full access.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {!user?.id ? (
                <Button asChild className="h-12 rounded-xl font-semibold">
                  <Link to="/login">Sign in to Purchase</Link>
                </Button>
              ) : (
                <PayArtworkButton 
                  artworkId={id!} 
                  amount={artwork?.price || 0} 
                  artworkTitle={artwork?.title || "Artwork"} 
                  className="h-12 rounded-xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 text-white border-none shadow-lg"
                  onSuccess={() => window.location.reload()}
                />
              )}
              <Button variant="ghost" className="rounded-xl font-medium" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── Not Found ─────────────────────────────────────────────
  if (!artwork) {
    return (
      <div className={cn("min-h-screen flex flex-col bg-background", isModal && "min-h-0")}>
        {!isModal && <Navbar />}
        <main className="flex-1 flex items-center justify-center px-4 pt-20">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold">Artwork Not Found</h1>
            <p className="text-muted-foreground">This artwork doesn't exist or has been removed.</p>
            <Button asChild variant="outline" className="rounded-xl h-11">
              <Link to="/explore">Back to Explore</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const AccessBadge = () => (
    <span className={cn(
      "text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0",
      artwork.accessType === "exclusive"
        ? "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400"
        : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
    )}>
      <Crown className="h-3 w-3" />
      {artwork.accessType === "exclusive" ? "Exclusive" : "Premium"}
    </span>
  );

  return (
    <div className={cn("min-h-screen flex flex-col bg-background", isModal && "min-h-0")}>
      {!isModal && <Navbar />}

      {isModal && (
        <button
          onClick={() => navigate(-1)}
          className="fixed top-[calc(1rem+var(--safe-top))] right-4 z-[110] h-10 w-10 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-white/30 active:scale-90 transition-all shadow-xl"
        >
          <X className="h-5 w-5" />
        </button>
      )}

      <main className={cn("flex-1 pb-16", isModal ? "pt-[var(--safe-top)]" : "pt-[calc(var(--navbar-height-mobile)+var(--safe-top)+1rem)] sm:pt-[calc(var(--navbar-height-desktop)+var(--safe-top)+1.5rem)]")}>
        <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8">

          {!isModal && (
            <button
              onClick={() => navigate(-1)}
              className="hidden sm:inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          )}

          <div className="grid lg:grid-cols-[1.3fr_1fr] gap-6 lg:gap-12 items-start">

            {/* ── MEDIA VIEWER ──────────────────────────────────────── */}
            <div className="lg:sticky lg:top-24">
              <div className="flex items-center justify-between mb-3 sm:hidden">
                <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                {artwork.accessType !== "free" && <AccessBadge />}
              </div>

              <div
                className="relative w-full select-none rounded-2xl sm:rounded-3xl overflow-hidden bg-muted/30 border border-border/40 shadow-sm"
                onClick={handleDoubleTap}
              >
                {/* IMAGE */}
                {artwork.type === "image" && artwork.imageUrl && (
                  <>
                    <div className="flex items-center justify-center">
                      <img loading="lazy" decoding="async"
                        src={getOptimizedImageUrl(artwork.imageUrl, ImagePresets.ARTWORK_DETAIL)}
                        alt={artwork.title}
                        className="w-auto h-auto max-w-full max-h-[75vh] object-contain block mx-auto"
                        draggable={false}
                      />
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <button className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity">
                          <Maximize2 className="h-3.5 w-3.5" />
                        </button>
                      </DialogTrigger>
                      <DialogContent className="w-fit max-w-[98vw] max-h-[98vh] p-0 border-none bg-transparent shadow-none rounded-2xl overflow-hidden flex items-center justify-center">
                        <DialogTitle className="sr-only">Fullscreen — {artwork.title}</DialogTitle>
                        <DialogDescription className="sr-only">Full size view of {artwork.title}</DialogDescription>
                        <img loading="lazy" decoding="async" src={artwork.imageUrl} alt={artwork.title} className="w-auto h-auto max-w-[98vw] max-h-[98vh] object-contain rounded-2xl" />
                      </DialogContent>
                    </Dialog>
                  </>
                )}

                {/* VIDEO */}
                {artwork.type === "video" && artwork.videoUrl && (
                  <video controls playsInline className="w-full h-auto block max-h-[75vh]">
                    <source src={artwork.videoUrl} type="video/mp4" />
                  </video>
                )}

                {/* AUDIO */}
                {(artwork.type === "audio" || artwork.type === "music") && (
                  <div className="p-6 space-y-4">
                    {artwork.imageUrl ? (
                      <img loading="lazy" decoding="async" src={artwork.imageUrl} alt={artwork.title} className="w-full rounded-xl object-cover max-h-72" />
                    ) : (
                      <div className="w-full h-48 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                        <Music className="h-14 w-14 text-primary/30" />
                      </div>
                    )}
                    {artwork.audioUrl && (
                      <audio controls className="w-full">
                        <source src={artwork.audioUrl} type="audio/mpeg" />
                      </audio>
                    )}
                  </div>
                )}

                {/* Double-tap heart animation */}
                {doubleTapLike && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                    <Heart className="h-24 w-24 text-white fill-white drop-shadow-2xl animate-ping" style={{ animationDuration: '0.6s', animationIterationCount: 1 }} />
                  </div>
                )}
              </div>
            </div>

            {/* ── INFO PANEL ────────────────────────────────────────── */}
            <div className="space-y-5 sm:space-y-6">
              <div className="flex items-start justify-between gap-3">
                <Link to={`/artist/${artwork.artistId}`} className="flex items-center gap-3 min-w-0 group">
                  {artwork.artistAvatar ? (
                    <img loading="lazy" decoding="async"
                      src={artwork.artistAvatar}
                      alt={artwork.artist}
                      className="w-11 h-11 rounded-full object-cover ring-2 ring-primary/20 group-hover:ring-primary/50 transition-all shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center text-primary font-bold shrink-0">
                      {artwork.artist?.charAt(0)?.toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                      {artwork.artist}
                    </p>
                    {artwork.category && (
                      <p className="text-xs text-muted-foreground truncate">{artwork.category}</p>
                    )}
                  </div>
                </Link>
                {artwork.accessType !== "free" && <div className="hidden sm:block"><AccessBadge /></div>}
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground leading-tight">
                  {artwork.title}
                </h1>
              </div>

              {artwork.description && (
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {artwork.description}
                </p>
              )}

              {artwork.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {artwork.tags.map((tag: string) => (
                    <span key={tag} className="text-xs font-medium px-2.5 py-1 rounded-full bg-muted/60 text-muted-foreground">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-5 text-sm text-muted-foreground border-y border-border/40 py-4">
                <span className="flex items-center gap-1.5">
                  <Eye className="h-4 w-4" />
                  {viewCount.toLocaleString()} views
                </span>
                <span className="flex items-center gap-1.5">
                  <Heart className="h-4 w-4" />
                  {likeCount.toLocaleString()} {likeCount === 1 ? 'like' : 'likes'}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={handleLike}
                    disabled={isLiking}
                    aria-label={isLiked ? "Unlike" : "Like"}
                    className={cn(
                      "h-11 px-4 rounded-full flex items-center gap-2 text-sm font-semibold border transition-all duration-200 active:scale-95",
                      isLiked
                        ? "bg-red-50 border-red-200 text-red-600 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400"
                        : "border-border hover:bg-muted/60 text-foreground"
                    )}
                  >
                    <Heart className={cn("h-[18px] w-[18px]", isLiked && "fill-current")} />
                    Like
                  </button>
                  <LikeParticles trigger={animateLike} />
                </div>

                <button
                  onClick={openComments}
                  aria-label="Comments"
                  className="h-11 px-4 rounded-full flex items-center gap-2 text-sm font-semibold border border-border hover:bg-muted/60 text-foreground transition-all duration-200 active:scale-95"
                >
                  <MessageCircle className="h-[18px] w-[18px]" />
                  Comment
                </button>

                <button
                  onClick={handleShare}
                  aria-label="Share"
                  className="h-11 w-11 rounded-full flex items-center justify-center border border-border hover:bg-muted/60 text-foreground transition-all duration-200 active:scale-95"
                >
                  <Share2 className="h-[18px] w-[18px]" />
                </button>

                <button
                  onClick={handleBookmark}
                  aria-label={isBookmarked ? "Remove from saved" : "Save"}
                  className={cn(
                    "h-11 w-11 rounded-full flex items-center justify-center border transition-all duration-200 active:scale-95 ml-auto",
                    isBookmarked ? "border-primary/30 text-primary bg-primary/5" : "border-border hover:bg-muted/60 text-foreground"
                  )}
                >
                  <Bookmark className={cn("h-[18px] w-[18px]", isBookmarked && "fill-current")} />
                </button>
              </div>

              {/* Price / purchase CTA */}
              {artwork.price > 0 && (artwork.accessType === "premium" || artwork.accessType === "exclusive") && (
                <div className="pt-2">
                  <div className="flex items-baseline justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Price</span>
                    <span className="text-2xl font-black text-foreground">{format(artwork.price, artwork.currency)}</span>
                  </div>
                  <PayArtworkButton
                    artworkId={id!}
                    amount={artwork.price}
                    artworkTitle={artwork.title}
                    className="w-full h-12 rounded-2xl font-black bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 hover:from-amber-500 hover:via-orange-600 hover:to-red-600 text-white border-none shadow-lg transition-all active:scale-[0.98]"
                    onSuccess={() => window.location.reload()}
                  />
                </div>
              )}
            </div>
          </div>

          {/* ── RELATED ARTWORK ─────────────────────────────────────── */}
          {relatedArtworks.length > 0 && (
            <section className="mt-16 sm:mt-24">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground mb-6 sm:mb-8">
                More to Discover
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                {relatedArtworks.map((related, idx) => (
                  <ArtworkDiscoveryCard
                    key={related.id}
                    {...related}
                    position={idx}
                    surface="artwork_related"
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      {id && <ArtworkFeedback artworkId={id} isOpen={commentsOpen} onClose={() => setCommentsOpen(false)} />}
      {!isModal && <Footer />}
    </div>
  );
}
