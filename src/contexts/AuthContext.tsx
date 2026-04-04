
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

import LogoLoader from '@/components/ui/LogoLoader';

interface UserProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: string | null;
  cover_url: string | null;
  tags: string[] | null;
  location: string | null;
  website: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  subscription: any | null;
  isPremium: boolean;
  profile: UserProfile | null;
  refreshProfile: () => Promise<void>;
  signUp: (email: string, password: string, userData: { full_name: string; role: string; country?: string }) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const { toast } = useToast();
  const isPremium = subscription?.is_active === true && subscription?.subscription_tier === 'pro';

  // Fetch the current user's profile from the DB
  const refreshProfile = useCallback(async (userId?: string) => {
    const uid = userId;
    if (!uid) return;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, bio, role, cover_url, tags, location, website')
        .eq('id', uid)
        .maybeSingle();
      if (data) setProfile(data as UserProfile);
    } catch { /* silent */ }
  }, []);
  useEffect(() => {
    // Fetch initial subscription
    const fetchSubscription = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from('subscribers')
          .select('*')
          .eq('user_id', userId)
          .eq('is_active', true)
          .maybeSingle();
        
        if (error) {
          return;
        }
        setSubscription(data);
      } catch (err) {
        // Silent failure for background subscription fetch
      }
    };

    let authListenerFired = false;

    // Set up auth state listener - MUST be synchronous to avoid deadlocks
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        authListenerFired = true;
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          fetchSubscription(session.user.id);
          refreshProfile(session.user.id);
          
          if (event === 'SIGNED_IN') {
            // Check for pending signup role (Google OAuth)
            const pendingRole = localStorage.getItem('pendingSignupRole');
            if (pendingRole) {
              handleGoogleSignupProfile(session.user, pendingRole);
            }
          }
        } else {
          setLoading(false);
          setSubscription(null);
          setProfile(null);
          localStorage.removeItem('pendingSignupRole');
        }
      }
    );

    // Fallback if listener doesn't fire immediately
    const sessionCheck = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!authListenerFired) {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);
        if (currentSession?.user) {
          fetchSubscription(currentSession.user.id);
          refreshProfile(currentSession.user.id);
        }
      }
    };
    sessionCheck();

    return () => {
      authSubscription.unsubscribe();
    };
  }, []);

  // Real-time subscription for profile sync
  useEffect(() => {
    if (!user) return;

    const profileChannel = supabase
      .channel(`user-profile-sync-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        () => refreshProfile(user.id)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
    };
  }, [user, refreshProfile]);

  // Handle Google signup profile creation
  const handleGoogleSignupProfile = async (u: User, pendingRole: string) => {
    try {
      // Small delay to ensure DB role-based triggers (if any) or existing processes have settled
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', u.id)
        .maybeSingle();
      
      if (existingProfile?.role) {
        localStorage.removeItem('pendingSignupRole');
        setLoading(false);
        return;
      }

      // No profile exists or no role — Create/Update profile with selected role.
      const profileData = {
        id: u.id,
        email: u.email || '',
        full_name: u.user_metadata?.full_name || u.user_metadata?.name || '',
        role: pendingRole,
        avatar_url: u.user_metadata?.avatar_url || u.user_metadata?.picture || '',
        updated_at: new Date().toISOString()
      };

      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert(profileData);
        
      if (upsertError) {
        console.error('Failed to create/upsert Google OAuth profile:', upsertError);
        toast({
          title: "Profile Setup Issue",
          description: "Your account was created but we couldn't set up your profile properly.",
          variant: "destructive"
        });
      } else {
        localStorage.removeItem('pendingSignupRole');
        refreshProfile(u.id);
      }
    } catch (error) {
      console.error('Error in handleGoogleSignupProfile:', error);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, userData: { full_name: string; role: string; country?: string }) => {
    try {
      setLoading(true);
      const redirectUrl = `${window.location.origin}/`;
      
      const { error, data } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: userData
        }
      });

      if (error) {
        toast({
          title: "Sign up failed",
          description: error.message,
          variant: "destructive"
        });
        return { error };
      }

      // Supabase returns a fake success for existing users (security measure).
      // Detect this by checking if user.identities is empty or user already confirmed.
      const identities = data?.user?.identities;
      if (identities && identities.length === 0) {
        toast({
          title: "Account already exists",
          description: "An account with this email already exists. Please sign in instead, or use 'Forgot Password' to reset your password.",
          variant: "destructive"
        });
        return { error: { message: 'Account already exists' } };
      }

      toast({
        title: "Account created successfully!",
        description: "Please check your email to verify your account."
      });

      return { error: null };
    } catch (error: any) {
      return { error };
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { error, data } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('Signin error:', error);
        let errorMessage = error.message;
        
        // Provide user-friendly error messages
        if (error.message === 'Invalid login credentials') {
          errorMessage = 'Invalid email or password. Please check your credentials and try again.';
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = 'Please verify your email address before signing in.';
        }
        
        toast({
          title: "Sign in failed",
          description: errorMessage,
          variant: "destructive"
        });
        return { error };
      }

      toast({
        title: "Welcome back!",
        description: "You've successfully signed in."
      });

      return { error: null, user: data.user };
    } catch (error: any) {
      console.error('Signin error:', error);
      toast({
        title: "Sign in failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
      return { error };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      // 1. Clear application state immediately for UI feedback
      setUser(null);
      setSession(null);
      setSubscription(null);
      setProfile(null);
      
      // 2. Perform the actual Supabase sign out
      // We await this to ensure the session is invalidated in the database/storage
      await supabase.auth.signOut();

      // 3. Clear storage keys related to Supabase to prevent ghost sessions
      // This is a safety measure if signOut didn't clean everything
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.includes('supabase.auth.token') || key.startsWith('sb-')) {
          localStorage.removeItem(key);
        }
      }

      // 4. Force a hard refresh to home page to clear any remaining in-memory state
      // Use replace to avoid the "back button" logging them back in
      window.location.replace('/');

      toast({
        title: "Signed out",
        description: "You've been successfully signed out."
      });

      return { error: null };
    } catch (error: any) {
      console.error('Signout error:', error);
      // Even if it fails, try to force a redirect to home for safety
      window.location.replace('/');
      return { error };
    }
  };

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`
        }
      });

      if (error) {
        toast({
          title: "Google sign in failed",
          description: error.message,
          variant: "destructive"
        });
        return { error };
      }

      return { error: null };
    } catch (error: any) {
      return { error };
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    session,
    loading,
    subscription,
    isPremium,
    profile,
    refreshProfile,
    signUp,
    signIn,
    signOut,
    signInWithGoogle
  };

  return (
    <AuthContext.Provider value={value}>
      {loading && <LogoLoader fullPage text="Loading Artswarit…" />}
      <div style={loading ? { visibility: 'hidden', overflow: 'hidden', height: 0 } : undefined}>
        {children}
      </div>
    </AuthContext.Provider>
  );
};
