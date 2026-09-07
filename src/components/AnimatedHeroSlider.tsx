import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { getOptimizedImageUrl, ImagePresets } from "@/lib/image-optimization";

/**
 * Homepage hero — "spatial layered" direction, built to Apple HIG:
 *  - one large title with negative optical tracking, body copy at a calm
 *    measure, and a single primary action plus one quiet secondary action
 *  - depth from layered translucent materials and hairlines, not heavy shadows
 *  - motion is restrained: ease-apple, 300–700ms, no parallax spectacle
 */
const slides = [
  {
    id: 1,
    eyebrow: "Showcase",
    title: "Where talent",
    accent: "finds its stage.",
    subtitle:
      "Publish your portfolio, get discovered by clients worldwide, and build a career around the work you love.",
    imageUrl:
      "https://images.unsplash.com/photo-1579546929662-711aa81148cf?auto=format&fit=crop&w=1200&q=80",
    detailUrl:
      "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?auto=format&fit=crop&w=600&q=80",
    caption: "Portfolios",
    captionSub: "Audio, video, writing and visual work",
  },
  {
    id: 2,
    eyebrow: "Connect",
    title: "Where vision",
    accent: "meets commerce.",
    subtitle:
      "Brands and creators brief you directly, agree milestones, and pay through escrow — no chasing invoices.",
    imageUrl:
      "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80",
    detailUrl:
      "https://images.unsplash.com/photo-1579546929662-711aa81148cf?auto=format&fit=crop&w=600&q=80",
    caption: "Projects",
    captionSub: "Milestones, reviews and clear approvals",
  },
  {
    id: 3,
    eyebrow: "Earn",
    title: "Where craft",
    accent: "becomes a career.",
    subtitle:
      "Sell artworks, take commissions and grow recurring clients with pricing that stays in your control.",
    imageUrl:
      "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?auto=format&fit=crop&w=1200&q=80",
    detailUrl:
      "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80",
    caption: "Payouts",
    captionSub: "Escrow released on approval",
  },
];

const quickLinks = [
  { label: "Musicians", to: "/categories" },
  { label: "Illustrators", to: "/categories" },
  { label: "Writers", to: "/categories" },
];

const AnimatedHeroSlider = () => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const slide = slides[current];

  return (
    <section
      aria-label="Artswarit introduction"
      className="relative overflow-hidden bg-background pt-[calc(var(--navbar-height-mobile,4rem)+var(--safe-top)+2rem)] pb-16 sm:pt-[calc(var(--navbar-height-desktop,5rem)+var(--safe-top)+3rem)] sm:pb-24"
    >
      {/* Ambient brand light — soft, never a hard gradient wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-48 h-[36rem] w-[36rem] rounded-full bg-primary/10 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-accent/40 blur-[110px]"
      />

      <div className="container relative mx-auto grid items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
        {/* ── Copy column ─────────────────────────────────────────── */}
        <div className="space-y-8">
          <span className="inline-flex animate-fade-in items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {slide.eyebrow}
          </span>

          <div className="animate-fade-in space-y-5 [animation-delay:80ms]">

            <h1 className="font-heading text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-5xl lg:text-6xl">
              <span className="block transition-opacity duration-700 ease-apple">{slide.title}</span>
              <span className="block text-brand-gradient transition-opacity duration-700 ease-apple">
                {slide.accent}
              </span>
            </h1>
            <p className="max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
              {slide.subtitle}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              asChild
              size="lg"
              className="h-12 w-full rounded-2xl bg-brand-gradient px-8 text-base font-semibold text-primary-foreground border-none shadow-token-brand transition-all duration-300 ease-apple hover:-translate-y-0.5 active:scale-[0.98] sm:w-auto"
            >
              <Link to="/explore">Explore works</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 w-full rounded-2xl border-border/60 bg-card px-8 text-base font-semibold shadow-token-xs transition-all duration-300 ease-apple hover:bg-muted/60 active:scale-[0.98] sm:w-auto"
            >
              <Link to="/explore-artists" className="flex items-center justify-center gap-2">
                Meet the artists
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-6">
            <span className="mr-1 text-sm text-muted-foreground">Browse</span>
            {quickLinks.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                className="rounded-full border border-border/60 bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors duration-200 ease-apple hover:border-primary/40 hover:text-primary"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* ── Layered art column ──────────────────────────────────── */}
        <div className="relative mx-auto w-full max-w-sm px-2 sm:max-w-md sm:px-4 lg:px-6">
          <div className="group relative z-10 mx-auto aspect-[4/5] w-full overflow-hidden rounded-[2rem] border border-border/40 shadow-token-lg transition-all duration-700 ease-apple hover:-translate-y-1 hover:shadow-token-elevated">
            {slides.map((s, index) => (
              <img
                key={s.id}
                src={getOptimizedImageUrl(s.imageUrl, ImagePresets.PROFILE_COVER)}
                alt={`${s.title} ${s.accent}`}
                loading={index === 0 ? "eager" : "lazy"}
                decoding={index === 0 ? "sync" : "async"}
                className={`absolute inset-0 h-full w-full object-cover transition-all duration-[1200ms] ease-apple ${
                  index === current ? "scale-100 opacity-100" : "scale-105 opacity-0"
                }`}
              />
            ))}
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent px-6 pb-6 pt-16"
            >
              <p className="font-heading text-lg font-semibold leading-tight text-white">{slide.caption}</p>
              <p className="mt-0.5 text-xs font-medium text-white/75">{slide.captionSub}</p>
            </div>
          </div>
        </div>

      </div>

      {/* ── Slide indicator: iOS page-control proportions ─────────── */}
      <div className="container relative mx-auto mt-14 flex justify-center gap-2 px-4 sm:mt-16">
        {slides.map((s, index) => (
          <button
            key={s.id}
            onClick={() => setCurrent(index)}
            aria-label={`Show ${s.eyebrow}`}
            aria-current={index === current}
            className={`h-2 rounded-full transition-all duration-300 ease-apple ${
              index === current ? "w-8 bg-primary" : "w-2 bg-foreground/20 hover:bg-foreground/40"
            }`}
          />
        ))}
      </div>
    </section>
  );
};

export default AnimatedHeroSlider;
