
import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import LogoWithName from "@/components/LogoWithName";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Palette, Users, Eye, EyeOff, ArrowRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const Signup = ({ isModal = false }: { isModal?: boolean }) => {
  const navigate = useNavigate();
  const { signUp, signInWithGoogle, loading, user, profile } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  // Redirect if already logged in and profile is available
  useEffect(() => {
    if (user && profile && !loading) {
      // P0: Enforce email verification check for email/password users
      const isGoogleUser = user.app_metadata?.provider === 'google';
      if (!user.email_confirmed_at && !isGoogleUser) {
        navigate('/verify-email', { replace: true });
        return;
      }

      const target = profile.role === 'admin' 
        ? '/admin-dashboard' 
        : profile.role === 'artist' 
          ? '/artist-dashboard' 
          : '/client-dashboard';
      
      navigate(target, { replace: true });
    }
  }, [user, profile, loading, navigate]);
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: searchParams.get('role') || "",
    acceptTerms: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Pre-select role from URL parameter
  useEffect(() => {
    const role = searchParams.get('role');
    if (role && (role === 'artist' || role === 'client') && !formData.role) {
      setFormData(prev => ({ ...prev, role }));
    }
  }, [searchParams]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSocialSignup = async (provider: string) => {
    if (provider === "Google") {
      if (!formData.role) {
        toast({
          title: "Please select a role",
          description: "Choose either Artist or Client before signing up with Google.",
          variant: "destructive"
        });
        return;
      }
      
      localStorage.setItem('pendingSignupRole', formData.role);
      
      const { error } = await signInWithGoogle();
      if (!error) {
        // Redirect will happen automatically via useEffect when auth state change + profile loads
      }
    }
  };
  
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.role) {
      toast({ title: "Please select a role", description: "You must choose either Artist or Client to continue.", variant: "destructive" });
      return;
    }
    if (formData.password.length < 6) {
      toast({ title: "Password too short", description: "Password must be at least 6 characters long.", variant: "destructive" });
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast({ title: "Passwords do not match", description: "Please make sure your passwords match.", variant: "destructive" });
      return;
    }
    if (!formData.acceptTerms) {
      toast({ title: "Terms not accepted", description: "Please accept the Terms of Service and Privacy Policy to continue.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    
    const { error } = await signUp(formData.email, formData.password, {
      full_name: formData.name,
      role: formData.role
    });
    
    if (error) {
      setIsSubmitting(false);
    }
    // If no error, the useEffect above will handle redirection when profile updates
  };

  // Password strength indicators
  const passwordChecks = [
    { label: "At least 6 characters", met: formData.password.length >= 6 },
    { label: "Passwords match", met: formData.password.length > 0 && formData.password === formData.confirmPassword },
  ];

  // Visual Panel for desktop
  const ArtisticVisualPanel = () => (
    <div className="hidden md:flex flex-1 relative w-full min-h-full overflow-hidden bg-gradient-to-br from-[#0a0118] via-[#1a0533] to-[#0d001a]">
      {/* Animated gradient orbs */}
      <div className="absolute inset-0">
        <div className="absolute top-[15%] right-[20%] w-80 h-80 rounded-full bg-gradient-to-r from-emerald-500/30 to-teal-400/20 blur-3xl animate-pulse" style={{ animationDuration: '5s' }} />
        <div className="absolute bottom-[15%] left-[10%] w-96 h-96 rounded-full bg-gradient-to-r from-violet-600/35 to-fuchsia-500/25 blur-3xl animate-pulse" style={{ animationDuration: '7s', animationDelay: '1s' }} />
        <div className="absolute top-[55%] right-[35%] w-64 h-64 rounded-full bg-gradient-to-r from-blue-500/25 to-indigo-400/15 blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '3s' }} />
      </div>

      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
        backgroundSize: '60px 60px'
      }} />

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-between p-8 lg:p-12 xl:p-16 w-full">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-300/80 text-sm font-medium tracking-widest uppercase">Join Today</span>
          </div>
        </div>

        <div className="space-y-10">
          <div>
            <h2 className="text-3xl lg:text-5xl font-heading font-bold text-white leading-[1.1] mb-6">
              Welcome to 
              <br />
              <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
                Artswarit
              </span>
            </h2>
            <p className="text-white/70 text-lg max-w-md leading-relaxed font-medium">
              Artswarit is a premium marketplace designed specifically for the creative industry. We provide a secure workspace where talent meets opportunity.
            </p>
          </div>

          {/* How it Works - Real Steps */}
          <div className="space-y-6">
            <h3 className="text-white/40 text-xs font-black uppercase tracking-[0.2em]">How it Works</h3>
            <div className="space-y-6">
              {[
                {
                  title: "Build Your Profile",
                  desc: "Showcase your unique skills and verified portfolio to the world."
                },
                {
                  title: "List Your Services",
                  desc: "Define your specialized offerings and set your own professional rates."
                },
                {
                  title: "Connect & Earn",
                  desc: "Get discovered by premium clients and monetize your creative talent."
                }
              ].map((step, i) => (
                <div key={i} className="flex gap-4 group">
                  <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-white/80 font-black text-sm group-hover:bg-primary group-hover:border-primary transition-all duration-300">
                    {i + 1}
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
           <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" title="System Live" />
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
        <div className="w-full md:w-[55%] lg:w-1/2 xl:w-[520px] xl:min-w-[520px] flex flex-col">
          <div className="flex-1 flex items-start md:items-center justify-center px-5 sm:px-8 md:px-6 lg:px-10 py-8 md:py-4 lg:py-6 bg-white overflow-y-auto">
            <div className="w-full max-w-[420px] mx-auto">
              {/* Logo */}
              <div className="flex justify-center mb-6 lg:mb-8">
                <LogoWithName size="lg" />
              </div>

              {/* Heading */}
              <div className="mb-8 text-center">
                <h1 className="text-2xl sm:text-[28px] font-heading font-bold text-gray-900 tracking-tight">
                  Create your account
                </h1>
                <p className="text-gray-500 text-sm mt-2">
                  Already have an account?{" "}
                  <Link to="/login" className="font-semibold text-violet-600 hover:text-violet-700 transition-colors">
                    Sign in
                  </Link>
                </p>
              </div>

              {/* Role Selection */}
              <div className="mb-6">
                <Label className="text-[13px] font-medium text-gray-700 mb-3 block">
                  I want to join as <span className="text-red-500">*</span>
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {/* Artist Card */}
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, role: 'artist'})}
                    disabled={loading}
                    className={cn(
                      "relative p-4 sm:p-5 rounded-xl border-2 text-left transition-all duration-200 group",
                      formData.role === 'artist'
                        ? "border-violet-500 bg-violet-50/80 shadow-md shadow-violet-500/10"
                        : "border-gray-200 hover:border-violet-300 hover:bg-gray-50",
                      loading && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-colors",
                      formData.role === 'artist' ? "bg-violet-500 text-white" : "bg-gray-100 text-gray-500 group-hover:bg-violet-100 group-hover:text-violet-600"
                    )}>
                      <Palette className="h-5 w-5" />
                    </div>
                    <div className="font-semibold text-gray-900 text-[15px]">Artist</div>
                    <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">Showcase & earn from your creativity</div>
                    {formData.role === 'artist' && (
                      <div className="absolute top-3 right-3">
                        <CheckCircle2 className="h-5 w-5 text-violet-500" />
                      </div>
                    )}
                  </button>

                  {/* Client Card */}
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, role: 'client'})}
                    disabled={loading}
                    className={cn(
                      "relative p-4 sm:p-5 rounded-xl border-2 text-left transition-all duration-200 group",
                      formData.role === 'client'
                        ? "border-violet-500 bg-violet-50/80 shadow-md shadow-violet-500/10"
                        : "border-gray-200 hover:border-violet-300 hover:bg-gray-50",
                      loading && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-colors",
                      formData.role === 'client' ? "bg-violet-500 text-white" : "bg-gray-100 text-gray-500 group-hover:bg-violet-100 group-hover:text-violet-600"
                    )}>
                      <Users className="h-5 w-5" />
                    </div>
                    <div className="font-semibold text-gray-900 text-[15px]">Client</div>
                    <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">Find & hire talented artists</div>
                    {formData.role === 'client' && (
                      <div className="absolute top-3 right-3">
                        <CheckCircle2 className="h-5 w-5 text-violet-500" />
                      </div>
                    )}
                  </button>
                </div>
              </div>

              {/* Google Sign Up */}
              <button
                type="button"
                onClick={() => handleSocialSignup("Google")}
                disabled={loading || isSubmitting}
                className="w-full flex items-center justify-center gap-3 h-12 px-4 rounded-xl border border-gray-200 bg-white text-gray-700 font-medium text-sm hover:bg-gray-50 hover:border-gray-300 hover:shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span>Sign up with Google</span>
              </button>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-4 text-xs text-gray-400 uppercase tracking-wider">or sign up with email</span>
                </div>
              </div>

              {/* Email Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="signup-name" className="text-[13px] font-medium text-gray-700">Full name</Label>
                  <div className={cn(
                    "relative rounded-xl border transition-all duration-200",
                    focusedField === 'name' ? "border-violet-500 ring-2 ring-violet-500/20 shadow-sm" : "border-gray-200 hover:border-gray-300"
                  )}>
                    <Input
                      id="signup-name"
                      name="name"
                      type="text"
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={handleChange}
                      onFocus={() => setFocusedField('name')}
                      onBlur={() => setFocusedField(null)}
                      required
                      disabled={loading}
                      className="h-12 text-[15px] border-0 rounded-xl bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-4 placeholder:text-gray-400"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <Label htmlFor="signup-email" className="text-[13px] font-medium text-gray-700">Email address</Label>
                  <div className={cn(
                    "relative rounded-xl border transition-all duration-200",
                    focusedField === 'email' ? "border-violet-500 ring-2 ring-violet-500/20 shadow-sm" : "border-gray-200 hover:border-gray-300"
                  )}>
                    <Input
                      id="signup-email"
                      name="email"
                      type="email"
                      placeholder="name@example.com"
                      value={formData.email}
                      onChange={handleChange}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      required
                      disabled={loading}
                      className="h-12 text-[15px] border-0 rounded-xl bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-4 placeholder:text-gray-400"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="signup-password" className="text-[13px] font-medium text-gray-700">Password</Label>
                  <div className={cn(
                    "relative rounded-xl border transition-all duration-200",
                    focusedField === 'password' ? "border-violet-500 ring-2 ring-violet-500/20 shadow-sm" : "border-gray-200 hover:border-gray-300"
                  )}>
                    <Input
                      id="signup-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Min. 6 characters"
                      value={formData.password}
                      onChange={handleChange}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      required
                      disabled={loading}
                      className="h-12 text-[15px] border-0 rounded-xl bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-4 pr-12 placeholder:text-gray-400"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="signup-confirm-password" className="text-[13px] font-medium text-gray-700">Confirm password</Label>
                  <div className={cn(
                    "relative rounded-xl border transition-all duration-200",
                    focusedField === 'confirmPassword' ? "border-violet-500 ring-2 ring-violet-500/20 shadow-sm" : "border-gray-200 hover:border-gray-300"
                  )}>
                    <Input
                      id="signup-confirm-password"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm your password"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      onFocus={() => setFocusedField('confirmPassword')}
                      onBlur={() => setFocusedField(null)}
                      required
                      disabled={loading}
                      className="h-12 text-[15px] border-0 rounded-xl bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-4 pr-12 placeholder:text-gray-400"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                    </button>
                  </div>
                </div>

                {/* Password strength hints */}
                {formData.password.length > 0 && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {passwordChecks.map((check, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full transition-colors",
                          check.met ? "bg-emerald-500" : "bg-gray-300"
                        )} />
                        <span className={cn(
                          "text-xs transition-colors",
                          check.met ? "text-emerald-600" : "text-gray-400"
                        )}>{check.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Terms */}
                <div className="flex items-start gap-3 pt-1">
                  <Checkbox
                    id="signup-terms"
                    checked={formData.acceptTerms}
                    onCheckedChange={(checked) => setFormData({...formData, acceptTerms: checked as boolean})}
                    disabled={loading}
                    className="mt-0.5 data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600"
                  />
                  <Label htmlFor="signup-terms" className="text-xs text-gray-500 leading-relaxed cursor-pointer">
                    I accept the{" "}
                    <Link to="/terms-of-service" className="text-violet-600 hover:text-violet-700 font-medium underline">Terms of Service</Link>
                    {" "}and{" "}
                    <Link to="/privacy-policy" className="text-violet-600 hover:text-violet-700 font-medium underline">Privacy Policy</Link>
                    <span className="text-red-500"> *</span>
                  </Label>
                </div>

                {/* Submit */}
                <Button
                  type="submit"
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-medium text-[15px] shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all duration-300 group mt-2"
                  loading={isSubmitting || loading}
                >
                  {isSubmitting || loading ? (
                    "Creating account..."
                  ) : (
                    <span className="flex items-center gap-2">
                      Create account
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  )}
                </Button>
              </form>
            </div>
          </div>

          {/* Minimal footer */}
          <div className="px-6 py-4 text-center text-xs text-gray-400 bg-white border-t border-gray-100">
            Protected by industry-standard encryption
          </div>
        </div>
      </div>
      {!isModal && <Footer />}
    </div>
  );
};

export default Signup;
