import React from "react";
import GlassCard from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import StatCard from "./StatCard";
import ArtistActionsBar from "./ArtistActionsBar";
import { Star, Save, FilePlus, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useArtistPlan } from "@/hooks/useArtistPlan";
import { getOptimizedImageUrl, ImagePresets } from "@/lib/image-optimization";

type Props = {
  artist: any;
  onFollow: () => void;
  isFollowing: boolean;
  onMessage: () => void;
  canMessage?: boolean;
  isSaved: boolean;
  onSave: () => void;
  onRequest: () => void;
  loadingFollow: boolean;
  loadingSave: boolean;
};

// Helper component to render stars visually
const StarRating = ({ value }: { value: number }) => {
  const stars = [];
  for (let i = 1; i <= 5; ++i) {
    stars.push(
      <Star
        key={i}
        size={14}
        className={`mr-0.5 ${
          value >= i ? "text-yellow-400 fill-yellow-400" : "text-gray-300"
        }`}
        strokeWidth={1.5}
        fill={value >= i ? "#facc15" : "none"}
      />
    );
  }
  return <div className="flex">{stars}</div>;
};

const ArtistHeader: React.FC<Props> = ({
  artist,
  onFollow,
  isFollowing,
  onMessage,
  canMessage = true,
  isSaved,
  onSave,
  onRequest,
  loadingFollow,
  loadingSave,
}) => {
  // Check if artist is a Pro subscriber (real-time)
  const { isProArtist } = useArtistPlan(artist.id);
  // Stats for dopamine effect - use real data
  const stats = [
    {
      type: "followers",
      value: artist.followers ?? 0,
      label: "Followers",
    },
    {
      type: "likes",
      value: artist.likes ?? 0,
      label: "Likes",
    },
    {
      type: "views",
      value: artist.views ?? 0,
      label: "Views",
    },
    {
      type: "rating",
      value: artist.rating ?? 0,
      label: "Rating",
    },
  ];

  // Use real data for artist overview - no mock fallbacks
  const artistAllDetails = {
    totalProjects: artist.totalProjects ?? 0,
    avgRating: artist.rating ?? 0,
    reviewCount: artist.reviewCount ?? 0,
  };

  return (
    <div className="relative w-full min-h-[280px] sm:min-h-[320px] lg:min-h-[380px] flex flex-col">
      {/* Background with simple dark overlay only */}
      <div className="absolute inset-0 overflow-hidden rounded-b-xl sm:rounded-b-2xl lg:rounded-b-[2.5rem]">
        <img
          src={getOptimizedImageUrl(artist.cover, ImagePresets.PROFILE_COVER)}
          alt=""
          loading="eager"
          fetchPriority="high"
          className="w-full h-full object-cover object-center scale-105 blur-sm opacity-70 transition-all duration-300"
          style={{ filter: "blur(5px)" }}
        />
        <div className="absolute inset-0 bg-black/70" />
      </div>
      
      <div className="relative w-full flex flex-col z-10 gap-4 p-3 sm:p-6 lg:p-10 pb-3 sm:pb-4">
        {/* Mobile-first layout: Stack everything vertically on small and medium screens until 'lg' (1024px) */}
        <div className="flex flex-col lg:flex-row items-center lg:items-end gap-6 sm:gap-8 lg:gap-12 w-full">
          {/* Avatar + Info block */}
          <div className="flex flex-col lg:flex-row items-center lg:items-end gap-6 lg:gap-8 w-full lg:w-auto">
            <div className="p-2 sm:p-3 flex flex-col items-center justify-center shadow-2xl rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md relative group">
              <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <img
                src={getOptimizedImageUrl(artist.avatar, ImagePresets.THUMBNAIL)}
                alt={artist.name}
                className="w-24 h-24 sm:w-32 sm:h-32 lg:w-40 lg:h-40 rounded-full border-4 border-white object-cover shadow-2xl relative z-10 transition-transform duration-500 group-hover:scale-105"
                style={{
                  aspectRatio: "1/1",
                  background: "white",
                }}
              />
            </div>
            
            {/* Info - Centered on mobile/tablet, left-aligned on laptop/desktop */}
            <div className="flex flex-col gap-3 lg:gap-4 text-white text-center lg:text-left min-w-0 w-full lg:flex-1">
              <div className="flex flex-col lg:items-start items-center gap-2">
                <h1 className="text-3xl sm:text-4xl lg:text-6xl font-black font-heading drop-shadow-2xl tracking-tighter text-white">
                  {artist.name}
                </h1>
                {/* Show Premium badge - Adjusted for better mobile fit */}
                {isProArtist && (
                  <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-yellow-950 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs sm:text-sm font-black border border-yellow-200/50 shadow-xl shadow-yellow-500/20 active:scale-95 transition-transform">
                    <Crown size={14} className="animate-bounce" /> 
                    <span className="uppercase tracking-widest">Premium Artist</span>
                  </Badge>
                )}
              </div>
              
              {/* Bio with high-contrast background for perfect readability */}
              <div className="text-sm lg:text-lg text-white font-medium max-w-xl mx-auto lg:mx-0">
                <div className="inline-block bg-black/60 backdrop-blur-xl text-white px-4 py-2 sm:px-6 sm:py-2.5 rounded-2xl sm:rounded-[2rem] shadow-2xl border border-white/10">
                  <span className="tracking-tight">{artist.tagline || artist.category}</span>
                </div>
              </div>
              
              {/* Tags - Better wrap behavior */}
              <div className="flex flex-wrap gap-2 items-center justify-center lg:justify-start mt-1">
                {artist.tags &&
                  artist.tags.map((t: string) => (
                    <span
                      key={t}
                      className="bg-primary/20 hover:bg-primary/40 backdrop-blur-lg text-white px-3 py-1 sm:px-4 sm:py-1.5 rounded-full text-[10px] sm:text-xs shadow-lg border border-white/10 font-black uppercase tracking-widest transition-all cursor-default"
                    >
                      {t}
                    </span>
                  ))}
              </div>
              
              {/* Dopamine trigger stats: Using flex-wrap for absolute multi-device safety */}
              <div className="flex flex-wrap justify-center lg:justify-start gap-2 sm:gap-3 mt-3 sm:mt-4 p-3 sm:p-4 bg-white/5 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-white/10 shadow-2xl">
                {stats.map((stat) => (
                  <div key={stat.type} className="flex-1 min-w-[100px] sm:min-w-[120px]">
                    <StatCard
                      type={stat.type as any}
                      value={stat.value}
                      label={stat.label}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Actions - Bottom on mobile/tablet, right on laptop/desktop */}
          <div className="w-full lg:w-auto lg:min-w-[280px] mt-4 lg:mt-0">
            <ArtistActionsBar
              isFollowing={isFollowing}
              onFollow={onFollow}
              onMessage={onMessage}
              canMessage={canMessage}
              isSaved={isSaved}
              onSave={onSave}
              onRequest={onRequest}
              loadingFollow={loadingFollow}
              loadingSave={loadingSave}
            />
          </div>
        </div>
      </div>
      
      {/* Artist summary section - Responsive positioning */}
      <div className="relative w-full px-3 sm:px-5 lg:px-10 pt-4 sm:pt-6 z-10 pb-8">
        <div className="bg-white/95 dark:bg-card/95 backdrop-blur-xl rounded-2xl sm:rounded-[3rem] shadow-2xl border border-muted/20 p-6 sm:p-10 w-full lg:max-w-3xl lg:ml-auto lg:mr-0 xl:mr-24 mt-4 group hover:shadow-primary/10 transition-all duration-700">
          <h3 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent mb-4">Artist Overview</h3>
          <div className="grid grid-cols-2 xs:grid-cols-3 gap-4 sm:gap-8 items-center mb-4">
            <div className="text-center sm:text-left space-y-1">
              <span className="block text-2xl sm:text-3xl font-black text-primary tracking-tight">{artistAllDetails.totalProjects}</span>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">Projects Done</span>
            </div>
            <div className="text-center sm:text-left space-y-1">
              <span className="block text-2xl sm:text-3xl font-black text-yellow-500 tracking-tight">{artistAllDetails.avgRating.toFixed(1)}</span>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-center sm:justify-start gap-1">
                Avg. Rating
              </span>
              <div className="flex justify-center sm:justify-start">
                <StarRating value={artistAllDetails.avgRating} />
              </div>
            </div>
            <div className="col-span-2 xs:col-span-1 text-center sm:text-left space-y-1">
              <span className="block text-2xl sm:text-3xl font-black text-pink-600 tracking-tight">{artistAllDetails.reviewCount}</span>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">Reviews</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-muted/20 text-xs sm:text-sm text-muted-foreground leading-relaxed">
            <p className="italic">"A quick overview of regular performance and professional reputation."</p>
            <div className="mt-2 flex items-center gap-1.5 font-bold text-foreground">
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              <span>Explore all works in the Portfolio below!</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArtistHeader;
