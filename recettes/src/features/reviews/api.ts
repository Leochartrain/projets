import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface Review {
  id: string;
  groupId: string;
  authorId: string;
  authorName: string;
  rating: number | null;
  comment: string | null;
  createdAt: string;
}

const reviewKeys = { recipe: (id: string) => ['reviews', id] as const };

/** Avis visibles par moi (ceux des groupes dont je fais partie). */
export function useReviews(recipeId: string) {
  return useQuery({
    queryKey: reviewKeys.recipe(recipeId),
    queryFn: async (): Promise<Review[]> => {
      const { data, error } = await supabase
        .from('reviews')
        .select('id, group_id, author_id, rating, comment, created_at, author:profiles!inner(display_name)')
        .eq('recipe_id', recipeId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map((r) => ({
        id: r.id,
        groupId: r.group_id,
        authorId: r.author_id,
        authorName: r.author.display_name,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.created_at,
      }));
    },
  });
}

/** Moyenne des notes (les avis sans note ne comptent pas). */
export function averageRating(reviews: Review[]): { average: number; count: number } | null {
  const rated = reviews.flatMap((r) => (r.rating ? [r.rating] : []));
  if (rated.length === 0) return null;
  return { average: rated.reduce((a, b) => a + b, 0) / rated.length, count: rated.length };
}

export function useAddReview(recipeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { groupId: string; rating: number | null; comment: string }) => {
      const { error } = await supabase.from('reviews').insert({
        recipe_id: recipeId,
        group_id: input.groupId,
        rating: input.rating,
        comment: input.comment.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reviewKeys.recipe(recipeId) }),
  });
}

export function useDeleteReview(recipeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reviews').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reviewKeys.recipe(recipeId) }),
  });
}
