
import React from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Users, BadgeCheck } from "lucide-react";

interface FeaturedArtistCardProps {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  followers?: number;
  bio?: string;
  verified?: boolean;
}

const FeaturedArtistCard = ({
  id,
  name,
  category,
  imageUrl,
  followers = 0,
  bio = "",
  verified = false,
}: FeaturedArtistCardProps) => {
  return (
    <Link to={`/artist/${id}`} className="block h-full group">
      <Card className="relative h-full overflow-hidden rounded-2xl sm:rounded-[2rem] border border-muted/20 bg-card shadow-lg hover:shadow-2xl transition-all duration-500">
        <div className="relative aspect-[4/5] sm:aspect-square overflow-hidden">
          <img
            src={imageUrl}
            alt={name}
            className="object-cover w-full h-full transition-transform duration-1000 group-hover:scale-110"
            loading="lazy"
          />
          {/* Enhanced overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-60 sm:opacity-40 group-hover:opacity-80 transition-opacity duration-500" />
          
          {/* Premium Badge */}
          {verified && (
             <div className="absolute top-4 right-4 z-10">
               <div className="px-3 py-1.5 bg-amber-500/90 backdrop-blur-md rounded-full flex items-center gap-1.5 shadow-lg border border-amber-400/50">
                <Crown className="w-3.5 h-3.5 text-white" />
                <span className="text-[10px] font-black uppercase tracking-tighter text-white">Premium</span>
              </div>
             </div>
          )}

          {/* Social Proof Overlay (Mobile specialized) */}
          <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-white/90">
                <Users className="w-3.5 h-3.5" />
                <span className="text-[11px] font-bold tracking-tight">{followers.toLocaleString()} Followers</span>
              </div>
          </div>
        </div>

        <CardContent className="p-4 sm:p-6 bg-white dark:bg-card">
          <div className="space-y-1">
            <h3 className="font-black text-lg sm:text-xl text-foreground tracking-tight line-clamp-1 group-hover:text-primary transition-colors">
              {name}
            </h3>
            <p className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/40" />
              {category}
            </p>
          </div>
          
          {bio && (
            <p className="text-xs sm:text-sm mt-3 line-clamp-2 text-muted-foreground leading-relaxed font-medium italic opacity-80">
              "{bio}"
            </p>
          )}


        </CardContent>
      </Card>
    </Link>
  );
};

export default FeaturedArtistCard;
