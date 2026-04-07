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
      const { data: profiles, error } = await supabase
        .from("public_profiles")
        .select("*")
        .eq("role", "artist")
        .eq("account_status", "approved");

      if (error || !profiles || profiles.length === 0) {
        setArtists(getDummyArtists(limit));
        setLoading(false);
        return;
      }

      const completeProfiles = profiles
        .filter((p) => isProfileComplete(p))
        .filter((p) => p.profile_visibility === true);

      if (completeProfiles.length === 0) {
        setArtists(getDummyArtists(limit));
        setLoading(false);
        return;
      }

      const artistIds = completeProfiles.map((p) => p.id).filter(Boolean) as string[];

      const { data: follows } = await supabase
        .from("follows")
        .select("following_id")
        .in("following_id", artistIds);

      const followerCounts = new Map<string, number>();
      follows?.forEach((f) => {
        if (f.following_id) {
          followerCounts.set(f.following_id, (followerCounts.get(f.following_id) || 0) + 1);
        }
      });

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
      const { data: allLikes } = allArtworkIds.length > 0 ? await supabase.from("artwork_likes").select("artwork_id").in("artwork_id", allArtworkIds) : { data: [] };
      
      const artworkLikesMap = new Map<string, number>();
      allLikes?.forEach((like) => {
        if (like.artwork_id) {
          artworkLikesMap.set(like.artwork_id, (artworkLikesMap.get(like.artwork_id) || 0) + 1);
        }
      });

      const artistLikesMap = new Map<string, number>();
      artworkIdsByArtist.forEach((ids, artistId) => {
        let total = 0;
        ids.forEach((id) => (total += artworkLikesMap.get(id) || 0));
        artistLikesMap.set(artistId, total);
      });

      const { data: allViews } = allArtworkIds.length > 0 ? await supabase.from("artwork_views").select("artwork_id").in("artwork_id", allArtworkIds) : { data: [] };
      
      const artworkViewsMap = new Map<string, number>();
      allViews?.forEach((view) => {
        if (view.artwork_id) {
          artworkViewsMap.set(view.artwork_id, (artworkViewsMap.get(view.artwork_id) || 0) + 1);
        }
      });

      const artistViewsMap = new Map<string, number>();
      artworkIdsByArtist.forEach((ids, artistId) => {
        let total = 0;
        ids.forEach((id) => (total += artworkViewsMap.get(id) || 0));
        artistViewsMap.set(artistId, total);
      });

      const { data: reviews } = await supabase.from("project_reviews").select("artist_id, rating").in("artist_id", artistIds);
      const ratingMap = new Map<string, { total: number; count: number }>();
      reviews?.forEach((r) => {
        const existing = ratingMap.get(r.artist_id) || { total: 0, count: 0 };
        ratingMap.set(r.artist_id, { total: existing.total + r.rating, count: existing.count + 1 });
      });

      const now = Date.now();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      let maxFollowers = 1, maxLikes = 1, maxViews = 1;
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
        const avgRating = ratingData ? Math.round((ratingData.total / ratingData.count) * 10) / 10 : 0;
        const lastActive = profile.last_active_at ? new Date(profile.last_active_at).getTime() : 0;
        const recencyScore = lastActive > 0 ? Math.max(0, 1 - (now - lastActive) / thirtyDaysMs) : 0;
        const normFollowers = (followers / maxFollowers) * 100;
        const normLikes = (likes / maxLikes) * 100;
        const normViews = (views / maxViews) * 100;
        const normRating = (avgRating / 5) * 100;
        const normRecency = recencyScore * 100;
        const score = normFollowers * 0.25 + normLikes * 0.25 + normViews * 0.15 + normRating * 0.2 + normRecency * 0.15;
        return {
          id,
          name: profile.full_name || "Unknown Artist",
          category: Array.isArray(profile.tags) && profile.tags.length > 0 ? profile.tags[0] : "Artist",
          imageUrl: profile.avatar_url || "https://ui-avatars.com/api/?name=" + encodeURIComponent(profile.full_name || "Artist") + "&background=random",
          followers, likes, views, rating: avgRating, bio: profile.bio || "", score,
          tags: profile.tags || [], verified: profile.is_verified || false, location: profile.location || "",
        };
      });

      const sorted = scored.sort((a, b) => b.score - a.score).slice(0, limit);
      setArtists(sorted.length > 0 ? sorted : getDummyArtists(limit));
    } catch (err) {
      console.error("Featured artists fetch error:", err);
      setArtists(getDummyArtists(limit));
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchFeaturedArtists();
  }, [fetchFeaturedArtists]);

  return { artists, loading };
}

function getDummyArtists(limit: number): FeaturedArtist[] {
  return [
    {
      id: "dummy-1",
      name: "Alex Rivera",
      category: "Digital Art",
      imageUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop",
      followers: 1240,
      likes: 850,
      views: 5200,
      rating: 4.8,
      bio: "Digital illustrator specializing in cyberpunk aesthetics and character design.",
      score: 95,
      tags: ["Cyberpunk", "Illustration"],
      verified: true,
      location: "Berlin, Germany",
    },
    {
      id: "dummy-2",
      name: "Sarah Chen",
      category: "Music Production",
      imageUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop",
      followers: 890,
      likes: 620,
      views: 3100,
      rating: 4.9,
      bio: "Electronic music producer and sound designer for indie games.",
      score: 88,
      tags: ["Electronic", "Game Audio"],
      verified: true,
      location: "Vancouver, Canada",
    },
    {
      id: "dummy-3",
      name: "Marcus Thorne",
      category: "Photography",
      imageUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop",
      followers: 2100,
      likes: 1400,
      views: 12000,
      rating: 4.7,
      bio: "Travel photographer capturing the essence of urban life and architecture.",
      score: 92,
      tags: ["Urban", "Architecture"],
      verified: false,
      location: "London, UK",
    },
    {
      id: "dummy-4",
      name: "Elena Rossi",
      category: "Classical Music",
      imageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop",
      followers: 3200,
      likes: 2100,
      views: 15000,
      rating: 5.0,
      bio: "Concert violinist and composer exploring modern classical fusions.",
      score: 98,
      tags: ["Violin", "Classical"],
      verified: true,
      location: "Milan, Italy",
    },
  ].slice(0, limit);
}
