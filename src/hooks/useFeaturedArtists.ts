import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FeaturedArtist {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  followers: number;
  likes: number;
  views: number;
  rating: number;
  bio: string;
  score: number;
  tags: string[];
  verified: boolean;
  location: string;
}

/**
 * Featured Artist Ranking Algorithm
 *
 * Score = (followers × 0.25) + (likes × 0.25) + (views × 0.15) + (rating × 0.20) + (recency × 0.15)
 *
 * - followers: normalized follower count
 * - likes: total artwork likes
 * - views: total artwork views
 * - rating: average project review rating (0-5, scaled to 0-100)
 * - recency: bonus for recently active artists (last 30 days)
 */

const isProfileComplete = (profile: any): boolean => {
  if (!profile) return false;
  const hasDisplayName = profile.full_name && profile.full_name.trim() !== "";
  const bio = profile.bio?.trim() || "";
  const hasBio =
    bio !== "" &&
    bio.toLowerCase() !== "artist on artswarit" &&
    bio.toLowerCase() !== "tell others about yourself and your art...";
  const avatarUrl = profile.avatar_url?.trim() || "";
  const hasAvatar =
    avatarUrl !== "" &&
    !avatarUrl.includes("ui-avatars.com") &&
    !avatarUrl.includes("placeholder");
  return hasDisplayName && hasBio && hasAvatar;
};

export function useFeaturedArtists(limit = 8) {
  const [artists, setArtists] = useState<FeaturedArtist[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFeaturedArtists = useCallback(async () => {
    try {
      // 1. Fetch approved artist profiles with public visibility
      const { data: profiles, error } = await supabase
        .from("public_profiles")
        .select("*")
        .eq("role", "artist")
        .eq("account_status", "approved");

      if (error || !profiles || profiles.length === 0) {
        setArtists([]);
        setLoading(false);
        return;
      }

      // Filter to only complete + visible profiles
      const completeProfiles = profiles
        .filter((p) => isProfileComplete(p))
        .filter((p) => p.profile_visibility === true);

      if (completeProfiles.length === 0) {
        setArtists([]);
        setLoading(false);
        return;
      }

      const artistIds = completeProfiles
        .map((p) => p.id)
        .filter(Boolean) as string[];

      // 2. Fetch follower counts
      const { data: follows } = await supabase
        .from("follows")
        .select("following_id")
        .in("following_id", artistIds);

      const followerCounts = new Map<string, number>();
      follows?.forEach((f) => {
        if (f.following_id) {
          followerCounts.set(
            f.following_id,
            (followerCounts.get(f.following_id) || 0) + 1
          );
        }
      });

      // 3. Fetch artwork IDs per artist
      const { data: artworks } = await supabase
        .from("artworks")
        .select("id, artist_id")
        .in("artist_id", artistIds)
        .eq("status", "public");

      const artworkIdsByArtist = new Map<string, string[]>();
      artworks?.forEach((a) => {
        const ids = artworkIdsByArtist.get(a.artist_id) || [];
        ids.push(a.id);
        artworkIdsByArtist.set(a.artist_id, ids);
      });

      const allArtworkIds = artworks?.map((a) => a.id) || [];

      // 4. Fetch likes
      const { data: allLikes } =
        allArtworkIds.length > 0
          ? await supabase
              .from("artwork_likes")
              .select("artwork_id")
              .in("artwork_id", allArtworkIds)
          : { data: [] };

      const artworkLikesMap = new Map<string, number>();
      allLikes?.forEach((like) => {
        if (like.artwork_id) {
          artworkLikesMap.set(
            like.artwork_id,
            (artworkLikesMap.get(like.artwork_id) || 0) + 1
          );
        }
      });

      const artistLikesMap = new Map<string, number>();
      artworkIdsByArtist.forEach((ids, artistId) => {
        let total = 0;
        ids.forEach((id) => (total += artworkLikesMap.get(id) || 0));
        artistLikesMap.set(artistId, total);
      });

      // 5. Fetch views
      const { data: allViews } =
        allArtworkIds.length > 0
          ? await supabase
              .from("artwork_views")
              .select("artwork_id")
              .in("artwork_id", allArtworkIds)
          : { data: [] };

      const artworkViewsMap = new Map<string, number>();
      allViews?.forEach((view) => {
        if (view.artwork_id) {
          artworkViewsMap.set(
            view.artwork_id,
            (artworkViewsMap.get(view.artwork_id) || 0) + 1
          );
        }
      });

      const artistViewsMap = new Map<string, number>();
      artworkIdsByArtist.forEach((ids, artistId) => {
        let total = 0;
        ids.forEach((id) => (total += artworkViewsMap.get(id) || 0));
        artistViewsMap.set(artistId, total);
      });

      // 6. Fetch ratings
      const { data: reviews } = await supabase
        .from("project_reviews")
        .select("artist_id, rating")
        .in("artist_id", artistIds);

      const ratingMap = new Map<string, { total: number; count: number }>();
      reviews?.forEach((r) => {
        const existing = ratingMap.get(r.artist_id) || { total: 0, count: 0 };
        ratingMap.set(r.artist_id, {
          total: existing.total + r.rating,
          count: existing.count + 1,
        });
      });

      // 7. Build artist data with algorithm scores
      const now = Date.now();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

      // Find max values for normalization
      let maxFollowers = 1,
        maxLikes = 1,
        maxViews = 1;
      artistIds.forEach((id) => {
        maxFollowers = Math.max(maxFollowers, followerCounts.get(id) || 0);
        maxLikes = Math.max(maxLikes, artistLikesMap.get(id) || 0);
        maxViews = Math.max(maxViews, artistViewsMap.get(id) || 0);
      });

      const scored: FeaturedArtist[] = completeProfiles.map((profile) => {
        const id = profile.id || "";
        const followers = followerCounts.get(id) || 0;
        const likes = artistLikesMap.get(id) || 0;
        const views = artistViewsMap.get(id) || 0;
        const ratingData = ratingMap.get(id);
        const avgRating = ratingData
          ? Math.round((ratingData.total / ratingData.count) * 10) / 10
          : 0;

        // Recency bonus — based on last_active_at
        const lastActive = profile.last_active_at
          ? new Date(profile.last_active_at).getTime()
          : 0;
        const recencyScore =
          lastActive > 0
            ? Math.max(0, 1 - (now - lastActive) / thirtyDaysMs)
            : 0;

        // Normalized scores (0-100)
        const normFollowers = (followers / maxFollowers) * 100;
        const normLikes = (likes / maxLikes) * 100;
        const normViews = (views / maxViews) * 100;
        const normRating = (avgRating / 5) * 100;
        const normRecency = recencyScore * 100;

        // Weighted composite score
        const score =
          normFollowers * 0.25 +
          normLikes * 0.25 +
          normViews * 0.15 +
          normRating * 0.2 +
          normRecency * 0.15;

        const primaryCategory =
          Array.isArray(profile.tags) && profile.tags.length > 0
            ? profile.tags[0]
            : "Artist";

        return {
          id,
          name: profile.full_name || "Unknown Artist",
          category: primaryCategory,
          imageUrl:
            profile.avatar_url ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name || "Artist")}&background=random`,
          followers,
          likes,
          views,
          rating: avgRating,
          bio: profile.bio || "",
          score,
          tags: profile.tags || [],
          verified: profile.is_verified || false,
          location: profile.location || "",
        };
      });

      // Sort by score descending and take top N
      scored.sort((a, b) => b.score - a.score);
      setArtists(scored.slice(0, limit));
    } catch (err) {
      // Silent failure – featured section is non-critical
      console.error("Featured artists fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchFeaturedArtists();
  }, [fetchFeaturedArtists]);

  return { artists, loading };
}
