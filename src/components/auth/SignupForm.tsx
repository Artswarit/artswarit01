import { Link, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Palette, Users, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SignupFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: string;
  acceptTerms: boolean;
}
interface SignupFormProps {
  formData: SignupFormData;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRoleChange: (value: string) => void;
  handleTermsChange: (checked: boolean) => void;
  handleSubmit: (event: React.FormEvent) => void;
  loading?: boolean;
}
const SignupForm = ({
  formData,
  handleChange,
  handleRoleChange,
  handleTermsChange,
  handleSubmit,
  loading = false
}: SignupFormProps) => {
  const {
    toast
  } = useToast();
  const [searchParams] = useSearchParams();

  const roleOptions = [
    {
      value: "artist",
      title: "Artist",
      description: "Showcase your work and turn commissions into repeat clients.",
      icon: Palette,
    },
    {
      value: "client",
      title: "Client",
      description: "Discover artists, share your brief, and hire with confidence.",
      icon: Users,
    },
  ] as const;

  // Pre-select role from URL parameter
  useEffect(() => {
    const role = searchParams.get('role');
    if (role && (role === 'artist' || role === 'client') && !formData.role) {
      handleRoleChange(role);
    }
  }, [searchParams, formData.role, handleRoleChange]);
  const validateAndSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    // Validation - Role selection is mandatory
    if (!formData.role) {
      toast({
        title: "Please select a role",
        description: "You must choose either Artist or Client to continue.",
        variant: "destructive"
      });
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "Please make sure your passwords match.",
        variant: "destructive"
      });
      return;
    }
    if (!formData.acceptTerms) {
      toast({
        title: "Terms not accepted",
        description: "Please accept the Terms of Service and Privacy Policy to continue.",
        variant: "destructive"
      });
      return;
    }
    if (formData.password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive"
      });
      return;
    }
    handleSubmit(event);
  };
  return <form className="space-y-5" onSubmit={validateAndSubmit}>
      <div className="space-y-4 sm:space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-medium">Full name</Label>
          <Input id="name" name="name" type="text" placeholder="John Doe" value={formData.name} onChange={handleChange} required className="h-12 rounded-xl border-border/70 bg-background/80 text-base" disabled={loading} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
          <Input id="email" name="email" type="email" placeholder="name@example.com" value={formData.email} onChange={handleChange} required className="h-12 rounded-xl border-border/70 bg-background/80 text-base" disabled={loading} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium">Password</Label>
          <Input id="password" name="password" type="password" placeholder="••••••••" value={formData.password} onChange={handleChange} required className="h-12 rounded-xl border-border/70 bg-background/80 text-base" disabled={loading} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm password</Label>
          <Input id="confirmPassword" name="confirmPassword" type="password" placeholder="••••••••" value={formData.confirmPassword} onChange={handleChange} required className="h-12 rounded-xl border-border/70 bg-background/80 text-base" disabled={loading} />
        </div>
        <div className="space-y-3">
          <div>
            <Label className="text-sm font-medium">I want to join as <span className="text-destructive">*</span></Label>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {roleOptions.map((option) => {
              const isSelected = formData.role === option.value;
              const Icon = option.icon;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => !loading && handleRoleChange(option.value)}
                  disabled={loading}
                  className={cn(
                    "relative rounded-2xl border p-4 text-left transition-all",
                    isSelected
                      ? "border-primary bg-primary/10 shadow-md"
                      : "border-border bg-background/80 hover:border-primary/40 hover:bg-accent/40",
                    loading && "cursor-not-allowed opacity-60",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-3">
                      <div className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full",
                        isSelected ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground",
                      )}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-semibold text-foreground">{option.title}</p>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {option.description}
                        </p>
                      </div>
                    </div>
                    <CheckCircle2 className={cn(
                      "h-5 w-5 flex-shrink-0 transition-opacity",
                      isSelected ? "text-primary opacity-100" : "opacity-0",
                    )} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/60 p-3">
          <Checkbox 
            id="terms" 
            checked={formData.acceptTerms} 
            onCheckedChange={handleTermsChange} 
            required 
            disabled={loading}
            className="mt-1 h-5 w-5 flex-shrink-0"
          />
          <Label htmlFor="terms" className="flex-1 cursor-pointer text-sm leading-6 text-muted-foreground">
            I accept the{" "}
            <Link to="/terms-of-service" className="font-medium text-primary underline-offset-4 hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link to="/privacy-policy" className="font-medium text-primary underline-offset-4 hover:underline">
              Privacy Policy
            </Link>
            <span className="text-destructive"> *</span>
          </Label>
        </div>
      </div>

      <Button type="submit" className="min-h-[48px] w-full rounded-xl text-base font-medium shadow-sm" disabled={loading}>
        {loading ? "Creating account..." : "Create account"}
      </Button>
    </form>;
};
export default SignupForm;