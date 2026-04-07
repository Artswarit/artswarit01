
import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import LogoWithName from "@/components/LogoWithName";
import { Eye, EyeOff, Loader2, X, ArrowRight, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const Login = ({ isModal = false }: { isModal?: boolean }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signInWithGoogle, loading, user, profile } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Redirect if already logged in and profile is available
  useEffect(() => {
    if (user && profile && !loading) {
      const target = profile.role === 'admin' 
        ? '/admin-dashboard' 
        : profile.role === 'artist' 
          ? '/artist-dashboard' 
          : '/client-dashboard';
      
      // Only redirect if we're not already heading somewhere specific from state
      const from = (location.state as any)?.from?.pathname || target;
      navigate(from, { replace: true });
    }
  }, [user, profile, loading, navigate, location]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    
    const { error } = await signIn(email, password);
    
    if (error) {
      setIsSubmitting(false);
    }
    // If no error, the useEffect above will handle redirection when profile updates
  };

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    await signInWithGoogle();
    setIsSubmitting(false);
  };

  // Floating abstract shapes for the visual panel
  const ArtisticVisualPanel = () => (
    <div className="hidden md:flex flex-1 relative w-full min-h-full overflow-hidden bg-gradient-to-br from-[#0a0118] via-[#1a0533] to-[#0d001a]">
      {/* Animated gradient orbs */}
      <div className="absolute inset-0">
        <div className="absolute top-[10%] left-[15%] w-72 h-72 rounded-full bg-gradient-to-r from-violet-600/40 to-fuchsia-500/30 blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-[20%] right-[10%] w-96 h-96 rounded-full bg-gradient-to-r from-blue-600/30 to-cyan-400/20 blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />
        <div className="absolute top-[50%] left-[40%] w-64 h-64 rounded-full bg-gradient-to-r from-pink-500/25 to-rose-400/20 blur-3xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '2s' }} />
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
        backgroundSize: '60px 60px'
      }} />

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-between p-8 lg:p-12 xl:p-16 w-full">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
            <span className="text-violet-300/80 text-sm font-medium tracking-widest uppercase">Creative Platform</span>
          </div>
        </div>

        <div className="space-y-10">
          <div>
            <h2 className="text-3xl lg:text-5xl font-heading font-bold text-white leading-[1.1] mb-6">
              Welcome back to 
              <br />
              <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
                Artswarit
              </span>
            </h2>
            <p className="text-white/70 text-lg max-w-md leading-relaxed font-medium">
              Artswarit is a premium marketplace for the creative industry. Sign in to access your secure workspace and resume your projects.
            </p>
          </div>

          {/* Platform Highlights */}
          <div className="space-y-6">
            <h3 className="text-white/40 text-xs font-black uppercase tracking-[0.2em]">Platform Features</h3>
            <div className="space-y-6">
              {[
                {
                  title: "Secure Workspace",
                  desc: "End-to-end encryption for all your creative files and communications."
                },
                {
                  title: "Milestone Tracking",
                  desc: "Automated project management with clear deliverables and approvals."
                },
                {
                  title: "Instant Payments",
                  desc: "Receive your earnings instantly upon milestone completion via secure gateways."
                }
              ].map((step, i) => (
                <div key={i} className="flex gap-4 group">
                  <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-white/80 transition-all duration-300">
                    <CheckCircle2 className="w-4 h-4 text-violet-400" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-base mb-1">{step.title}</h4>
                    <p className="text-white/50 text-sm leading-relaxed max-w-xs">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom branding */}
        <div className="pt-8 border-t border-white/10 flex items-center justify-between">
           <div className="flex flex-col">
             <span className="text-white/60 text-xs font-bold">Secure Global Marketplace</span>
             <span className="text-white/30 text-[10px]">Trusted by creative professionals worldwide</span>
           </div>
           <div className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-pulse" title="System Live" />
        </div>
      </div>
    </div>
  );

  return (
    <div className={cn(
      "min-h-screen flex flex-col",
      isModal && "min-h-0"
    )}>
      {!isModal && <Navbar />}
      
      {isModal && (
        <button 
          onClick={() => navigate(-1)}
          className="absolute top-4 right-4 z-50 h-8 w-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      <div className={cn(
        "flex-1 flex",
        isModal ? "" : "pt-16 sm:pt-[72px]"
      )}>
        {/* Left Visual Panel — Tablet & Desktop */}
        {!isModal && <ArtisticVisualPanel />}

        {/* Right Form Panel */}
        <div className="w-full md:w-[55%] lg:w-1/2 xl:w-[480px] xl:min-w-[480px] flex flex-col">
          <div className="flex-1 flex items-center justify-center px-5 sm:px-8 md:px-6 lg:px-10 py-10 md:py-6 lg:py-8 bg-white">
            <div className="w-full max-w-[400px] mx-auto">
              {/* Logo */}
              <div className="flex justify-center mb-6 md:mb-8 lg:mb-10">
                <LogoWithName size="lg" />
              </div>

              {/* Heading */}
              <div className="mb-8 text-center">
                <h1 className="text-2xl sm:text-[28px] font-heading font-bold text-gray-900 tracking-tight">
                  Welcome back
                </h1>
                <p className="text-gray-500 text-sm mt-2">
                  Sign in to continue to your creative space.
                </p>
              </div>

              {/* Google Sign In */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading || isSubmitting}
                className="w-full flex items-center justify-center gap-3 h-12 px-4 rounded-xl border border-gray-200 bg-white text-gray-700 font-medium text-sm hover:bg-gray-50 hover:border-gray-300 hover:shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span>Continue with Google</span>
              </button>

              {/* Divider */}
              <div className="relative my-7">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-4 text-xs text-gray-400 uppercase tracking-wider">or</span>
                </div>
              </div>

              {/* Email Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="login-email" className="text-[13px] font-medium text-gray-700">
                    Email address
                  </Label>
                  <div className={cn(
                    "relative rounded-xl border transition-all duration-200",
                    focusedField === 'email' 
                      ? "border-violet-500 ring-2 ring-violet-500/20 shadow-sm" 
                      : "border-gray-200 hover:border-gray-300"
                  )}>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      required
                      className="h-12 text-[15px] border-0 rounded-xl bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-4 placeholder:text-gray-400"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password" className="text-[13px] font-medium text-gray-700">
                      Password
                    </Label>
                  </div>
                  <div className={cn(
                    "relative rounded-xl border transition-all duration-200",
                    focusedField === 'password' 
                      ? "border-violet-500 ring-2 ring-violet-500/20 shadow-sm" 
                      : "border-gray-200 hover:border-gray-300"
                  )}>
                    <Input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      required
                      className="h-12 text-[15px] border-0 rounded-xl bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-4 pr-12 placeholder:text-gray-400"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-[18px] w-[18px]" />
                      ) : (
                        <Eye className="h-[18px] w-[18px]" />
                      )}
                    </button>
                  </div>
                  <div className="flex justify-end">
                    <Link
                      to="/forgot-password"
                      className="text-xs font-medium text-violet-600 hover:text-violet-700 transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-medium text-[15px] shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all duration-300 group"
                  disabled={loading || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <span className="flex items-center gap-2">
                      Sign In
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  )}
                </Button>
              </form>

              {/* Sign up link */}
              <div className="text-center mt-8 text-sm text-gray-500">
                Don't have an account?{" "}
                <Link
                  to="/signup"
                  className="font-semibold text-violet-600 hover:text-violet-700 transition-colors"
                >
                  Create one free
                </Link>
              </div>
            </div>
          </div>

          {/* Minimal footer inside the form panel */}
          <div className="px-6 py-4 text-center text-xs text-gray-400 bg-white border-t border-gray-100">
            By signing in, you agree to our{" "}
            <Link to="/terms-of-service" className="text-gray-500 hover:text-violet-600 underline">Terms</Link>
            {" "}and{" "}
            <Link to="/privacy-policy" className="text-gray-500 hover:text-violet-600 underline">Privacy Policy</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 dark:border-white/5 w-full" />
      {!isModal && <Footer />}
    </div>
  );
};

export default Login;
