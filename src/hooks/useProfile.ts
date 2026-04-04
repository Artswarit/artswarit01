import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { broadcastRefresh, useRealtimeSync } from '@/lib/realtime-sync';
import { getOptimizedImageUrl, ImagePresets } from '@/lib/image-optimization';

interface SocialLinks {
  instagram?: string;
  twitter?: string;
  linkedin?: string;
  youtube?: string;
  [key: string]: string | undefined;
}

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  role: string;
  bio: string | null;
  location: string | null;
  website: string | null;
  social_links: SocialLinks | null;
  is_verified: boolean;
  tags: string[] | null;
  hourly_rate: number | null;
  experience_years: number | null;
  portfolio_url: string | null;
  country: string | null;
  city: string | null;
  currency: string | null;
  created_at: string;
  updated_at: string;
}

export const useProfile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        setError(error.message);
        return;
      }

      // Cast social_links to proper type
      const profileData: Profile = {
        ...data,
        social_links: data.social_links as SocialLinks | null
      };
      setProfile(profileData);
    } catch (err: any) {
      console.error('Error fetching profile:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Realtime Sync
  useRealtimeSync('profile', fetchProfile);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Real-time subscription for profile updates (Direct Supabase)
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`profile-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        },
        () => {
          fetchProfile();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchProfile]);

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: 'No user logged in' };

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) {
        console.error('Error updating profile:', error);
        toast({
          title: "Update failed",
          description: error.message,
          variant: "destructive"
        });
        return { error };
      }

      // Broadcast update
      broadcastRefresh('profile');

      // Refresh profile data
      await fetchProfile();
      
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully."
      });

      return { error: null };
    } catch (err: any) {
      console.error('Error updating profile:', err);
      return { error: err.message };
    }
  };

  const optimizeImage = (file: File, maxDimension = 1200): Promise<File> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) {
        resolve(file);
        return;
      }
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => {
        let width = image.width;
        let height = image.height;
        if (width > height && width > maxDimension) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else if (height >= width && height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve(file);
          return;
        }
        ctx.drawImage(image, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (!blob) {
              resolve(file);
              return;
            }
            const optimizedFile = new File([blob], file.name, {
              type: blob.type || file.type,
              lastModified: Date.now()
            });
            resolve(optimizedFile);
          },
          'image/jpeg',
          0.85
        );
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file);
      };
      image.src = url;
    });
  };

  const uploadImage = async (file: File, type: 'avatar' | 'cover'): Promise<string | null> => {
    if (!user) return null;

    try {
      // Step 1: Optimize the file based on type
      const maxDim = type === 'avatar' ? 400 : 1600;
      const optimizedFile = await optimizeImage(file, maxDim);
      
      const fileExt = optimizedFile.name.split('.').pop() || 'jpg';
      const fileName = `${user.id}/${type}-${Date.now()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, optimizedFile, { upsert: true });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast({
          title: "Upload failed",
          description: uploadError.message,
          variant: "destructive"
        });
        return null;
      }

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;

      // Update profile with new image URL
      const updateField = type === 'avatar' ? 'avatar_url' : 'cover_url';
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ [updateField]: publicUrl })
        .eq('id', user.id);

      if (updateError) {
        console.error('Profile update error:', updateError);
        toast({
          title: "Update failed",
          description: updateError.message,
          variant: "destructive"
        });
        return null;
      }

      // Broadcast update
      broadcastRefresh('profile');

      await fetchProfile();

      toast({
        title: "Image updated",
        description: `Your ${type === 'avatar' ? 'profile' : 'cover'} image has been updated.`
      });

      return publicUrl;
    } catch (err: any) {
      console.error('Upload error:', err);
      toast({
        title: "Upload failed",
        description: err.message,
        variant: "destructive"
      });
      return null;
    }
  };

  return {
    profile,
    loading,
    error,
    updateProfile,
    uploadImage,
    refetch: fetchProfile
  };
};
