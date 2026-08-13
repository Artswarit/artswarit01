import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { usePublicArtworks } from '@/hooks/usePublicArtworks';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ArtworkCard from '@/components/artwork/ArtworkCard';
import TopFilters from '@/components/explore/TopFilters';
import RecentlyViewed from '@/components/explore/RecentlyViewed';
import GlassCard from '@/components/ui/glass-card';
import { Loader2 } from 'lucide-react';
import LogoLoader from '@/components/ui/LogoLoader';
import { Button } from '@/components/ui/button';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArtworkSkeleton } from '@/components/artwork/ArtworkSkeleton';
import { track } from '@/lib/analytics';

const Explore = () => {
  const { artworks, loading, error, hasMore, loadMore, loadingMore, refetch } = usePublicArtworks();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filteredArtworks, setFilteredArtworks] = useState(artworks || []);
  const [currentCategory, setCurrentCategory] = useState<string>('all');
  const [activeSearchQuery, setActiveSearchQuery] = useState<string>('');
  const location = useLocation();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const SCROLL_KEY = 'explore_scroll_y';
  // Track previous filter state to detect what actually changed for analytics.
  const lastFiltersRef = useRef<{ search: string; category: string; sortBy: string; artworkType: string; priceRange: string; tags: string[] } | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTrackedQueryRef = useRef<string>('');

  // Restore scroll position only when returning via back button (popstate)
  useEffect(() => {
    const navType = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming)?.type;
    // Only restore when navigating back/forward, not on fresh visits or reloads
    if (navType === 'back_forward') {
      const saved = sessionStorage.getItem(SCROLL_KEY);
      if (saved) {
        const y = parseInt(saved, 10);
        const t = setTimeout(() => window.scrollTo({ top: y }), 80);
        return () => clearTimeout(t);
      }
    } else {
      // Clear stale scroll position on fresh navigation
      sessionStorage.removeItem(SCROLL_KEY);
    }
  }, []);

  // Save scroll position on scroll
  const handleScroll = useCallback(() => {
    sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const categoryMap: Record<string, string> = {
    musicians: 'Musicians',
    writers: 'Writers',
    rappers: 'Rappers',
    editors: 'Editors',
    scriptwriters: 'Scriptwriters',
    photographers: 'Photographers',
    illustrators: 'Illustrators',
    'voice-artists': 'Voice Artists',
    animators: 'Animators',
    designers: 'UI/UX Designers',
    singers: 'Singers',
    dancers: 'Dancers'
  };

  const initialCategory = (() => {
    const params = new URLSearchParams(location.search);
    const slug = params.get('category') || '';
    return categoryMap[slug] || 'all';
  })();

  const initialSearch = (() => {
    const params = new URLSearchParams(location.search);
    const slug = params.get('category') || '';
    return categoryMap[slug] || decodeURIComponent(slug || '');
  })();

  const toSlug = (name: string) =>
    encodeURIComponent(
      (name || '')
        .toLowerCase()
        .trim()
        .replace(/[\s_]+/g, '-')
        .replace(/[^a-z0-9\-]/g, '')
    );

  const trendingArtworks = useMemo(() => {
    return [...(artworks || [])]
      .sort((a, b) => ((b.views || 0) + (b.likes || 0) * 5) - ((a.views || 0) + (a.likes || 0) * 5))
      .slice(0, 4);
  }, [artworks]);

  const handleFiltersChange = (filters: {
    search: string;
    category: string;
    artworkType: string;
    priceRange: string;
    tags: string[];
    sortBy: string;
    location: string;
    approvalStatus?: string;
    minLikes?: number;
    minViews?: number;
    hasAudio?: boolean;
    hasVideo?: boolean;
    forSaleOnly?: boolean;
  }) => {
    let filtered = [...(artworks || [])];
    setActiveSearchQuery(filters.search || '');
    if (filters.category && filters.category !== 'all') {
      const slug = toSlug(filters.category);
      const params = new URLSearchParams(location.search);
      params.set('category', slug);
      navigate(`/explore?${params.toString()}`, { replace: false });
    } else {
      const params = new URLSearchParams(location.search);
      params.delete('category');
      const query = params.toString();
      navigate(query ? `/explore?${query}` : '/explore', { replace: false });
    }


    // Search filter - prioritize artist name matches
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(artwork => {
        const artistName = artwork.artist?.toLowerCase() || '';
        const title = artwork.title.toLowerCase();
        const category = artwork.category?.toLowerCase() || '';
        
        // Prioritize artist name matches
        return artistName.includes(searchTerm) || 
               title.includes(searchTerm) || 
               category.includes(searchTerm);
      });
    }

    // Category filter (artist category)
    if (filters.category && filters.category !== 'all') {
      filtered = filtered.filter(artwork => (artwork.category || '').toLowerCase() === (filters.category || '').toLowerCase());
    }

    // Artwork type filter
    if (filters.artworkType && filters.artworkType !== 'all') {
      filtered = filtered.filter(artwork => artwork.type === filters.artworkType);
    }

    // Price range filter
    if (filters.priceRange !== 'all') {
      filtered = filtered.filter(artwork => {
        if (!artwork.price && filters.priceRange === 'free') return true;
        if (!artwork.price) return filters.priceRange === 'all';
        
        switch (filters.priceRange) {
          case 'free':
            return artwork.price === 0;
          case '0-50':
            return artwork.price > 0 && artwork.price <= 50;
          case '50-100':
            return artwork.price > 50 && artwork.price <= 100;
          case '100-500':
            return artwork.price > 100 && artwork.price <= 500;
          case '500+':
            return artwork.price > 500;
          default:
            return true;
        }
      });
    }

    // Tags filter
    if (filters.tags.length > 0) {
      filtered = filtered.filter(artwork =>
        filters.tags.some(tag =>
          artwork.tags && artwork.tags.some(artworkTag =>
            artworkTag.toLowerCase().includes(tag.toLowerCase())
          )
        )
      );
    }

    // Location filter
    if (filters.location) {
      const searchLoc = filters.location.toLowerCase();
      filtered = filtered.filter(artwork => 
        artwork.artistLocation?.toLowerCase().includes(searchLoc)
      );
    }

    // Approval Status filter (NEW)
    if (filters.approvalStatus && filters.approvalStatus !== "all") {
      filtered = filtered.filter(
        artwork =>
          (artwork.approval_status || "").toLowerCase() === filters.approvalStatus
      );
    }

    // Minimum Likes filter (NEW)
    if (typeof filters.minLikes === "number" && filters.minLikes > 0) {
      filtered = filtered.filter(artwork => (artwork.likes || 0) >= filters.minLikes);
    }

    // Minimum Views filter (NEW)
    if (typeof filters.minViews === "number" && filters.minViews > 0) {
      filtered = filtered.filter(artwork => (artwork.views || 0) >= filters.minViews);
    }

    // Has Audio filter (NEW)
    if (filters.hasAudio) {
      filtered = filtered.filter(artwork => !!artwork.audioUrl);
    }

    // Has Video filter (NEW)
    if (filters.hasVideo) {
      filtered = filtered.filter(artwork => !!artwork.videoUrl);
    }

    // For Sale Only filter (NEW)
    if (filters.forSaleOnly) {
      filtered = filtered.filter(artwork => artwork.is_for_sale === true);
    }

    // Sort filter
    switch (filters.sortBy) {
      case 'artist_name':
        filtered.sort((a, b) => {
          const nameA = a.artist || '';
          const nameB = b.artist || '';
          return nameA.localeCompare(nameB);
        });
        break;
      case 'most_viewed':
        filtered.sort((a, b) => b.views - a.views);
        break;
      case 'most_liked':
        filtered.sort((a, b) => b.likes - a.likes);
        break;
      case 'top_rated':
        filtered.sort((a, b) => (b.views + b.likes) - (a.views + a.likes));
        break;
      case 'price_low':
        filtered.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case 'price_high':
        filtered.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case 'most_recent':
      default:
        // Keep original order for mock data
        break;
    }

    setFilteredArtworks(filtered);

    // ----- Analytics: search / filter / sort -----
    const prev = lastFiltersRef.current;
    const snapshot = {
      search: filters.search || '',
      category: filters.category,
      sortBy: filters.sortBy,
      artworkType: filters.artworkType,
      priceRange: filters.priceRange,
      tags: filters.tags,
    };

    // Debounced search_submitted / zero_results — only fire after user pauses typing.
    if (snapshot.search !== (prev?.search ?? '')) {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      const query = snapshot.search;
      const resultCount = filtered.length;
      searchDebounceRef.current = setTimeout(() => {
        if (!query || query === lastTrackedQueryRef.current) return;
        lastTrackedQueryRef.current = query;
        const started = performance.now();
        track('search_submitted', {
          query,
          result_count: resultCount,
          search_type: 'artwork',
          latency_ms: Math.round(performance.now() - started),
          surface: 'explore',
        });
        if (resultCount === 0) {
          track('zero_results', {
            query,
            filters: {
              category: snapshot.category,
              artworkType: snapshot.artworkType,
              priceRange: snapshot.priceRange,
              tags: snapshot.tags,
            },
            search_type: 'artwork',
          });
        }
        track('search_results_loaded', {
          query,
          result_count: resultCount,
          search_type: 'artwork',
        });
      }, 500);
    }

    if (prev && prev.sortBy !== snapshot.sortBy) {
      track('sort_changed', {
        sort_by: snapshot.sortBy,
        previous_sort: prev.sortBy,
        surface: 'explore',
      });
    }
    if (prev) {
      const filterDiffs: Array<[string, unknown]> = [];
      if (prev.category !== snapshot.category) filterDiffs.push(['category', snapshot.category]);
      if (prev.artworkType !== snapshot.artworkType) filterDiffs.push(['artwork_type', snapshot.artworkType]);
      if (prev.priceRange !== snapshot.priceRange) filterDiffs.push(['price_range', snapshot.priceRange]);
      if (prev.tags.join(',') !== snapshot.tags.join(',')) filterDiffs.push(['tags', snapshot.tags]);
      filterDiffs.forEach(([filter_type, filter_value]) => {
        track('filter_applied', { filter_type, filter_value, surface: 'explore' });
      });
    }
    lastFiltersRef.current = snapshot;
  };

  useEffect(() => {
    if (artworks) {
      setFilteredArtworks(artworks);
    }
  }, [artworks]);

  /* 
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <div className="flex-1 flex items-center justify-center pt-20 sm:pt-24">
          <LogoLoader text="Discovering artworks…" />
        </div>
      </div>
    );
  }
  */

  if (error) {
    console.error('Explore error:', error);
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-4">
          <GlassCard className="p-8 max-w-md w-full text-center space-y-6">
            <div className="text-4xl">⚠️</div>
            <h3 className="text-xl font-black uppercase tracking-tight">Connection Lost</h3>
            <p className="text-muted-foreground font-medium">
              We're having trouble reaching the gallery. Please check your connection and try again.
            </p>
            <Button 
              onClick={() => refetch()}
              className="w-full rounded-2xl h-12 font-black uppercase tracking-widest"
            >
              Retry Connection
            </Button>
          </GlassCard>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background selection:bg-primary/20" ref={scrollRef}>
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative pt-[calc(5rem+var(--safe-top))] sm:pt-[calc(7rem+var(--safe-top))] pb-8 sm:pb-12 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.07),transparent_65%)] pointer-events-none" />
        
        <div className="container-responsive relative mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted/60 text-muted-foreground text-[11px] font-medium tracking-wide mb-5 animate-in fade-in slide-in-from-bottom-3 duration-700">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
            </span>
            Discover new work, daily
          </div>
          
          <h1 className="text-[2rem] sm:text-5xl lg:text-6xl font-semibold mb-4 tracking-[-0.03em] leading-[1.05] text-foreground animate-in fade-in slide-in-from-bottom-4 duration-700">
            Explore the collection
          </h1>
          
          <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto font-normal leading-relaxed animate-in fade-in slide-in-from-bottom-5 duration-700 delay-100">
            Curated work from artists worldwide. Filter by medium, style, or artist to find your next favourite.
          </p>
        </div>
      </section>

      {/* Recently Viewed */}
      <div className="relative z-10 mb-10 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200">
        <RecentlyViewed />
      </div>

      {/* Trending Section */}
      {(trendingArtworks.length > 0 || loading) && (
        <section className="container-responsive mx-auto py-4 animate-in fade-in duration-700 delay-300">
          <div className="flex items-end justify-between mb-6 sm:mb-8">
            <div>
              <h2 className="text-xl sm:text-2xl font-semibold tracking-[-0.02em] text-foreground">Trending now</h2>
              <p className="text-sm text-muted-foreground mt-1">The most viewed and loved pieces this week</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
            {loading ? (
              [...Array(4)].map((_, idx) => <ArtworkSkeleton key={`trend-skeleton-${idx}`} />)
            ) : (
              trendingArtworks.map((artwork, idx) => (
                <div 
                  key={`trending-${artwork.id}`} 
                  className="animate-in fade-in slide-in-from-bottom-3 duration-700"
                  style={{ animationDelay: `${idx * 80}ms` }}
                >
                  <ArtworkCard
                    {...artwork}
                    position={idx}
                    surface="explore_trending"
                  />
                </div>
              ))
            )}
          </div>
          <div className="h-px bg-border/60 mt-10" />
        </section>
      )}

      {/* Filters & Content */}
      <div className="relative pb-24">
        <div className="sticky top-[calc(var(--navbar-height-mobile)+var(--safe-top))] sm:top-[calc(var(--navbar-height-desktop)+var(--safe-top))] z-30 bg-background/80 backdrop-blur-xl border-b border-border/60 mb-6 transition-all duration-300 ease-apple">
          <TopFilters
            onFiltersChange={handleFiltersChange}
            onViewModeChange={setViewMode}
            viewMode={viewMode}
            resultsCount={filteredArtworks?.length || 0}
            initialCategory={initialCategory}
            initialSearch={initialSearch}
          />
        </div>


        <main className="container-responsive mx-auto relative z-0 mt-2">
          {(filteredArtworks && filteredArtworks.length > 0) || loading ? (
            <div className="space-y-10">
              <div className={cn(
                "transition-all duration-500 ease-apple",
                viewMode === 'grid'
                  ? 'grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5 md:gap-6'
                  : 'flex flex-col gap-4 max-w-3xl mx-auto'
              )}>
                {loading ? (
                  [...Array(8)].map((_, idx) => <ArtworkSkeleton key={`skeleton-${idx}`} />)
                ) : (
                  filteredArtworks.map((artwork, idx) => (
                    <div 
                      key={artwork.id}
                      className="animate-in fade-in slide-in-from-bottom-2 duration-500"
                      style={{ animationDelay: `${(idx % 12) * 40}ms` }}
                    >
                      <ArtworkCard
                        {...artwork}
                        position={idx}
                        searchQuery={activeSearchQuery || undefined}
                        surface="explore"
                      />
                    </div>
                  ))
                )}
              </div>

              {hasMore && (
                <div className="flex flex-col items-center justify-center py-10 border-t border-border/60">
                  <Button
                    onClick={loadMore}
                    disabled={loadingMore}
                    variant="outline"
                    className="rounded-full px-8 h-11 font-medium tracking-tight bg-card hover:bg-muted/60 transition-all duration-300 ease-apple active:scale-[0.98]"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading
                      </>
                    ) : (
                      'Load more'
                    )}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-20 sm:py-28">
              <div className="max-w-sm mx-auto space-y-6">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center text-2xl">
                  🎨
                </div>
                <div className="space-y-3">
                  <h3 className="text-xl font-semibold tracking-tight">Nothing here yet</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {currentCategory !== 'all' 
                      ? 'No artworks in this category yet — check back soon.' 
                      : "We couldn't find any artworks matching your filters. Try broadening your search."}
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => handleFiltersChange({
                      search: '', category: 'all', artworkType: 'all', priceRange: 'all', 
                      tags: [], sortBy: 'most_recent', location: ''
                    })}
                    className="rounded-full px-6 h-11 font-medium tracking-tight transition-all duration-300 ease-apple active:scale-[0.98]"
                  >
                    Reset filters
                  </Button>
                </div>
              </div>
            </div>
          )}
        </main>

      </div>

      <Footer />
    </div>
  );
};

export default Explore;
