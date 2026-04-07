import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Eye, Heart } from "lucide-react";
import { usePublicArtworks } from "@/hooks/usePublicArtworks";
import { Skeleton } from "@/components/ui/skeleton";
import Autoplay from "embla-carousel-autoplay";

const ArtworkCarousel = () => {
  const { artworks, loading } = usePublicArtworks();
  const navigate = useNavigate();

  // Get top 6 artworks for carousel
  const featuredArtwork = artworks.slice(0, 6);

  if (loading) {
    return (
      <section id="artwork" className="py-12 sm:py-16 lg:py-20 bg-gradient-to-r from-violet-50 via-white to-indigo-50 relative overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 sm:mb-12 gap-4">
            <div>
              <h2 className="section-title">Featured Artwork</h2>
              <p className="section-subtitle">Explore stunning creations from our talented artists</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[280px] sm:h-[350px] lg:h-[450px] rounded-2xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (featuredArtwork.length === 0) {
    return (
      <section id="artwork" className="py-12 sm:py-16 lg:py-20 bg-gradient-to-r from-violet-50 via-white to-indigo-50 relative overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <h2 className="section-title">Featured Artwork</h2>
          <p className="section-subtitle mb-8">Be the first to upload your artwork!</p>
          <Button asChild>
            <Link to="/signup">Get Started</Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section id="artwork" className="py-12 sm:py-16 lg:py-20 bg-gradient-to-r from-violet-50 via-white to-indigo-50 relative overflow-hidden">
      <div className="absolute inset-0 opacity-50">
        <div className="absolute -top-20 -left-20 w-48 h-48 sm:w-72 sm:h-72 md:w-96 md:h-96 bg-violet-300/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-20 -right-20 w-48 h-48 sm:w-72 sm:h-72 md:w-96 md:h-96 bg-indigo-300/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/4 right-1/4 w-32 h-32 sm:w-48 sm:h-48 md:w-64 md:h-64 bg-blue-200/10 rounded-full blur-2xl"></div>
        <div className="absolute bottom-1/3 left-1/3 w-36 h-36 sm:w-56 sm:h-56 md:w-72 md:h-72 bg-purple-200/15 rounded-full blur-3xl"></div>
      </div>
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 sm:mb-12 gap-4">
          <div>
            <h2 className="section-title">Featured Artwork</h2>
            <p className="section-subtitle">
              Explore stunning creations from our talented artists
            </p>
          </div>
          <Button asChild variant="outline" className="hidden sm:flex border-primary hover:bg-primary hover:text-white transition-all duration-300">
            <Link to="/explore">View All Artwork</Link>
          </Button>
        </div>
        
        <Carousel
          opts={{
            align: "start",
            loop: true,
          }}
          plugins={[
            Autoplay({ delay: 5000, stopOnInteraction: false, stopOnMouseEnter: true })
          ]}
          className="w-full group"
        >
          <CarouselContent className="-ml-3 sm:-ml-4">
            {featuredArtwork.map((artwork) => (
              <CarouselItem key={artwork.id} className="pl-3 sm:pl-4 basis-full sm:basis-1/2 lg:basis-1/3">
                <Link to={`/artwork/${artwork.id}`} className="block h-full group">
                  <div className="h-full overflow-hidden rounded-2xl sm:rounded-[2rem] border border-muted/20 bg-card shadow-lg hover:shadow-2xl transition-all duration-500 flex flex-col">
                    <div className="relative aspect-[3/4] overflow-hidden">
                      {artwork.type === 'video' ? (
                        <video 
                          src={artwork.imageUrl} 
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                        />
                      ) : (
                        <img 
                          src={artwork.imageUrl} 
                          alt={artwork.title} 
                          className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                          loading="lazy"
                        />
                      )}
                      {/* Premium/Type Badge overlay could go here */}
                    </div>

                    <div className="p-5 sm:p-7 flex-1 bg-white dark:bg-card space-y-3">
                      <div>
                        <h3 className="font-black text-lg sm:text-xl text-foreground tracking-tight line-clamp-1 group-hover:text-primary transition-colors">
                          {artwork.title}
                        </h3>
                        <p 
                          className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 mt-1 hover:text-primary transition-colors cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            navigate(`/artist/${artwork.artistId}`);
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                          by {artwork.artist}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-muted/10">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Heart className="h-4 w-4 text-red-500/80" />
                            <span className="text-xs font-black">{artwork.likes}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Eye className="h-4 w-4 text-blue-500/80" />
                            <span className="text-xs font-black">{artwork.views}</span>
                          </div>
                        </div>
                        <div className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/5 px-2.5 py-1.5 rounded-lg border border-primary/10">
                          View Work
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-1 sm:left-2 bg-white/80 backdrop-blur-md border border-white/30 text-primary hover:bg-white/90 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 h-8 w-8 sm:h-10 sm:w-10" />
          <CarouselNext className="right-1 sm:right-2 bg-white/80 backdrop-blur-md border border-white/30 text-primary hover:bg-white/90 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 h-8 w-8 sm:h-10 sm:w-10" />
        </Carousel>
        
        <div className="mt-8 sm:mt-12 text-center sm:hidden">
          <Button asChild variant="outline" className="border-primary hover:bg-primary hover:text-white transition-all duration-300">
            <Link to="/explore">View All Artwork</Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default ArtworkCarousel;
