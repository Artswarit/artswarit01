import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import ArtworkCard from "@/components/artwork/ArtworkCard";
import ArtworkCardModern from "@/components/artist-profile/ArtworkCardModern";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Star, MapPin, Mail, Lock, Crown, Image, Layers, User, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ReviewCard from "@/components/reviews/ReviewCard";
import { useCurrencyFormat } from "@/hooks/useCurrencyFormat";
import { useArtworkPayment } from "@/hooks/useArtworkPayment";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface GalleryArtwork {
  id: string;
  title: string;
  img: string;
  views: number;
  likes: number;
  price?: number;
  currency?: string;
  isPremium?: boolean;
  isExclusive?: boolean;
  type?: string;
  artistId?: string;
  artistName?: string;
  category?: string;
}
interface AboutDetails {
  artist: any;
  projectsCount: number;
  avgRating: number;
  reviewCount: number;
}
interface ServiceItem {
  id: string;
  title: string;
  description: string | null;
  starting_price: number | null;
}
interface ReviewItem {
  id: string;
  client_id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  clientName: string;
  clientAvatar: string | null;
  artist_response?: string | null;
  artist_response_at?: string | null;
}
interface ArtistTabsProps {
  artistId: string;
  allArt: GalleryArtwork[];
  premiumArt: GalleryArtwork[];
  exclusiveArt: GalleryArtwork[];
  pinnedIds?: string[];
  aboutDetails?: AboutDetails;
  services?: ServiceItem[];
  reviews?: ReviewItem[];
  onArtworkClick?: (art: GalleryArtwork) => void;
  isArtistOwner?: boolean;
  onRefreshReviews?: () => void;
  currentUserId?: string | null;
}
const PAGE_SIZE = 6;
const ART_TABS = ["all", "premium", "exclusive"];
const ArtistTabs: React.FC<ArtistTabsProps> = ({
  artistId,
  allArt,
  premiumArt,
  exclusiveArt,
  pinnedIds = [],
  aboutDetails,
  services: initialServices = [],
  reviews: initialReviews = [],
  onArtworkClick,
  isArtistOwner = false,
  onRefreshReviews,
  currentUserId
}) => {
  const [tab, setTab] = useState("all");
  const [page, setPage] = useState(1);
  // null = dialog closed. string (possibly "") = open, prefilled with service title.
  const [requestServiceTitle, setRequestServiceTitle] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { initiatePayment, loading: paymentLoading } = useArtworkPayment();
  const { toast } = useToast();
  const { formatPlus, userCurrencySymbol } = useCurrencyFormat();
  
  // Track unlocked artworks
  const [unlockedArtworkIds, setUnlockedArtworkIds] = useState<Set<string>>(new Set());
  const [exclusiveStatus, setExclusiveStatus] = useState<"none" | "pending" | "approved" | "rejected">("none");
  const [exclusiveLoading, setExclusiveLoading] = useState(false);

  const [reviews, setReviews] = useState<any[]>(initialReviews);
  const [reviewLoading, setReviewLoading] = useState(true);
  const [services, setServices] = useState<any[]>(initialServices);
  const [servicesLoading, setServicesLoading] = useState(true);

  // Fetch reviews for the current artist
  useEffect(() => {
    async function fetchReviews() {
      if (!artistId) return;
      const {
        data,
        error
      } = await supabase.from("project_reviews").select("*").eq("artist_id", artistId).order("created_at", {
        ascending: false
      });
      if (!error && data) {
        const formattedReviews = await Promise.all(data.map(async (r: any) => {
          const {
            data: p
          } = await supabase.from("public_profiles").select("full_name, avatar_url").eq("id", r.client_id).single();
          return {
            id: r.id,
            rating: r.rating,
            comment: r.review_text || '',
            date: new Date(r.created_at).toLocaleDateString(),
            clientName: p?.full_name || "Art Collector",
            clientAvatar: p?.avatar_url
          };
        }));
        setReviews(formattedReviews);
      }
      setReviewLoading(false);
    }
    fetchReviews();
  }, [artistId]);

  // Fetch services for the current artist
  useEffect(() => {
    async function fetchServices() {
      if (!artistId) return;
      const {
        data,
        error
      } = await supabase.from("artist_services").select("*").eq("artist_id", artistId);
      if (!error && data) {
        setServices(data);
      }
      setServicesLoading(false);
    }
    fetchServices();
  }, [artistId]);

  const normalizeExclusiveStatus = (status: any): "none" | "pending" | "approved" | "rejected" => {
    if (!status) return "none";
    const s = String(status).toLowerCase().trim();
    if (s === "approved") return "approved";
    if (s === "pending") return "pending";
    if (s === "rejected") return "rejected";
    return "none";
  };

  // Fetch user's unlocked artworks on mount
  useEffect(() => {
    async function fetchUnlockedArtworks() {
      if (!user?.id) return;
      
      const { data } = await supabase
        .from('artwork_unlocks')
        .select('artwork_id')
        .eq('user_id', user.id);
      
      if (data) {
        setUnlockedArtworkIds(new Set(data.map(u => u.artwork_id)));
      }
    }
    
    fetchUnlockedArtworks();
  }, [user?.id]);

  // Fetch exclusive membership status for this artist
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function fetchExclusiveStatus() {
      if (!user?.id || !artistId) return;
      setExclusiveLoading(true);
      const { data, error } = await supabase
        .from("exclusive_memberships")
        .select("status")
        .eq("artist_id", artistId)
        .eq("client_id", user.id)
        .maybeSingle();

      if (!error && data) {
        setExclusiveStatus(normalizeExclusiveStatus((data as any).status));
      } else if (!error && !data) {
        setExclusiveStatus("none");
      }
      setExclusiveLoading(false);
    }

    fetchExclusiveStatus();

    if (user?.id && artistId) {
      channel = supabase
        .channel(`exclusive-membership-${artistId}-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'exclusive_memberships',
            filter: `client_id=eq.${user.id}`,
          },
          (payload) => {
            const row = (payload.new || payload.old) as any;
            if (row && row.artist_id === artistId && row.client_id === user.id && row.status) {
              setExclusiveStatus(normalizeExclusiveStatus(row.status));
            }
          }
        )
        .subscribe();
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user?.id, artistId]);

  // Handle artwork unlock payment
  const handleUnlockArtwork = useCallback((artworkId: string) => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please log in to unlock premium artworks.",
        variant: "destructive"
      });
      return;
    }
    
    initiatePayment({
      artworkId,
      onSuccess: () => {
        // Add to unlocked set
        setUnlockedArtworkIds(prev => new Set([...prev, artworkId]));
      }
    });
  }, [user, initiatePayment]);

  // Handle exclusive access request
  const handleRequestAccess = useCallback(async (artworkId: string, artistName?: string) => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please log in to request access to exclusive content.",
        variant: "destructive"
      });
      return;
    }

    if (exclusiveStatus === "approved") {
      toast({
        title: "Already Approved",
        description: "You already have access to this artist's exclusive content."
      });
      return;
    }

    if (exclusiveStatus === "pending") {
      toast({
        title: "Request Pending",
        description: "Your request is already pending approval from the artist."
      });
      return;
    }

    setExclusiveLoading(true);

    // Ensure client has a profile row to satisfy foreign key
    try {
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (!existingProfile) {
        await supabase.from("profiles").insert({
          id: user.id,
          email: user.email || "",
          full_name:
            (user as any).user_metadata?.full_name ||
            (user as any).user_metadata?.name ||
            user.email?.split("@")[0] ||
            "User",
          role: "client",
        });
      }
    } catch (e) {
      console.error("Failed to ensure client profile before exclusive request", e);
    }

    try {
      const { error } = await supabase
        .from("exclusive_memberships")
        .upsert(
          {
            artist_id: artistId,
            client_id: user.id,
            status: "pending"
          },
          { onConflict: "artist_id,client_id" }
        );

      if (error) {
        console.error("Exclusive access request failed", error);
        const description =
          (error as any)?.message ||
          (typeof error === "string" ? error : null) ||
          "Could not send your exclusive access request. Please try again.";
        toast({
          title: "Request Failed",
          description,
          variant: "destructive"
        });
        return;
      }

      const clientName =
        (user as any)?.user_metadata?.full_name ||
        (user as any)?.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "A client";

      if (artistId && artistId !== user.id) {
        try {
          await supabase.from("notifications").insert({
            user_id: artistId,
            title: "New Exclusive Access Request",
            message: `${clientName} requested exclusive access to your exclusive content.`,
            type: "info",
            metadata: {
              artist_id: artistId,
              client_id: user.id
            }
          });
        } catch (notifyError) {
          console.error("Failed to send exclusive request notification", notifyError);
        }
      }

      setExclusiveStatus("pending");
      toast({
        title: "Access Requested",
        description: `Your request has been sent to ${artistName || "the artist"}. You will see exclusive content once approved.`
      });
    } catch (err: any) {
      console.error("Exclusive access request failed (exception)", err);
      toast({
        title: "Request Failed",
        description: err?.message || "Could not send your exclusive access request. Please try again.",
        variant: "destructive"
      });
    } finally {
      setExclusiveLoading(false);
    }
  }, [user, artistId, exclusiveStatus, toast]);

  // Open the right tab when arriving from a notification link
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (!tabParam) return;
    const normalized = tabParam === "reviews" ? "about" : tabParam;
    const allowed = ["all", "premium", "exclusive", "services", "about"];
    if (allowed.includes(normalized)) {
      setTab(normalized);
      setPage(1);
    }
  }, [searchParams]);

  // Auto-scroll to a specific review when ?review=<id>
  useEffect(() => {
    const reviewId = searchParams.get("review");
    if (tab !== "about" || !reviewId) return;
    const el = document.getElementById(`review-${reviewId}`);
    if (el) {
      el.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  }, [tab, reviews, searchParams]);

  // Filter artworks by type:
  // "All Art" tab shows ONLY FREE artworks (no premium, no exclusive)
  // "Premium" tab shows ONLY Premium artworks (blurred)
  // "Exclusive" tab shows ONLY Exclusive artworks (heavily blurred)
  
  // Free artworks only for "All" tab
  const freeArt = allArt.filter(a => !a.isPremium && !a.isExclusive);
  
  // Put pinned artworks at the top for "All" (only free ones)
  let allWithPinnedFirst = freeArt;
  if (pinnedIds.length > 0 && freeArt) {
    const pinned = freeArt.filter(a => pinnedIds.includes(a.id));
    const unpinned = freeArt.filter(a => !pinnedIds.includes(a.id));
    allWithPinnedFirst = [...pinned, ...unpinned];
  }
  
  const displayed: Record<string, GalleryArtwork[]> = {
    all: allWithPinnedFirst || [],
    premium: premiumArt || [],
    exclusive: exclusiveArt || []
  };
  const isArtTab = ["all", "premium", "exclusive"].includes(tab);
  const paged = isArtTab && displayed[tab] ? displayed[tab].slice(0, PAGE_SIZE * page) : [];
  const hasMore = isArtTab && displayed[tab] && displayed[tab].length > PAGE_SIZE * page;

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting }
  } = useForm({
    defaultValues: {
      title: "",
      description: "",
      budget: ""
    }
  });

  // Prefill the project title with the chosen service when the dialog opens.
  useEffect(() => {
    if (requestServiceTitle !== null) {
      reset({ title: requestServiceTitle, description: "", budget: "" });
    }
  }, [requestServiceTitle]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitRequest = async (values: { title: string; description: string; budget: string }) => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please log in to send a project request.",
        variant: "destructive",
      });
      return;
    }
    try {
      const clientName =
        (user as any)?.user_metadata?.full_name ||
        (user as any)?.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "A client";
      const budgetText = values.budget ? ` (Budget: ${userCurrencySymbol}${values.budget})` : "";
      await supabase.from("notifications").insert({
        user_id: artistId,
        title: `New project request: ${values.title}`,
        message: `${clientName} sent a project request${budgetText}. ${values.description}`.slice(0, 500),
        type: "info",
        metadata: {
          kind: "project_request",
          client_id: user.id,
          title: values.title,
          description: values.description,
          budget: values.budget || null,
          currency: userCurrencySymbol,
        },
      });
      toast({
        title: "Project request sent!",
        description: "The artist will be notified of your interest.",
      });
      reset({ title: "", description: "", budget: "" });
      setRequestServiceTitle(null);
    } catch (err: any) {
      console.error("Project request failed", err);
      toast({
        title: "Could not send request",
        description: err?.message || "Please try again in a moment.",
        variant: "destructive",
      });
    }
  };

  return <div>
      <Tabs value={tab} onValueChange={v => {
      setTab(v);
      setPage(1);
    }}>
        <div className="relative mb-6 sm:mb-10 group mt-4">
          <div className="w-full overflow-x-auto pb-4 scrollbar-hide px-1">
            <TabsList className="flex items-center justify-start lg:justify-center w-max sm:w-full min-w-full bg-white/10 dark:bg-black/20 backdrop-blur-2xl p-1.5 sm:p-2.5 rounded-3xl sm:rounded-[3rem] border border-white/20 shadow-2xl h-auto">
              <TabsTrigger 
                value="all" 
                className="flex items-center justify-center gap-2 px-4 sm:px-8 py-3.5 sm:py-5 rounded-2xl sm:rounded-[2.5rem] data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-2xl data-[state=active]:shadow-primary/20 transition-all duration-300 font-black uppercase tracking-widest text-[10px] sm:text-xs h-full"
              >
                <Image size={16} className="shrink-0" />
                <span className="hidden xs:inline">Portfolio</span>
                {freeArt.length > 0 && <span className="ml-1 opacity-40 font-bold">({freeArt.length})</span>}
              </TabsTrigger>
              <TabsTrigger 
                value="premium" 
                className="flex items-center justify-center gap-2 px-4 sm:px-8 py-3.5 sm:py-5 rounded-2xl sm:rounded-[2.5rem] data-[state=active]:bg-white data-[state=active]:text-amber-600 data-[state=active]:shadow-2xl data-[state=active]:shadow-amber-500/20 transition-all duration-300 font-black uppercase tracking-widest text-[10px] sm:text-xs h-full"
              >
                <Crown size={16} className={cn("shrink-0", tab === "premium" ? "text-amber-500" : "")} />
                <span className="hidden xs:inline">Premium</span>
                {premiumArt.length > 0 && <span className="ml-1 opacity-40 font-bold">({premiumArt.length})</span>}
              </TabsTrigger>
              <TabsTrigger 
                value="exclusive" 
                className="flex items-center justify-center gap-2 px-4 sm:px-8 py-3.5 sm:py-5 rounded-2xl sm:rounded-[2.5rem] data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-2xl data-[state=active]:shadow-purple-500/20 transition-all duration-300 font-black uppercase tracking-widest text-[10px] sm:text-xs h-full"
              >
                <Layers size={16} className={cn("shrink-0", tab === "exclusive" ? "text-purple-500" : "")} />
                <span className="hidden xs:inline">Exclusive</span>
                {exclusiveArt.length > 0 && <span className="ml-1 opacity-40 font-bold">({exclusiveArt.length})</span>}
              </TabsTrigger>
              <TabsTrigger 
                value="services" 
                className="flex items-center justify-center gap-2 px-4 sm:px-8 py-3.5 sm:py-5 rounded-2xl sm:rounded-[2.5rem] data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-2xl data-[state=active]:shadow-primary/20 transition-all duration-300 font-black uppercase tracking-widest text-[10px] sm:text-xs h-full"
              >
                <Star size={16} className="shrink-0" />
                <span className="hidden xs:inline">Services</span>
              </TabsTrigger>
              <TabsTrigger 
                value="about" 
                className="flex items-center justify-center gap-2 px-4 sm:px-8 py-3.5 sm:py-5 rounded-2xl sm:rounded-[2.5rem] data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-2xl data-[state=active]:shadow-primary/20 transition-all duration-300 font-black uppercase tracking-widest text-[10px] sm:text-xs h-full"
              >
                <User size={16} className="shrink-0" />
                <span className="hidden xs:inline">About</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value={tab}>
          {isArtTab && <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 my-4">
                {paged.map(art => {
                  const hasExclusiveAccess = art.isExclusive && exclusiveStatus === "approved";
                  const isUnlocked = unlockedArtworkIds.has(art.id) || isArtistOwner || hasExclusiveAccess;
                  
                  // Use ArtworkCardModern for Premium/Exclusive tabs with blur/lock
                  if (tab === "premium" || tab === "exclusive") {
                    return (
                      <ArtworkCardModern
                        key={art.id}
                        title={art.title}
                        img={art.img}
                        views={art.views}
                        likes={art.likes}
                        price={art.price}
                        currency={art.currency}
                        isPremium={art.isPremium}
                        isExclusive={art.isExclusive}
                        isUnlocked={isUnlocked as any}
                        onViewFull={() => onArtworkClick?.({ ...art } as any)}
                        onUnlock={() => handleUnlockArtwork(art.id)}
                        onRequestAccess={() => handleRequestAccess(art.id, art.artistName)}
                      />
                    );
                  }
                  // Use regular ArtworkCard for "All Art" (free artworks)
                  return (
                    <ArtworkCard
                      key={art.id}
                      id={art.id}
                      title={art.title}
                      artist={art.artistName || "Artist"}
                      artistId={art.artistId || ""}
                      type={art.type || "image"}
                      imageUrl={art.img}
                      likes={art.likes}
                      views={art.views}
                      price={art.price}
                      currency={art.currency}
                      category={art.category}
                    />
                  );
                })}
              </div>
              {hasMore && <div className="flex justify-center mt-2">
                  <button onClick={() => setPage(page + 1)} className="bg-white/60 hover:bg-white/80 text-purple-700 px-5 py-2 rounded-lg shadow font-semibold">
                    Load more
                  </button>
                </div>}
              {paged.length === 0 && <div className="text-muted-foreground text-center py-10">
                  No art in this section.
                </div>}
            </>}

          {/* Services Tab */}
          {tab === "services" && <div className="my-6 max-w-2xl mx-auto">
              <h3 className="font-bold text-xl text-purple-900 mb-3 flex items-center gap-2">
                <Mail className="text-purple-500" size={22} />
                Services & Project Request
              </h3>

              {services.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground text-center">
                  This artist hasn't listed fixed services yet.
                  <div className="mt-4">
                    <Button
                      onClick={() => setRequestServiceTitle("")}
                      className="bg-violet-600 text-white hover:bg-violet-700 gap-2"
                    >
                      <Mail size={16} /> Send a Project Request
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4">
                  {services.map(service => (
                    <div
                      key={service.id}
                      className="p-4 rounded-xl border bg-card shadow-sm flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-base sm:text-lg font-semibold text-foreground">
                          {service.title}
                        </div>
                        {service.description && (
                          <div className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                            {service.description}
                          </div>
                        )}
                        {service.starting_price !== null && (
                          <div className="font-semibold text-amber-700 mt-2 text-sm">
                            {formatPlus(service.starting_price)}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 sm:ml-auto">
                        <Button
                          onClick={() => setRequestServiceTitle(service.title)}
                          className="w-full sm:w-auto bg-violet-600 text-white hover:bg-violet-700 gap-2 h-11"
                        >
                          <Mail size={16} /> Request
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>}

          {/* Expanded "About" tab details */}
          {tab === "about" && aboutDetails && <div className="my-8 px-2 max-w-xl mx-auto">
              <h3 className="font-bold text-xl text-purple-900 mb-2">
                {aboutDetails.artist.name}
              </h3>

              <div className="flex flex-col gap-2 mb-4 text-[15px]">
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin size={18} className="text-purple-400" />
                  <span>{aboutDetails.artist.location || "Location not specified"}</span>
                </div>
                {aboutDetails.artist.email && <div className="flex items-center gap-2 text-gray-600">
                    <Mail size={18} className="text-blue-400" />
                    <a href={`mailto:${aboutDetails.artist.email}`} className="hover:underline">
                      {aboutDetails.artist.email}
                    </a>
                  </div>}
                {aboutDetails.artist.website && <div className="flex items-center gap-2 text-gray-600">
                    <span className="font-semibold">Website:</span>
                    <a href={aboutDetails.artist.website} className="text-blue-700 hover:underline" target="_blank" rel="noopener noreferrer">
                      {aboutDetails.artist.website}
                    </a>
                  </div>}
              </div>

              <div className="mb-3">
                <span className="font-semibold text-gray-700 mr-2">Bio:</span>
                <span className="text-gray-800">{aboutDetails.artist.bio || "No bio available."}</span>
              </div>

              {/* Compute stats from reviews prop */}
              {(() => {
            const reviewCount = reviews.length;
            const avgRating = reviewCount > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount : 0;
            return <>
                    <div className="flex flex-wrap gap-x-7 gap-y-1 mb-4">
                      <div>
                        <span className="font-semibold text-gray-700">Projects Done: </span>
                        <span className="text-purple-900 font-bold">{aboutDetails.projectsCount}</span>
                      </div>
                      {avgRating > 0 && <div className="flex items-center gap-1">
                          <span className="font-semibold text-gray-700">Avg. Rating:</span>
                          <span className="text-yellow-600 font-bold">{avgRating.toFixed(1)}</span>
                          <Star className="text-yellow-400 fill-yellow-400" size={20} />
                        </div>}
                      <div>
                        <span className="font-semibold text-gray-700">Reviews:</span>
                        <span className="ml-1 font-bold">{reviewCount}</span>
                      </div>
                    </div>

                    <hr className="my-4" />

                    <div className="mb-5">
                      <h4 className="font-semibold text-lg mb-3 text-purple-900">Client Reviews</h4>
                      {reviewCount === 0 ? <div className="bg-gray-50 rounded-lg px-5 py-4 border border-gray-200 text-center text-gray-500">
                          No reviews yet. Be the first to work with this artist!
                        </div> : <div className="space-y-4">
                          {reviews.map(rev => {
                    const isHighlighted = searchParams.get("review") === rev.id;
                    return <div key={rev.id} id={`review-${rev.id}`} className={isHighlighted ? "scroll-mt-24 rounded-lg ring-2 ring-primary/30" : "scroll-mt-24"}>
                                <ReviewCard reviewId={rev.id} artistId={artistId} clientId={rev.client_id} clientName={rev.clientName} clientAvatar={rev.clientAvatar} rating={rev.rating} reviewText={rev.review_text} createdAt={rev.created_at} artistResponse={rev.artist_response} artistResponseAt={rev.artist_response_at} isArtistOwner={isArtistOwner} currentUserId={currentUserId} onResponseAdded={onRefreshReviews} onReviewUpdated={onRefreshReviews} />
                              </div>;
                  })}
                        </div>}
                    </div>
                  </>;
          })()}
            </div>}
        </TabsContent>
      </Tabs>

      {/* Project Request — full-view dialog */}
      <Dialog
        open={requestServiceTitle !== null}
        onOpenChange={(open) => !open && setRequestServiceTitle(null)}
      >
        <DialogContent
          className="p-0 gap-0 border-0 sm:border bg-background w-screen h-[100dvh] max-w-none rounded-none sm:w-full sm:max-w-xl sm:h-auto sm:max-h-[90vh] sm:rounded-2xl overflow-hidden flex flex-col"
        >
          <DialogHeader className="px-5 sm:px-6 py-4 border-b border-border/60 bg-background/95 backdrop-blur sticky top-0 z-10">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                <Mail className="text-primary" size={18} />
                Send Project Request
              </DialogTitle>
              <button
                onClick={() => setRequestServiceTitle(null)}
                aria-label="Close"
                className="h-9 w-9 inline-flex items-center justify-center rounded-full hover:bg-muted transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </DialogHeader>

          <form
            onSubmit={handleSubmit(submitRequest)}
            className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5"
          >
            <div>
              <label className="font-medium text-foreground block mb-1.5 text-sm">Project Title</label>
              <Input placeholder="E.g. 'Custom Portrait'" required {...register("title")} />
            </div>
            <div>
              <label className="font-medium text-foreground block mb-1.5 text-sm">Project Description</label>
              <Textarea
                placeholder="Describe what you want, deadlines, references…"
                rows={6}
                required
                {...register("description")}
              />
            </div>
            <div>
              <label className="font-medium text-foreground block mb-1.5 text-sm">
                Budget <span className="text-muted-foreground font-normal">(optional, in {userCurrencySymbol})</span>
              </label>
              <Input type="number" min={0} placeholder={`Amount in ${userCurrencySymbol}`} {...register("budget")} />
            </div>
          </form>

          <div className="px-5 sm:px-6 py-4 border-t border-border/60 bg-background/95 backdrop-blur flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] sm:pb-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRequestServiceTitle(null)}
              className="h-11"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              onClick={handleSubmit(submitRequest)}
              className="h-11 bg-violet-600 text-white hover:bg-violet-700 gap-2"
            >
              <Mail size={16} />
              {isSubmitting ? "Sending…" : "Send Request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>;
};
export default ArtistTabs;
