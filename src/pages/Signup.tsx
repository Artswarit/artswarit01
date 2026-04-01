import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SignupHeader from "@/components/auth/SignupHeader";
import SocialLoginButtons from "@/components/auth/SocialLoginButtons";
import SignupForm, { SignupFormData } from "@/components/auth/SignupForm";
import LogoWithName from "@/components/LogoWithName";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <div className={cn(
      "min-h-screen flex flex-col bg-gradient-to-br from-primary/5 via-background to-primary/10",
      isModal && "min-h-0 bg-none"
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
        "flex-1 flex items-center justify-center px-4 sm:px-6",
        isModal ? "py-6" : "pt-24 sm:pt-28 pb-16"
      )}>
        <div className="w-full" style={{ maxWidth: 448 }}>
          <div className="text-center mb-4">
            <LogoWithName />
          </div>
          <SignupHeader />
          <div className="mt-4">
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
        </div>
      </div>
      {!isModal && <Footer />}
    </div>
  );
};

export default Signup;
