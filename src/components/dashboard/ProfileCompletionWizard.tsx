import { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  User, 
  MapPin, 
  Tag, 
  Image as ImageIcon, 
  Check, 
  ChevronRight, 
  ChevronLeft,
  Loader2,
  Sparkles
} from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ProfileCompletionWizardProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

const ProfileCompletionWizard = ({ isOpen, onOpenChange, onComplete }: ProfileCompletionWizardProps) => {
  const { profile, updateProfile, uploadImage: uploadAvatar, loading: profileLoading } = useProfile();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    full_name: "",
    bio: "",
    country: "",
    city: "",
    tags: [] as string[],
    newTag: ""
  });

  const isArtist = profile?.role === 'artist' || profile?.role === 'premium';
  const totalSteps = isArtist ? 4 : 3;

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || "",
        bio: profile.bio || "",
        country: profile.country || "",
        city: profile.city || "",
        tags: Array.isArray(profile.tags) ? profile.tags : [],
        newTag: ""
      });
    }
  }, [profile]);

  const handleUpdate = async () => {
    setIsSubmitting(true);
    try {
      const { error } = await updateProfile({
        full_name: formData.full_name,
        bio: formData.bio,
        country: formData.country,
        city: formData.city,
        tags: formData.tags
      });

      if (error) throw (typeof error === 'string' ? new Error(error) : error);
      
      if (step < totalSteps) {
        setStep(step + 1);
      } else {
        toast({
          title: "Profile Completed!",
          description: "Your professional profile is now live and ready.",
        });
        onOpenChange(false);
        if (onComplete) onComplete();
      }
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message || "Failed to save changes",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const publicUrl = await uploadAvatar(file, 'avatar');
      if (!publicUrl) throw new Error("Image upload failed");
      
      toast({
        title: "Avatar updated!",
        description: "Your profile picture has been changed.",
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload image",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const addTag = () => {
    if (formData.newTag.trim() && !formData.tags.includes(formData.newTag.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, formData.newTag.trim()],
        newTag: ""
      });
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(t => t !== tagToRemove)
    });
  };

  const progress = (step / totalSteps) * 100;

  const StepIndicator = () => (
    <div className="flex items-center justify-between mb-8 px-2">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div key={i} className="flex items-center">
          <div 
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300",
              step > i + 1 ? "bg-emerald-500 text-white" : 
              step === i + 1 ? "bg-violet-600 text-white ring-4 ring-violet-500/20 shadow-lg shadow-violet-500/20" : 
              "bg-gray-100 text-gray-400"
            )}
          >
            {step > i + 1 ? <Check className="h-4 w-4" /> : i + 1}
          </div>
          {i < totalSteps - 1 && (
            <div className={cn(
              "w-full h-1 mx-2 sm:mx-4 rounded-full bg-gray-100 min-w-[20px] sm:min-w-[40px]",
              step > i + 1 && "bg-emerald-500"
            )} />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
        <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-8 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="h-5 w-5 text-amber-300" />
            <span className="text-[10px] uppercase font-black tracking-[0.2em] text-white/70">5-Minute Profile Setup</span>
          </div>
          <DialogTitle className="text-2xl sm:text-3xl font-black mb-2 text-white">
            {step === 1 ? "Personal Details" : 
             step === 2 ? "Professional Bio" : 
             step === 3 ? "Your Location" : 
             "Areas of Expertise"}
          </DialogTitle>
          <DialogDescription className="text-white/80 text-sm font-medium">
            {step === 1 ? "Builds trust with clients (30 sec)" : 
             step === 2 ? "Helps people find you (1 min)" : 
             step === 3 ? "Optimize for local searches (30 sec)" : 
             "Get matched with relevant projects (2 min)"}
          </DialogDescription>
          
          <div className="mt-8">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Profile Quality</span>
              <span className="text-xs font-black">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2 bg-white/20" />
          </div>
        </div>

        <div className="p-8 bg-white max-h-[70vh] overflow-y-auto">
          <StepIndicator />

          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {step === 1 && (
              <div className="space-y-6">
                <div className="flex flex-col items-center justify-center space-y-4 mb-4">
                  <div className="relative group">
                    <Avatar className="h-24 w-24 border-4 border-violet-100 shadow-xl transition-transform duration-300 group-hover:scale-105">
                      <AvatarImage src={profile?.avatar_url || ""} />
                      <AvatarFallback className="bg-violet-50 text-violet-600 font-bold text-2xl">
                        {formData.full_name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <label 
                      htmlFor="avatar-upload" 
                      className="absolute bottom-0 right-0 p-2 bg-violet-600 text-white rounded-full cursor-pointer shadow-lg hover:bg-violet-700 transition-colors border-2 border-white"
                    >
                      {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                      <input type="file" id="avatar-upload" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground italic font-semibold">Step 1: Profile Photo (30 sec)</p>
                  <p className="text-[10px] text-muted-foreground text-center">Why: Builds trust, 3x more views</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="full_name" className="text-xs font-black uppercase tracking-wider text-gray-500">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-violet-400" />
                    <Input 
                      id="full_name"
                      placeholder="e.g. Leonardo da Vinci"
                      value={formData.full_name}
                      onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                      className="pl-10 h-11 rounded-xl border-gray-200 focus-visible:ring-violet-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bio" className="text-xs font-black uppercase tracking-wider text-gray-500">Professional Bio</Label>
                  <Textarea 
                    id="bio"
                    placeholder="Briefly describe your creative background and style..."
                    value={formData.bio}
                    onChange={(e) => setFormData({...formData, bio: e.target.value})}
                    className="min-h-[150px] rounded-2xl border-gray-200 focus-visible:ring-violet-500 resize-none p-4"
                  />
                  <p className="text-[10px] text-muted-foreground text-right italic font-semibold">Step 2: Bio (1 min) • Helps people find you</p>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="country" className="text-xs font-black uppercase tracking-wider text-gray-500">Country</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-violet-400" />
                    <Input 
                      id="country"
                      placeholder="e.g. Italy"
                      value={formData.country}
                      onChange={(e) => setFormData({...formData, country: e.target.value})}
                      className="pl-10 h-11 rounded-xl border-gray-200 focus-visible:ring-violet-500"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city" className="text-xs font-black uppercase tracking-wider text-gray-500">City (Optional)</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-violet-400" />
                    <Input 
                      id="city"
                      placeholder="e.g. Florence"
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                      className="pl-10 h-11 rounded-xl border-gray-200 focus-visible:ring-violet-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 4 && isArtist && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-wider text-gray-500">Skills & Specializations</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="absolute left-3 top-3 h-4 w-4 text-violet-400" />
                      <Input 
                        placeholder="e.g. Oil Painting, 3D Modeling"
                        value={formData.newTag}
                        onChange={(e) => setFormData({...formData, newTag: e.target.value})}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                        className="pl-10 h-11 rounded-xl border-gray-200 focus-visible:ring-violet-500"
                      />
                    </div>
                    <Button onClick={addTag} type="button" size="sm" className="bg-violet-100 text-violet-700 hover:bg-violet-200 h-11 rounded-xl px-4">
                      Add
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {formData.tags.map((tag) => (
                    <span 
                      key={tag} 
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-50 text-violet-700 text-xs font-bold border border-violet-100 group transition-all hover:bg-violet-600 hover:text-white"
                    >
                      {tag}
                      <button onClick={() => removeTag(tag)} className="opacity-50 hover:opacity-100">
                        <Check className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {formData.tags.length === 0 && (
                    <p className="text-sm text-muted-foreground italic w-full text-center py-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                      Add at least one skill to stand out!
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="p-8 pt-4 bg-gray-50 flex-col sm:flex-row gap-3 border-t border-gray-100">
          {step > 1 && (
            <Button
              variant="outline"
              disabled={isSubmitting}
              onClick={() => setStep(step - 1)}
              className="flex-1 sm:flex-none h-12 rounded-2xl border-gray-200 font-bold text-gray-600"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          )}
          <Button
            className="flex-1 h-12 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-bold shadow-lg shadow-violet-500/20 group"
            onClick={handleUpdate}
            disabled={isSubmitting || (step === 1 && !formData.full_name) || (step === 2 && !formData.bio) || (step === 4 && isArtist && formData.tags.length === 0)}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                {step === totalSteps ? "Finish Setup" : "Continue"}
                {step < totalSteps && <ChevronRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-0.5" />}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileCompletionWizard;
