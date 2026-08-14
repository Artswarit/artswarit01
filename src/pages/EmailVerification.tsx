import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import LogoWithName from "@/components/LogoWithName";
import { useToast } from "@/hooks/use-toast";
import { Mail, Loader2, CheckCircle, RefreshCw, ArrowLeft } from "lucide-react";
import { FormField } from "@/components/shared";
import { emailSchema, firstError } from "@/lib/validation";

const EmailVerification = () => {
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [isVerified, setIsVerified] = useState(false);
  // Used only on the logged-out path, prefilled from ?email= when the caller
  // knows the address (e.g. a link from the signup confirmation screen).
  const [manualEmail, setManualEmail] = useState(searchParams.get('email') ?? '');
  const [manualEmailError, setManualEmailError] = useState<string | undefined>();

  useEffect(() => {
    // Check if user is verified
    if (user?.email_confirmed_at) {
      setIsVerified(true);
      // Redirect to appropriate dashboard after 2 seconds
      setTimeout(() => {
        redirectToDashboard();
      }, 2000);
    }
  }, [user]);

  useEffect(() => {
    // Countdown timer for resend cooldown
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  useEffect(() => {
    // Listen for auth state changes to detect email verification
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'USER_UPDATED' && session?.user?.email_confirmed_at) {
        setIsVerified(true);
        toast({
          title: "Email verified!",
          description: "Your email has been successfully verified.",
        });
        setTimeout(() => {
          redirectToDashboard();
        }, 2000);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const redirectToDashboard = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role === 'artist' || profile?.role === 'premium') {
        navigate('/artist-dashboard');
      } else if (profile?.role === 'admin') {
        navigate('/admin-dashboard');
      } else {
        navigate('/client-dashboard');
      }
    } catch (error) {
      navigate('/');
    }
  };

  const handleResendVerification = async () => {
    if (!user?.email) return;

    setIsResending(true);

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        console.error('Resend verification error:', error);
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Verification email sent!",
          description: "Please check your inbox for the verification link.",
        });
        setCooldown(60); // 60 second cooldown
      }
    } catch (error: any) {
      console.error('Resend verification error:', error);
      toast({
        title: "Error",
        description: "Failed to resend verification email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  // Resend for a user with no active session (expired link, closed tab).
  // supabase.auth.resend does not require authentication.
  const handleResendForEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = emailSchema.safeParse(manualEmail);
    if (!parsed.success) {
      setManualEmailError(firstError(parsed));
      return;
    }
    setManualEmailError(undefined);
    const email = parsed.data;

    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });

      if (error) {
        console.error('Resend verification error:', error);
        toast({
          title: "Couldn't send the email",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      // Deliberately not confirming whether the address exists — that would
      // let anyone probe for registered emails.
      toast({
        title: "Verification email sent",
        description: `If ${email} has an unverified account, a new link is on its way.`,
      });
      setCooldown(60);
    } catch (err) {
      console.error('Resend verification error:', err);
      toast({
        title: "Error",
        description: "Failed to resend verification email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  const handleRefreshStatus = async () => {
    const { data: { user: refreshedUser } } = await supabase.auth.getUser();
    if (refreshedUser?.email_confirmed_at) {
      setIsVerified(true);
      toast({
        title: "Email verified!",
        description: "Your email has been successfully verified.",
      });
      setTimeout(() => {
        redirectToDashboard();
      }, 2000);
    } else {
      toast({
        title: "Not yet verified",
        description: "Please check your email and click the verification link.",
      });
    }
  };

  // Logged-out users land here from an expired/already-used verification link
  // (see AuthLinkErrorHandler). Telling them to "log in to verify" was a dead
  // end: an unconfirmed account can't get past login, so there was no way to
  // request a fresh link. Supabase's resend works without a session, so ask for
  // the address instead.
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <Navbar />
        <div className="flex-1 flex items-center justify-center px-3 sm:px-6 py-[80px]">
          <div className="w-full max-w-sm sm:max-w-md space-y-6">
            <div className="text-center">
              <LogoWithName />
            </div>
            <Card className="glass-card border-0 shadow-xl">
              <CardHeader className="space-y-3 pb-4">
                <CardTitle className="text-xl sm:text-2xl text-center font-heading">
                  Resend verification email
                </CardTitle>
                <CardDescription className="text-center text-sm sm:text-base">
                  Enter the email address you signed up with and we'll send a new verification link.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleResendForEmail} noValidate className="space-y-4">
                  <FormField id="verify-email" label="Email address" error={manualEmailError}>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={manualEmail}
                      onChange={(e) => {
                        setManualEmail(e.target.value);
                        if (manualEmailError) setManualEmailError(undefined);
                      }}
                      disabled={isResending || cooldown > 0}
                    />
                  </FormField>
                  <Button
                    type="submit"
                    className="w-full h-11"
                    loading={isResending}
                    disabled={cooldown > 0 || !manualEmail.trim()}
                  >
                    {cooldown > 0 ? `Resend in ${cooldown}s` : "Send verification link"}
                  </Button>
                </form>
                <p className="text-xs text-muted-foreground text-center">
                  Already verified?{" "}
                  <Link to="/login" className="font-semibold text-primary hover:underline">
                    Sign in
                  </Link>
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <Navbar />
      <div className="flex-1 flex items-center justify-center px-3 sm:px-6 lg:px-8 py-[80px]">
        <div className="w-full max-w-sm sm:max-w-md space-y-6">
          <div className="text-center">
            <LogoWithName />
          </div>

          <Card className="glass-card border-0 shadow-xl">
            <CardHeader className="space-y-3 pb-4">
              <CardTitle className="text-xl sm:text-2xl text-center font-heading">
                {isVerified ? "Email Verified!" : "Verify Your Email"}
              </CardTitle>
              <CardDescription className="text-center text-sm sm:text-base">
                {isVerified 
                  ? "Your email has been verified. Redirecting..."
                  : "Please verify your email to continue"
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isVerified ? (
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle className="h-8 w-8 text-green-600" />
                    </div>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Your email has been successfully verified. 
                    Redirecting you to your dashboard...
                  </p>
                  <div className="flex justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
                      <Mail className="h-8 w-8 text-blue-600" />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-muted-foreground text-sm">
                      We've sent a verification email to:
                    </p>
                    <p className="font-medium text-foreground">
                      {user.email}
                    </p>
                  </div>

                  <p className="text-muted-foreground text-xs">
                    Please check your inbox and click the verification link to activate your account.
                    Don't forget to check your spam folder!
                  </p>

                  <div className="flex flex-col gap-2 pt-2">
                    <Button
                      onClick={handleResendVerification}
                      disabled={cooldown > 0}
                      loading={isResending}
                      className="w-full h-11 bg-brand-gradient hover:bg-brand-gradient-hover text-primary-foreground font-medium"
                    >
                      {isResending ? (
                        "Sending..."
                      ) : cooldown > 0 ? (
                        `Resend in ${cooldown}s`
                      ) : (
                        <>
                          <Mail className="mr-2 h-4 w-4" />
                          Resend Verification Email
                        </>
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      onClick={handleRefreshStatus}
                      className="w-full h-11"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      I've Verified, Check Status
                    </Button>
                  </div>
                </div>
              )}

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center text-sm font-medium text-primary hover:text-primary/80"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Login
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default EmailVerification;
