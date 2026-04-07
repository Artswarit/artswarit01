import { AlertCircle, ChevronRight, Sparkles } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useProfileCompletion } from "@/hooks/useProfileCompletion";
import { useState, useEffect } from "react";
import ProfileCompletionWizard from "./ProfileCompletionWizard";

const ProfileCompletionBanner = () => {
  const { isComplete, completionPercentage, missingFields, loading } = useProfileCompletion();
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // Auto-open wizard if profile is incomplete
  useEffect(() => {
    if (!isComplete && !loading) {
      const timer = setTimeout(() => setIsWizardOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [isComplete, loading]);

  if (loading || isComplete) {
    return null;
  }

  return (
    <>
      <div className="mb-8 p-4 sm:p-6 rounded-[2rem] bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-red-500/10 border-2 border-amber-500/20 shadow-xl shadow-amber-500/5 animate-in fade-in slide-in-from-top-6 duration-700 ease-out group overflow-hidden relative">
        {/* Decorative background pulse */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl group-hover:bg-amber-500/20 transition-colors duration-500" />
        
        <div className="flex flex-col md:flex-row md:items-center gap-6 relative z-10">
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 shadow-inner">
            <Sparkles className="h-8 w-8 text-amber-600" />
          </div>
          
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="font-black text-foreground text-xl sm:text-2xl tracking-tight">🎯 Get Started in 5 Minutes</h3>
              <span className="px-2 py-0.5 rounded-lg bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest leading-none">
                {completionPercentage}% Done
              </span>
            </div>
            
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed font-medium max-w-2xl">
              Verified profiles attract <span className="text-amber-600 font-bold">3x more projects</span>. Finish setting up your professional identity to get discovered.
            </p>

            <div className="mt-4 w-full max-w-md">
              <div className="bg-muted/30 rounded-full h-3 overflow-hidden border border-border/20 p-0.5">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 via-orange-600 to-red-500 rounded-full transition-all duration-1000 ease-out shadow-sm"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
            </div>
          </div>

          <Button 
            onClick={() => setIsWizardOpen(true)}
            className="shrink-0 h-14 px-8 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-lg shadow-amber-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all group"
          >
            Start 5-Minute Setup
            <ChevronRight className="h-5 w-5 ml-2 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>
      </div>

      <ProfileCompletionWizard 
        isOpen={isWizardOpen} 
        onOpenChange={setIsWizardOpen} 
      />
    </>
  );
};

export default ProfileCompletionBanner;
