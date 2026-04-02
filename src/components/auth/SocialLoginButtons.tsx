import { Button } from "@/components/ui/button";
import { Chrome } from "lucide-react";

interface SocialLoginButtonsProps {
  onSocialSignup: (provider: string) => void;
}

const SocialLoginButtons = ({
  onSocialSignup
}: SocialLoginButtonsProps) => {
  return (
    <>
      <div className="mb-6">
        <Button 
          type="button"
          variant="outline" 
          onClick={() => onSocialSignup("Google")} 
          className="min-h-[48px] w-full rounded-xl border-border/70 bg-background/70 px-4 text-sm text-foreground hover:bg-accent/50"
        >
          <Chrome className="h-5 w-5 flex-shrink-0" />
          <span>Continue with Google</span>
        </Button>
      </div>

      <div className="my-5 flex items-center">
        <div className="flex-1 border-t border-border"></div>
        <div className="whitespace-nowrap px-3 text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground sm:text-xs">
          Or sign up with email
        </div>
        <div className="flex-1 border-t border-border"></div>
      </div>
    </>
  );
};

export default SocialLoginButtons;