import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Review {
  id: string;
  content: string;
  author: string;
  role: string;
  rating: number;
  created_at: string;
}

// Fallback Testimonials (shown if database is empty or lacks quality reviews)
export const fallbackTestimonials = [{
  id: "fallback-1",
  content: "Artswarit helped me showcase my music to a broader audience and connect with clients I never thought possible.",
  author: "Rahul Kulkarni",
  role: "Lead Guitarist",
  rating: 5,
  created_at: new Date().toISOString()
}, {
  id: "fallback-2",
  content: "As a writer, I was struggling to monetize my work. Artswarit provided the perfect platform to share and earn from my passion.",
  author: "Ananya Reddy",
  role: "Creative Writer",
  rating: 5,
  created_at: new Date().toISOString()
}, {
  id: "fallback-3",
  content: "The verification badge gave my profile the credibility it needed. Now clients trust my work before even hearing it.",
  author: "Vikram Singh",
  role: "Music Producer",
  rating: 5,
  created_at: new Date().toISOString()
}];

export const usePlatformReviews = (limit: number = 3) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      // Fetch high-rated project reviews joined with client profiles
      const { data, error } = await supabase
        .from('project_reviews')
        .select(`
          id,
          review_text,
          rating,
          created_at,
          client:client_id (
            full_name,
            role
          )
        `)
        .gte('rating', 4) // Only positive reviews
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter for quality reviews: exclude anonymous/short/test content
      const qualityReviews = (data || []).filter((r: any) => {
        const name = r.client?.full_name?.toLowerCase() || '';
        const content = r.review_text?.toLowerCase() || '';
        return (
          name && 
          !name.includes('anonymous') && 
          !name.includes('test') &&
          content.length > 20 &&
          !content.includes('test')
        );
      });

      const formattedReviews: Review[] = qualityReviews.slice(0, limit).map((r: any) => ({
        id: r.id,
        content: r.review_text || '',
        author: r.client?.full_name || 'Verified User',
        role: r.client?.role || 'Creative Professional',
        rating: r.rating,
        created_at: r.created_at
      }));

      setReviews(formattedReviews.length > 0 ? formattedReviews : fallbackTestimonials);
    } catch (err) {
      console.error('Error fetching platform reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [limit]);

  return { reviews, loading, refresh: fetchReviews };
};
