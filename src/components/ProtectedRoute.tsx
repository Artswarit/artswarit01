
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import LogoLoader from '@/components/ui/LogoLoader';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'artist' | 'client' | 'admin';
  adminOnly?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole, adminOnly = false }) => {
  const { user, profile, loading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || (adminOnly && adminLoading)) return;

    if (!user) {
      navigate('/login');
      return;
    }

    // Force email verification if needed
    // Skip verification check for Google users which are always verified
    const isGoogleUser = user.app_metadata?.provider === 'google';
    if (!user.email_confirmed_at && !isGoogleUser) {
      if (window.location.pathname !== '/verify-email') {
        console.log("🔒 ProtectedRoute: Email not verified, redirecting to /verify-email");
        navigate('/verify-email', { replace: true });
      }
      return;
    }

    if (adminOnly && !isAdmin && !adminLoading) {
      console.log("🔒 ProtectedRoute: Admin access denied");
      navigate('/login', { replace: true });
      return;
    }

    if (requiredRole === 'admin' && isAdmin) {
      return;
    }

    if (requiredRole && profile?.role) {
      if (requiredRole === 'admin' && !isAdmin) {
        navigate('/', { replace: true });
        return;
      }
      
      if (requiredRole !== profile.role) {
        // Redirect to appropriate dashboard based on their actual role
        const targetPath = profile.role === 'artist' 
          ? '/artist-dashboard' 
          : profile.role === 'client' 
            ? '/client-dashboard' 
            : '/';
        
        if (window.location.pathname !== targetPath) {
          console.log(`🔒 ProtectedRoute: Role mismatch (${profile.role} != ${requiredRole}), redirecting to ${targetPath}`);
          navigate(targetPath, { replace: true });
          return;
        }
      }
    }
  }, [user, profile, loading, isAdmin, adminLoading, navigate, adminOnly, requiredRole]);

  // Show loader while checking auth/profile
  if (loading || (adminOnly && adminLoading)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LogoLoader text="Securing your session…" />
      </div>
    );
  }

  // Prevent rendering if not authenticated
  if (!user) return null;

  // Prevent rendering if email not confirmed
  const isGoogleUser = user?.app_metadata?.provider === 'google';
  if (!user?.email_confirmed_at && !isGoogleUser) {
    // If we are on the verification page, allow it to render
    if (window.location.pathname === '/verify-email') {
      return <>{children}</>;
    }
    return null;
  }

  // Prevent rendering if admin only but not admin
  if (adminOnly && !isAdmin) return null;

  if (requiredRole === 'admin' && isAdmin) {
    return <>{children}</>;
  }

  // If a specific role is required, wait for the profile to be loaded
  // This prevents the "Users stuck in wrong dashboard" issue if profile is missing
  if (requiredRole && !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="max-w-md w-full text-center space-y-4 px-4">
          <LogoLoader text="Loading your workspace…" />
          <p className="text-xs text-muted-foreground animate-pulse">
            Fetching your professional credentials...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
