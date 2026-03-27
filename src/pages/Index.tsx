import { Link, useLocation } from "react-router-dom";
import SEOHead from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FeaturedArtistCard from "@/components/FeaturedArtistCard";
import CategoryCard from "@/components/CategoryCard";
import {
  Music,
  BookOpen,
  Edit,
  Pencil,
  User,
  Briefcase,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import AnimatedHeroSlider from "@/components/AnimatedHeroSlider";
import ArtworkCarousel from "@/components/ArtworkCarousel";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { useCategoryCounts } from "@/hooks/useCategoryCounts";
import { useFeaturedArtists } from "@/hooks/useFeaturedArtists";
import { Skeleton } from "@/components/ui/skeleton";

const Index = () => {
  const location = useLocation();
  const { artists: featuredArtists, loading: artistsLoading } = useFeaturedArtists(8);
  const { getCount, loading: categoriesLoading } = useCategoryCounts();

  // Base categories with icons and slugs
  const baseCategories = [
    {
      title: "Musicians",
      icon: <Music size={24} />,
      slug: "musicians",
    },
    {
      title: "Writers",
      icon: <BookOpen size={24} />,
      slug: "writers",
    },
    {
      title: "Rappers",
      icon: <Music size={24} />,
      slug: "rappers",
    },
    {
      title: "Editors",
      icon: <Edit size={24} />,
      slug: "editors",
    },
    {
      title: "Photographers",
      icon: <Edit size={24} />,
      slug: "photographers",
    },
    {
      title: "Illustrators",
      icon: <Pencil size={24} />,
      slug: "illustrators",
    },
    {
      title: "Voice Artists",
      icon: <Music size={24} />,
      slug: "voice-artists",
    },
    {
      title: "Animators",
      icon: <Edit size={24} />,
      slug: "animators",
    },
    {
      title: "Scriptwriters",
      icon: <Pencil size={24} />,
      slug: "scriptwriters",
    },
  ];

  // Categories with real-time counts
  const categories = baseCategories.map((cat) => ({
    ...cat,
    count: getCount(cat.title),
  }));

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <SEOHead
        title="Artswarit — Hire Artists Online | Freelance Artist Marketplace India"
        description="India's leading artist marketplace. Hire freelance musicians, writers, illustrators, photographers & more. Commission artwork with escrow-secured payments. Browse verified creative professionals."
        canonicalPath="/"
        keywords="hire artists online, freelance artists platform, commission artwork India, artist marketplace, hire musicians, hire illustrators, creative freelancers"
        structuredData={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "How do I hire an artist on Artswarit?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Browse our verified artists by category, view their portfolios, and send a project request. Payments are secured through escrow until you approve the work.",
              },
            },
            {
              "@type": "Question",
              name: "Is Artswarit free for artists?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes! Artists can create a profile, upload their portfolio, and receive commissions for free. Pro artists get 0% platform fees.",
              },
            },
            {
              "@type": "Question",
              name: "What types of artists are on Artswarit?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Artswarit features musicians, writers, rappers, photographers, illustrators, editors, voice artists, animators, scriptwriters, and more.",
              },
            },
          ],
        }}
      />
      <Navbar />

      <AnimatedHeroSlider />

      {/* Featured Artists Section */}
      <section
        id="featured-artists"
        className="container mx-auto px-4 py-12 sm:py-16 sm:px-6 lg:px-8 mt-4 sm:mt-8"
      >
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-12 px-4 shadow-none">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-4 tracking-tight">
              Featured Artists
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
              Discover trending creators making waves on Artswarit, updated
              regularly based on popularity.
            </p>
          </div>
        </div>

        {artistsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-80 w-full rounded-xl" />
            ))}
          </div>
        ) : featuredArtists.length > 0 ? (
          <div className="relative">
            <Carousel
              opts={{
                align: "start",
                loop: true,
              }}
              plugins={[
                Autoplay({
                  delay: 4500,
                  stopOnInteraction: false,
                  stopOnMouseEnter: true,
                }),
              ]}
              className="w-full group"
            >
              <CarouselContent className="-ml-2 md:-ml-4">
                {featuredArtists.map((artist, index) => (
                  <CarouselItem
                    key={artist.id}
                    className="pl-2 md:pl-4 basis-full sm:basis-1/2 lg:basis-1/3"
                  >
                    <div className="h-full">
                      <FeaturedArtistCard {...artist} rank={index + 1} />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="left-2 bg-white/80 backdrop-blur-md border border-white/30 text-primary hover:bg-white/90 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CarouselNext className="right-2 bg-white/80 backdrop-blur-md border border-white/30 text-primary hover:bg-white/90 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </Carousel>
          </div>
        ) : (
          <div className="text-center py-16 bg-muted/20 rounded-3xl border border-dashed">
            <p className="text-muted-foreground">No featured artists yet. Be the first!</p>
            <Button asChild variant="link" className="mt-2 text-primary font-semibold">
              <Link to="/signup">Join as Artist</Link>
            </Button>
          </div>
        )}

        {featuredArtists.length > 0 && (
          <div className="text-center mt-8">
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-artswarit-purple text-artswarit-purple hover:bg-artswarit-purple hover:text-white transition-all"
            >
              <Link to="/explore-artists">View All Artists</Link>
            </Button>
          </div>
        )}
      </section>

      {/* Artwork Carousel Section */}
      <ArtworkCarousel />

      {/* Categories Section */}
      <section className="py-12 sm:py-16 bg-gradient-to-r from-indigo-50 to-purple-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="font-heading text-2xl sm:text-3xl md:text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-artswarit-purple to-blue-500">
              Popular Categories
            </h2>
            <p className="text-base sm:text-lg font-serif text-muted-foreground max-w-2xl mx-auto px-4">
              Find the perfect creative professional for your project from our
              diverse selection of specialized talents.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              <span className="inline-block w-2 h-2 bg-green-400 rounded-full mr-2"></span>
              Live counts • Updated regularly
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {categoriesLoading
              ? // Skeleton loading state for categories
                Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-32 w-full rounded-xl" />
                ))
              : categories
                  .slice(0, 6)
                  .map((category, index) => (
                    <CategoryCard key={index} {...category} />
                  ))}
          </div>
          <div className="text-center mt-8">
            <p className="text-base sm:text-lg italic text-muted-foreground mb-4 px-4">
              ...and many more categories to explore with thousands of talented
              artists
            </p>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-artswarit-purple text-artswarit-purple hover:bg-artswarit-purple hover:text-white transition-all"
            >
              <Link to="/categories">View All Categories</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="container mx-auto px-4 py-12 sm:py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="font-heading text-2xl sm:text-3xl md:text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-artswarit-purple to-blue-500">
            How Artswarit Works
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
            A simple process to showcase your talent or find the perfect
            creative professional.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          <div className="text-center p-4 sm:p-6 bg-white/60 backdrop-blur-sm rounded-xl border border-blue-100 shadow-sm hover:shadow-md transition-all">
            <div className="bg-gradient-to-r from-artswarit-purple to-blue-500 h-12 w-12 sm:h-16 sm:w-16 rounded-full flex items-center justify-center text-white mx-auto mb-4">
              <span className="font-bold text-lg sm:text-xl">1</span>
            </div>
            <h3 className="font-heading text-lg sm:text-xl font-semibold mb-2">
              Create Your Profile
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground">
              Sign up as an artist and build your custom profile showcasing your
              skills, portfolio, and services.
            </p>
          </div>
          <div className="text-center p-4 sm:p-6 bg-white/60 backdrop-blur-sm rounded-xl border border-blue-100 shadow-sm hover:shadow-md transition-all">
            <div className="bg-gradient-to-r from-artswarit-purple to-blue-500 h-12 w-12 sm:h-16 sm:w-16 rounded-full flex items-center justify-center text-white mx-auto mb-4">
              <span className="font-bold text-lg sm:text-xl">2</span>
            </div>
            <h3 className="font-heading text-lg sm:text-xl font-semibold mb-2">
              Upload Your Content
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground">
              Share your work with the world. Upload audio, video, or text
              content to showcase your talent.
            </p>
          </div>
          <div className="text-center p-4 sm:p-6 bg-white/60 backdrop-blur-sm rounded-xl border border-blue-100 shadow-sm hover:shadow-md transition-all">
            <div className="bg-gradient-to-r from-artswarit-purple to-blue-500 h-12 w-12 sm:h-16 sm:w-16 rounded-full flex items-center justify-center text-white mx-auto mb-4">
              <span className="font-bold text-lg sm:text-xl">3</span>
            </div>
            <h3 className="font-heading text-lg sm:text-xl font-semibold mb-2">
              Connect & Earn
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground">
              Get discovered by clients, receive project offers, and monetize
              your creative skills.
            </p>
          </div>
        </div>
        <div className="text-center mt-8 sm:mt-10">
          <Button
            asChild
            size="lg"
            className="bg-gradient-to-r from-artswarit-purple to-blue-500 border-none"
          >
            <Link to="/signup">Get Started Now</Link>
          </Button>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-12 sm:py-16 bg-gradient-to-r from-indigo-50 to-purple-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="font-heading text-2xl sm:text-3xl md:text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-artswarit-purple to-blue-500">
              Success Stories
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
              Hear from artists who have transformed their careers with
              Artswarit.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {[
              {
                content: "Artswarit helped me showcase my music to a broader audience and connect with clients I never thought possible.",
                author: "Marcus Williams",
                role: "Musician",
              },
              {
                content: "As a writer, I was struggling to monetize my work. Artswarit provided the perfect platform to share and earn from my passion.",
                author: "Sophia Chen",
                role: "Writer",
              },
              {
                content: "The verification badge gave my profile the credibility it needed. Now clients trust my work before even hearing it.",
                author: "Derek Johnson",
                role: "Rapper",
              },
            ].map((testimonial, index) => (
              <div
                key={index}
                className="bg-white/60 backdrop-blur-sm p-4 sm:p-6 rounded-xl shadow-sm border border-blue-100 hover:shadow-md transition-all"
              >
                <div className="mb-4">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-yellow-400">
                      ★
                    </span>
                  ))}
                </div>
                <p className="text-gray-700 mb-4 text-sm sm:text-base">
                  "{testimonial.content}"
                </p>
                <div>
                  <p className="font-heading font-semibold text-sm sm:text-base">
                    {testimonial.author}
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {testimonial.role}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enhanced CTA Section */}
      <section className="bg-gradient-to-r from-artswarit-purple to-blue-500 text-white py-12 sm:py-16 relative overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-heading text-2xl sm:text-3xl md:text-4xl font-bold mb-4">
              Ready to Showcase Your Talent?
            </h2>
            <p className="text-lg sm:text-xl mb-8 text-white/90">
              Join thousands of creative professionals building their careers
              with Artswarit.
            </p>

            {/* Enhanced Buttons Container */}
            <div className="flex flex-col sm:flex-row justify-center gap-4 max-w-md mx-auto">
              <Button
                asChild
                className="group relative overflow-hidden bg-white text-artswarit-purple hover:bg-gray-50 font-medium px-6 py-3 text-sm transition-all duration-300 hover:scale-105 hover:shadow-lg"
              >
                <Link
                  to="/signup"
                  className="flex items-center justify-center gap-2 relative z-10"
                >
                  <User className="w-4 h-4 transition-transform group-hover:scale-110" />
                  <span>Join as Artist</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-100/50 to-purple-100/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-md"></div>
                </Link>
              </Button>

              <Button
                asChild
                className="group relative overflow-hidden bg-white text-artswarit-purple hover:bg-gray-50 font-medium px-6 py-3 text-sm transition-all duration-300 hover:scale-105 hover:shadow-lg"
              >
                <Link
                  to="/signup?role=client"
                  className="flex items-center justify-center gap-2 relative z-10"
                >
                  <Briefcase className="w-4 h-4 transition-transform group-hover:scale-110" />
                  <span>Join as Client</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-100/50 to-purple-100/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-md"></div>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;





