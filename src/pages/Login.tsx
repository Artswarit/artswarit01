
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AuthShell from "@/components/auth/AuthShell";

const loginHighlights = [
  {
    title: "One focused workspace",
    description: "Keep conversations, briefs, and project updates organized from the first message to the final delivery.",
  },
  {
    title: "Made for artists and clients",
    description: "Switch between discovery and execution without losing context across your commissions.",
  },
  {
    title: "Fast on every screen",
    description: "A tighter desktop layout and cleaner mobile spacing keep the form easy to scan and use.",
  },
];

const Login = ({ isModal = false }: { isModal?: boolean }) => {
  const navigate = useNavigate();
  const { signIn, signInWithGoogle, loading, user } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user && !loading) {
      void redirectBasedOnRole();
    }
  }, [user, loading, navigate]);

  const redirectBasedOnRole = async () => {
    if (!user) return;

    try {
      const [profileResult, adminResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('role, full_name, bio, avatar_url, tags')
          .eq('id', user.id)
          .single(),
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle(),
      ]);

      if (profileResult.error) {
        console.error('Error fetching profile for redirect:', profileResult.error);
        navigate('/');
        return;
      }

      const profile = profileResult.data;
      const isAdmin = profile?.role === 'admin' || adminResult.data?.role === 'admin';

      if (isAdmin) {
        navigate('/admin-dashboard');
      } else if (profile?.role === 'artist' || profile?.role === 'premium') {
        navigate('/artist-dashboard');
      } else {
        navigate('/client-dashboard');
      }
    } catch (error) {
      console.error('Error in redirectBasedOnRole:', error);
      navigate('/');
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    
    const { error } = await signIn(email, password);
    
    if (!error) {
      // Role-based redirect will happen via useEffect when user state updates
    }
    
    setIsSubmitting(false);
  };

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    await signInWithGoogle();
    setIsSubmitting(false);
  };

  return (
    <AuthShell
      isModal={isModal}
      onClose={() => navigate(-1)}
      title="Commission better, collaborate faster."
      description="Manage artist discovery, project conversations, and client work from one clean login experience."
      highlights={loginHighlights}
    >
      <Card className="rounded-[2rem] border border-border/60 bg-card/85 shadow-2xl backdrop-blur-xl">
        <CardHeader className="space-y-3 px-6 pb-0 pt-6 sm:px-8 sm:pt-8">
          <div className="mx-auto inline-flex rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            Welcome back
          </div>
          <CardTitle className="text-center font-heading text-2xl tracking-tight sm:text-3xl">
            Sign in to Artswarit
          </CardTitle>
          <CardDescription className="text-center text-sm leading-6 text-muted-foreground sm:text-base">
            Pick up where you left off and get back to your commissions in seconds.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 px-6 pb-6 pt-6 sm:px-8 sm:pb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 rounded-xl border-border/70 bg-background/80 text-base"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-primary transition-colors hover:text-primary/80"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 rounded-xl border-border/70 bg-background/80 pr-12 text-base"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="h-12 w-full rounded-xl text-base font-medium shadow-sm"
              disabled={loading || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-[11px] font-medium uppercase tracking-[0.24em]">
              <span className="bg-card px-3 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleSignIn}
            disabled={loading || isSubmitting}
            className="h-12 w-full rounded-xl border-border/70 bg-background/70 text-foreground hover:bg-accent/50"
          >
            <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </Button>

          <div className="pt-1 text-center text-sm">
            <span className="text-muted-foreground">Don&apos;t have an account? </span>
            <Link to="/signup" className="font-medium text-primary hover:text-primary/80">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthShell>
  );
};

export default Login;
