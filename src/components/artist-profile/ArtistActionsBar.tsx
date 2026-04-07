
import React from "react";
import { MessageCircle, Save, FilePlus, UserPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ArtistActionsBarProps {
  isFollowing: boolean;
  onFollow: () => void;
  onMessage: () => void;
  isSaved: boolean;
  onSave: () => void;
  onRequest: () => void;
  loadingFollow?: boolean;
  loadingSave: boolean;
  canMessage?: boolean;
}

const ArtistActionsBar: React.FC<ArtistActionsBarProps> = ({
  isFollowing,
  onFollow,
  onMessage,
  isSaved,
  onSave,
  onRequest,
  loadingFollow = false,
  loadingSave,
  canMessage = true,
}) => {
  return (
    <div className="grid grid-cols-1 gap-3 w-full">
      {/* Primary Follow Button - Full width responsive */}
      <Button
        onClick={onFollow}
        disabled={loadingFollow}
        variant={isFollowing ? "secondary" : "default"}
        className={cn(
          "w-full relative h-14 rounded-2xl font-black text-sm sm:text-base tracking-tight transition-all duration-300 shadow-xl",
          isFollowing
            ? "bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/20"
            : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20 hover:scale-105 active:scale-95"
        )}
      >
        {loadingFollow ? (
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        ) : (
          <UserPlus className="mr-2 h-5 w-5" />
        )}
        {isFollowing ? "Following" : "Follow Artist"}
      </Button>

      {/* Message Button - High Contrast Glass Style */}
      <Button
        onClick={onMessage}
        disabled={!canMessage}
        variant="ghost"
        className={cn(
          "w-full h-14 rounded-2xl font-black text-sm transition-all duration-300 relative isolate overflow-hidden shadow-lg",
          !canMessage 
            ? "opacity-50 cursor-not-allowed bg-muted" 
            : "bg-white/10 dark:bg-white/5 border border-white/20 text-white hover:bg-white/20 active:scale-95"
        )}
      >
        {!canMessage && <div className="absolute inset-0 bg-black/5 z-[-1]" />}
        <MessageCircle className="mr-2 h-5 w-5 drop-shadow-md" />
        <span className="drop-shadow-md">
          {canMessage ? 'Message Artist' : 'Messaging Unavailable'}
        </span>
        {canMessage && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
        )}
      </Button>

      {/* Secondary Actions - 2 column grid on small screens, expands later */}
      <div className="grid grid-cols-1 min-[390px]:grid-cols-2 gap-3">
        <Button
          onClick={onSave}
          variant="outline"
          disabled={loadingSave}
          className={cn(
            "h-14 rounded-2xl font-bold text-xs sm:text-sm transition-all duration-300",
            isSaved 
              ? "bg-pink-50 border-pink-500 text-pink-600 shadow-md" 
              : "border-pink-200 text-pink-600 hover:bg-pink-50 shadow-sm"
          )}
        >
          <Save className={cn("mr-2 h-4 w-4 sm:h-5 sm:w-5", isSaved && "fill-current")} />
          {isSaved ? "Saved" : "Save"}
        </Button>

        <Button
          onClick={onRequest}
          variant="outline"
          className="h-14 rounded-2xl font-bold text-xs sm:text-sm border-amber-200 text-amber-600 hover:bg-amber-50 shadow-sm transition-all duration-300"
        >
          <FilePlus className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
          Request
        </Button>
      </div>
    </div>
  );
};

export default ArtistActionsBar;
