// Remplace features/profile/api en mode visite.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db, fail, ME, wait } from './store';

const profileKey = ['profile'] as const;

export function useProfile() {
  return useQuery({
    queryKey: profileKey,
    staleTime: Infinity,
    queryFn: async () => ({ id: ME, display_name: db.profiles.get(ME)! }),
  });
}

export function useUpdateName() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      await wait();
      db.profiles.set(ME, name.trim());
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      await wait();
      fail('En mode visite, il n\'y a pas de compte à supprimer.');
    },
  });
}
