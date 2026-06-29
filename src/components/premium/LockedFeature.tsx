import React from "react";
import { Lock, Crown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface LockedFeatureProps {
  isLocked: boolean;
  title?: string;
  description?: string;
  cta?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Wraps premium-only content. When locked, blurs the children and
 * overlays an Apple-style upgrade card pointing to the Membership tab.
 */
const LockedFeature: React.FC<LockedFeatureProps> = ({
  isLocked,
  title = "Pro feature",
  description = "Upgrade to Premium Artist to unlock advanced analytics, unlimited portfolio, and 0% platform fees.",
  cta = "Upgrade to Pro",
  children,
  className,
}) => {
  const navigate = useNavigate();

  if (!isLocked) return <>{children}</>;

  return (
    <div className={cn("relative isolate overflow-hidden rounded-3xl", className)}>
      <div
        className="pointer-events-none select-none blur-md opacity-40"
        aria-hidden
      >
        {children}
      </div>

      <div className="absolute inset-0 flex items-center justify-center p-6 bg-background/40 backdrop-blur-xl">
        <div className="max-w-md w-full rounded-2xl border border-border/60 bg-card/90 backdrop-blur-xl shadow-2xl p-6 sm:p-8 text-center">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
            <Lock className="h-5 w-5" />
          </div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary mb-2">
            <Sparkles className="h-3 w-3" /> {title}
          </div>
          <h3 className="text-xl font-semibold tracking-tight mb-2">
            Unlock with Premium Artist
          </h3>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            {description}
          </p>
          <Button
            onClick={() => navigate("/artist-dashboard?tab=membership")}
            className="h-11 px-6 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all active:scale-[0.97]"
          >
            <Crown className="h-4 w-4 mr-2" />
            {cta}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LockedFeature;
