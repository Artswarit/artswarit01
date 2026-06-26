import { useMemo } from 'react';
import { useProfile } from './useProfile';

interface ProfileCompletionStatus {
  isComplete: boolean;
  completionPercentage: number;
  missingFields: string[];
  requiredFields: string[];
}

type ProfileLike = {
  role?: string | null;
  full_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  tags?: unknown;
  skills?: unknown;
  categories?: unknown;
  profession?: string | null;
  location?: string | null;
};

const hasText = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0;

const hasListValue = (value: unknown) => {
  if (Array.isArray(value)) return value.some((item) => hasText(item));
  return hasText(value);
};

export const computeProfileCompletion = (
  profile: ProfileLike | null | undefined
): ProfileCompletionStatus => {
  if (!profile) {
    return {
      isComplete: false,
      completionPercentage: 0,
      missingFields: [],
      requiredFields: [],
    };
  }

  // Required fields stay small and practical. Location is useful, but not a blocker:
  // users were being marked incomplete even after finishing the visible profile form.
  const baseFields = [
    { key: 'full_name', label: 'Display Name' },
    { key: 'bio', label: 'Bio' },
    { key: 'avatar_url', label: 'Profile Picture' },
  ];

  // Additional fields for artists only
  const artistFields = [
    { key: 'tags', label: 'Categories/Skills' }
  ];

  const isArtist = profile.role === 'artist' || profile.role === 'premium';
  const allRequiredFields = isArtist
    ? [...baseFields, ...artistFields]
    : baseFields;

  const missingFields: string[] = [];

  allRequiredFields.forEach((field) => {
    const value = (profile as any)[field.key];

    if (field.key === 'tags') {
      if (!hasListValue(value) && !hasListValue((profile as any).skills) && !hasListValue((profile as any).categories) && !hasText((profile as any).profession)) {
        missingFields.push(field.label);
      }
    } else if (field.key === 'avatar_url') {
      // Avatar must exist and not be a generated placeholder
      const avatarUrl = (typeof value === 'string' ? value.trim() : '') || '';
      const isValidAvatar = avatarUrl !== '' && 
        !avatarUrl.includes('ui-avatars.com') && 
        !avatarUrl.includes('placeholder');
      if (!isValidAvatar) {
        missingFields.push(field.label);
      }
    } else if (field.key === 'bio') {
      // Bio must exist and not be empty or default placeholder
      const bio = (typeof value === 'string' ? value.trim() : '') || '';
      const isValidBio = bio !== '' && 
        bio.toLowerCase() !== 'artist on artswarit' && 
        bio.toLowerCase() !== 'tell others about yourself and your art...';
      if (!isValidBio) {
        missingFields.push(field.label);
      }
    } else if (!value || (typeof value === 'string' && value.trim() === '')) {
      missingFields.push(field.label);
    }
  });

  const completedCount = allRequiredFields.length - missingFields.length;
  const completionPercentage =
    allRequiredFields.length === 0
      ? 0
      : Math.round((completedCount / allRequiredFields.length) * 100);

  return {
    isComplete: missingFields.length === 0,
    completionPercentage,
    missingFields,
    requiredFields: allRequiredFields.map((f) => f.label),
  };
};

export const useProfileCompletion = (): ProfileCompletionStatus & { loading: boolean } => {
  const { profile, loading, error } = useProfile();

  const completionStatus = useMemo((): ProfileCompletionStatus => {
    // Return empty state while loading or if there's an error
    if (loading || error) {
      return {
        isComplete: false,
        completionPercentage: 0,
        missingFields: [],
        requiredFields: [],
      };
    }

    return computeProfileCompletion(profile as any);
  }, [profile, loading, error]);

  return {
    ...completionStatus,
    loading,
  };
};
