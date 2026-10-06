import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useUserId } from '@/features/auth/AuthProvider';

export const groupKeys = {
  all: ['groups'] as const,
  detail: (id: string) => ['groups', id] as const,
  invitation: (id: string) => ['groups', id, 'invitation'] as const,
  preview: (code: string) => ['invitation-preview', code] as const,
};

export interface GroupSummary {
  id: string;
  name: string;
  role: 'admin' | 'member';
  memberCount: number;
  recipeCount: number;
}

/** Mes groupes, avec mon rôle et le nombre de membres et de recettes. */
export function useMyGroups() {
  const userId = useUserId();
  return useQuery({
    queryKey: groupKeys.all,
    queryFn: async (): Promise<GroupSummary[]> => {
      const { data, error } = await supabase
        .from('group_members')
        .select('role, group:groups!inner(id, name, members:group_members(count), recipes:recipe_shares(count))')
        .eq('user_id', userId)
        .order('joined_at');
      if (error) throw error;
      return data.map(({ role, group }) => ({
        id: group.id,
        name: group.name,
        role,
        memberCount: group.members[0]?.count ?? 0,
        recipeCount: group.recipes[0]?.count ?? 0,
      }));
    },
  });
}

export interface GroupDetail {
  id: string;
  name: string;
  myRole: 'admin' | 'member' | null;
  members: { id: string; name: string; role: 'admin' | 'member' }[];
}

export function useGroup(id: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: groupKeys.detail(id),
    queryFn: async (): Promise<GroupDetail> => {
      const { data, error } = await supabase
        .from('groups')
        .select('id, name, members:group_members(role, joined_at, profile:profiles!inner(id, display_name))')
        .eq('id', id)
        .single();
      if (error) throw error;
      const members = [...data.members]
        .sort((a, b) => a.joined_at.localeCompare(b.joined_at))
        .map((m) => ({ id: m.profile.id, name: m.profile.display_name, role: m.role }));
      return { id: data.id, name: data.name, members, myRole: members.find((m) => m.id === userId)?.role ?? null };
    },
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.from('groups').insert({ name: name.trim() }).select('id').single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groupKeys.all }),
  });
}

/** Lettres et chiffres sans ambiguïté (pas de O/0 ni de I/1), comme le vérifie la base. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

/** Code d'invitation encore valable le plus récent (administrateurs seulement). */
export function useInvitation(groupId: string, enabled: boolean) {
  return useQuery({
    queryKey: groupKeys.invitation(groupId),
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invitations')
        .select('code, expires_at')
        .eq('group_id', groupId)
        .gt('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateInvitation(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // Un code déjà pris (très rare) : on en tire un autre.
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data, error } = await supabase.from('invitations').insert({ code: randomCode(), group_id: groupId }).select('code, expires_at').single();
        if (!error) return data;
        if (error.code !== '23505') throw error;
      }
      throw new Error("Impossible de créer un code d'invitation, réessaie.");
    },
    onSuccess: (data) => queryClient.setQueryData(groupKeys.invitation(groupId), data),
  });
}

export function useInvitationPreview(code: string) {
  return useQuery({
    queryKey: groupKeys.preview(code),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('invitation_preview', { invite_code: code });
      if (error) throw error;
      return data[0] ?? null;
    },
  });
}

export function useJoinGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc('join_group', { invite_code: code });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

/** Quitter un groupe, ou en retirer quelqu'un (administrateur). */
export function useRemoveMember(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

/** Lien à envoyer pour rejoindre un groupe. */
export function inviteLink(code: string): string {
  return `${window.location.origin}/rejoindre/${code}`;
}

/** Code tapé à la main (« k7p-2qx ») → forme enregistrée (« K7P2QX »). */
export function normalizeCode(code: string): string {
  return code.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 6);
}

/** « K7P2QX » → « K7P-2QX », plus facile à lire et à dicter. */
export function formatCode(code: string): string {
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}
