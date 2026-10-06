import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserId } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';

const profileKey = ['profile'] as const;

export function useProfile() {
  const userId = useUserId();
  return useQuery({
    queryKey: profileKey,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, display_name').eq('id', userId).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateName() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from('profiles').update({ display_name: name.trim() }).eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

/** Supprime le compte et tout ce qu'il contient (recettes, avis, appartenances, photos). */
export function useDeleteAccount() {
  const userId = useUserId();
  return useMutation({
    mutationFn: async () => {
      // Photos d'abord : une fois le compte supprimé, on n'a plus le droit d'y toucher.
      const { data: folders } = await supabase.storage.from('photos').list(userId, { limit: 1000 });
      for (const folder of folders ?? []) {
        const { data: files } = await supabase.storage.from('photos').list(`${userId}/${folder.name}`, { limit: 1000 });
        const paths = (files ?? []).map((f) => `${userId}/${folder.name}/${f.name}`);
        if (paths.length > 0) await supabase.storage.from('photos').remove(paths);
      }
      const { error } = await supabase.rpc('delete_my_account');
      if (error) throw error;
      await supabase.auth.signOut();
    },
  });
}
