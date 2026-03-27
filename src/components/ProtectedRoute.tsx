import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import LogoLoader from "@/components/ui/LogoLoader";
import SEOHead from "@/components/SEOHead";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "artist" | "client" | "admin";
  adminOnly?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  adminOnly = false,
}) => {
  const { user, loading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || (adminOnly && adminLoading)) return;

    if (!user) {
      navigate("/login");
      return;
    }

    if (adminOnly && !isAdmin) {
      navigate("/login");
      return;
    }
  }, [user, loading, isAdmin, adminLoading, navigate, adminOnly]);

  if (loading || (adminOnly && adminLoading)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LogoLoader text="Loading…" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (adminOnly && !isAdmin) {
    return null;
  }

  return (
    <>
      <SEOHead title="Secure Area" description="Account dashboard" noindex={true} />
      {children}
    </>
  );
};

export default ProtectedRoute;





