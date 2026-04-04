
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

    if (adminOnly && !isAdmin) {
      navigate('/login');
      return;
    }

    if (requiredRole && profile?.role) {
      if (requiredRole === 'admin' && !isAdmin) {
        navigate('/');
        return;
      }
      
      if (requiredRole !== profile.role) {
        // Redirect to appropriate dashboard based on their actual role
        if (profile.role === 'artist') {
          navigate('/artist-dashboard');
        } else if (profile.role === 'client') {
          navigate('/client-dashboard');
        } else {
          navigate('/');
        }
      }
    }
  }, [user, profile, loading, isAdmin, adminLoading, navigate, adminOnly, requiredRole]);

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

  return <>{children}</>;
};

export default ProtectedRoute;
