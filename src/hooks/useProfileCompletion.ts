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

  // Keep completion practical and aligned with the visible profile UI.
  // Creative metadata such as bio, avatar, tags, city and country is optional and
  // must not keep a real profile locked as "Incomplete".
  const baseFields = [
    { key: 'full_name', label: 'Display Name' },
  ];

  const allRequiredFields = baseFields;

  const missingFields: string[] = [];

  allRequiredFields.forEach((field) => {
    const value = (profile as any)[field.key];

    if (!value || (typeof value === 'string' && value.trim() === '')) {
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
