import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const slides = [
  {
    id: 1,
    title: "Showcase Your Creative Talent",
    subtitle: "Join thousands of artists making an impact with their work",
    gradient: "from-[#4F46E5] via-[#7C3AED] to-[#DB2777]",
  },
  {
    id: 2,
    title: "Connect With Global Clients",
    subtitle: "Expand your reach and grow your creative business",
    gradient: "from-[#2563EB] via-[#4F46E5] to-[#7C3AED]",
  },
  {
    id: 3,
    title: "Monetize Your Art",
    subtitle: "Turn your passion into a sustainable career",
    gradient: "from-[#7C3AED] via-[#4F46E5] to-[#2563EB]",
  },
];

const AnimatedHeroSlider = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative h-[75vh] min-h-[480px] sm:h-[80vh] sm:min-h-[540px] md:h-[85vh] lg:h-[90vh] overflow-hidden bg-background">
      {/* Dynamic Background Gradients */}
      <div className="absolute inset-0 z-0">
        {slides.map((slide, index) => (
          <div 
            key={slide.id}
            className={cn(
              "absolute inset-0 transition-opacity duration-1000 ease-in-out bg-gradient-to-br",
              slide.gradient,
              index === currentSlide ? "opacity-100" : "opacity-0"
            )}
          />
        ))}
        {/* Soft Mesh Overlay */}
        <div className="absolute inset-0 opacity-40 mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
      </div>

      {/* Modern Floating Aesthetics */}
      <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-white/10 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-white/10 rounded-full blur-[100px] animate-pulse delay-700" />
      </div>

      {/* Hero Content Layer */}
      <div className="relative z-20 h-full flex items-center pt-24 sm:pt-32">
        <div className="w-full px-6 sm:px-8 lg:px-6">
          <div className="max-w-4xl">
            <div className="flex flex-col space-y-6 sm:space-y-8">
              <h1 className="text-white font-heading text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight animate-in fade-in slide-in-from-bottom-8 duration-1000 leading-[0.95]">
                {slides[currentSlide].title}
              </h1>
              
              <p className="text-white/80 text-base sm:text-lg md:text-xl lg:text-2xl font-medium max-w-2xl leading-relaxed animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-200">
                {slides[currentSlide].subtitle}
              </p>

              <div className="flex flex-wrap gap-4 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300">
                <Button 
                  asChild
                  size="lg" 
                  className="bg-white text-indigo-600 hover:bg-gray-100 rounded-full h-10 sm:px-5 font-semibold text-sm transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-indigo-500/20"
                >
                  <Link to="/signup" className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Join Now
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Legacy Vertical Indication System */}
      <div className="absolute bottom-10 left-0 right-0 z-30 flex justify-center items-center gap-2">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={cn(
              "transition-all duration-300 ease-out",
              index === currentSlide 
                ? "w-6 sm:w-8 h-1.5 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.4)]" 
                : "w-1 h-3 sm:h-4 bg-white/20 rounded-full hover:bg-white/40"
            )}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </section>
  );
};

export default AnimatedHeroSlider;
