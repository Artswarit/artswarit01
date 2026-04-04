import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Star } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface ProjectReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  artistId: string;
  projectName: string;
  onSuccess?: () => void;
}

export function ProjectReviewDialog({
  open,
  onOpenChange,
  projectId,
  artistId,
  projectName,
  onSuccess
}: ProjectReviewDialogProps) {
  const { user } = useAuth();
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hoveredRating, setHoveredRating] = useState(0);

  const handleSubmit = async () => {
    if (!user) return;
    
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('project_reviews')
        .insert({
          project_id: projectId,
          artist_id: artistId,
          client_id: user.id,
          rating,
          review_text: reviewText.trim()
        });

      if (error) throw error;

      toast.success('Thank you for your feedback! Your review has been published.');
      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Error submitting review:', err);
      toast.error(err.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-[2rem] p-8 border-none shadow-2xl animate-in zoom-in-95 duration-300">
        <DialogHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
            <Star className="w-8 h-8 text-primary fill-primary animate-pulse" />
          </div>
          <DialogTitle className="text-2xl font-black tracking-tight">Project Completed!</DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            How was your experience working with the artist on <span className="font-bold text-foreground">"{projectName}"</span>?
          </DialogDescription>
        </DialogHeader>

        <div className="py-8 space-y-8">
          <div className="flex flex-col items-center gap-4">
            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">Your Rating</Label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  onClick={() => setRating(star)}
                  className={cn(
                    "p-1 transition-all duration-300 hover:scale-125 active:scale-95",
                    (hoveredRating || rating) >= star ? "text-amber-400" : "text-muted/20"
                  )}
                >
                  <Star className={cn("w-10 h-10", (hoveredRating || rating) >= star ? "fill-current" : "fill-none")} />
                </button>
              ))}
            </div>
            <p className="text-sm font-bold text-primary">
              {['Poor', 'Fair', 'Good', 'Amazing', 'Outstanding!'][rating - 1]}
            </p>
          </div>

          <div className="space-y-3">
            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 ml-2">Tell us more (Optional)</Label>
            <Textarea
              placeholder="The artist was very professional and delivered on time..."
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              className="min-h-[120px] rounded-2xl bg-muted/30 border-muted/20 focus:ring-primary/20 text-base"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95"
          >
            {submitting ? 'Submitting...' : 'Complete & Publish Review'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
