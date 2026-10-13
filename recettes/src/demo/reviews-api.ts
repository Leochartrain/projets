// Remplace features/reviews/api en mode visite.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { averageRating, type Review } from '@/features/reviews/api';
import { db, ME, myGroupIds, profileName, wait } from './store';

export { averageRating };
export type { Review };

const reviewKeys = { recipe: (id: string) => ['reviews', id] as const };

export function useReviews(recipeId: string) {
  return useQuery({
    queryKey: reviewKeys.recipe(recipeId),
    queryFn: async (): Promise<Review[]> => {
      await wait();
      const mine = myGroupIds();
      return db.reviews
        .filter((r) => r.recipeId === recipeId && mine.has(r.groupId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((r) => ({ ...r, authorName: profileName(r.authorId) }));
    },
  });
}

export function useAddReview(recipeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { groupId: string; rating: number | null; comment: string }) => {
      await wait();
      db.reviews.push({
        id: crypto.randomUUID(),
        recipeId,
        groupId: input.groupId,
        authorId: ME,
        rating: input.rating,
        comment: input.comment.trim() || null,
        createdAt: new Date().toISOString(),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reviewKeys.recipe(recipeId) }),
  });
}

export function useDeleteReview(recipeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      db.reviews = db.reviews.filter((r) => r.id !== id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reviewKeys.recipe(recipeId) }),
  });
}
