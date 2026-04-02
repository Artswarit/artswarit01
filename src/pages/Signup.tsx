import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import SignupHeader from "@/components/auth/SignupHeader";
import SocialLoginButtons from "@/components/auth/SocialLoginButtons";
import SignupForm, { SignupFormData } from "@/components/auth/SignupForm";
import { Card, CardContent } from "@/components/ui/card";
import AuthShell from "@/components/auth/AuthShell";

const signupHighlights = [
  {
    title: "Create a polished profile",
    description: "Set up your account with a cleaner onboarding flow that feels solid on both desktop and mobile.",
  },
  {
    title: "Choose the right path",
    description: "Artists and clients can clearly select their role before continuing with email or Google.",
  },
  {
    title: "Stay readable on any device",
    description: "The new spacing, card width, and stacked mobile layout make the form easier to use everywhere.",
  },
];

const Signup = ({ isModal = false }: { isModal?: boolean }) => {
  const navigate = useNavigate();
  const { signUp, signInWithGoogle, loading, user } = useAuth();
  const { toast } = useToast();

  // Redirect if already logged in
  useEffect(() => {
    if (user && !loading) {
      navigate('/');
    }
  }, [user, loading, navigate]);
  
  const [formData, setFormData] = useState<SignupFormData>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "",
    acceptTerms: false
  });
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  const handleRoleChange = (value: string) => {
    setFormData({
      ...formData,
      role: value
    });
  };
  
  const handleTermsChange = (checked: boolean) => {
    setFormData({
      ...formData,
      acceptTerms: checked
    });
  };

  const handleSocialSignup = async (provider: string) => {
    if (provider === "Google") {
      if (!formData.role) {
        toast({
          title: "Please select a role",
          description: "You must choose either Artist or Client before signing up with Google.",
          variant: "destructive"
        });
        return;
      }
      
      localStorage.setItem('pendingSignupRole', formData.role);
      
      const { error } = await signInWithGoogle();
      if (!error) {
        // Redirect will happen automatically via auth state change
      }
    } else {
      toast({
        title: "Coming Soon",
        description: `${provider} signup is not implemented yet.`,
      });
    }
  };
  
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      return;
    }
    
    if (!formData.acceptTerms) {
      return;
    }
    
    const { error } = await signUp(formData.email, formData.password, {
      full_name: formData.name,
      role: formData.role
    });
    
    if (!error) {
      if (formData.role === "artist") {
        setTimeout(() => navigate("/artist-dashboard"), 1000);
      } else {
        setTimeout(() => navigate("/client-dashboard"), 1000);
      }
    }
  };

  return (
    <AuthShell
      isModal={isModal}
      onClose={() => navigate(-1)}
      title="Start your Artswarit journey with a better first impression."
      description="Join as an artist or client through a signup flow that feels tighter, clearer, and more responsive on every screen."
      highlights={signupHighlights}
    >
      <Card className="rounded-[2rem] border border-border/60 bg-card/85 shadow-2xl backdrop-blur-xl">
        <CardContent className="px-6 py-6 sm:px-8 sm:py-8">
          <SignupHeader />
          <div className="mt-6">
            <SocialLoginButtons onSocialSignup={handleSocialSignup} />
          </div>
          <SignupForm
            formData={formData}
            handleChange={handleChange}
            handleRoleChange={handleRoleChange}
            handleTermsChange={handleTermsChange}
            handleSubmit={handleSubmit}
            loading={loading}
          />
        </CardContent>
      </Card>
    </AuthShell>
  );
};

export default Signup;
