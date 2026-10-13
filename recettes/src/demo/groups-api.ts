// Remplace features/groups/api en mode visite : mêmes hooks, données de demo/store.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatCode, groupKeys, inviteLink, normalizeCode, randomCode, type GroupDetail, type GroupSummary } from '@/features/groups/api';
import { db, fail, ME, myGroupIds, profileName, wait } from './store';

export { formatCode, groupKeys, inviteLink, normalizeCode, randomCode };
export type { GroupDetail, GroupSummary };

export function useMyGroups() {
  return useQuery({
    queryKey: groupKeys.all,
    queryFn: async (): Promise<GroupSummary[]> => {
      await wait();
      return db.members
        .filter((m) => m.userId === ME)
        .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
        .flatMap((m) =>
          db.groups
            .filter((g) => g.id === m.groupId)
            .map((g) => ({
              id: g.id,
              name: g.name,
              role: m.role,
              memberCount: db.members.filter((x) => x.groupId === g.id).length,
              recipeCount: db.shares.filter((s) => s.groupId === g.id).length,
            })),
        );
    },
  });
}

export function useGroup(id: string) {
  return useQuery({
    queryKey: groupKeys.detail(id),
    queryFn: async (): Promise<GroupDetail> => {
      await wait();
      const group = (myGroupIds().has(id) && db.groups.find((g) => g.id === id)) || fail('Ce groupe est introuvable.');
      const members = db.members
        .filter((m) => m.groupId === id)
        .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
        .map((m) => ({ id: m.userId, name: profileName(m.userId), role: m.role }));
      return { id: group.id, name: group.name, members, myRole: members.find((m) => m.id === ME)?.role ?? null };
    },
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      await wait();
      const id = crypto.randomUUID();
      db.groups.push({ id, name: name.trim() });
      db.members.push({ groupId: id, userId: ME, role: 'admin', joinedAt: new Date().toISOString() });
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groupKeys.all }),
  });
}

function currentInvitation(groupId: string) {
  const now = new Date().toISOString();
  const valid = db.invitations.filter((x) => x.groupId === groupId && x.expiresAt > now).sort((a, b) => b.expiresAt.localeCompare(a.expiresAt));
  return valid[0] ? { code: valid[0].code, expires_at: valid[0].expiresAt } : null;
}

export function useInvitation(groupId: string, enabled: boolean) {
  return useQuery({
    queryKey: groupKeys.invitation(groupId),
    enabled,
    queryFn: async () => {
      await wait();
      return currentInvitation(groupId);
    },
  });
}

export function useCreateInvitation(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await wait();
      db.invitations.push({ code: randomCode(), groupId, expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString() });
      return currentInvitation(groupId)!;
    },
    onSuccess: (data) => queryClient.setQueryData(groupKeys.invitation(groupId), data),
  });
}

/** Le groupe de démonstration qu'on peut rejoindre avec n'importe quel code inconnu. */
const DEMO_JOIN = { id: 'voisins', name: 'Les voisins du 3e' };

function findInvitation(code: string) {
  const now = new Date().toISOString();
  const invitation = db.invitations.find((x) => x.code === code && x.expiresAt > now);
  if (invitation) return db.groups.find((g) => g.id === invitation.groupId) ?? null;
  return code.length === 6 ? DEMO_JOIN : null;
}

export function useInvitationPreview(code: string) {
  return useQuery({
    queryKey: groupKeys.preview(code),
    queryFn: async () => {
      await wait();
      const group = findInvitation(code);
      if (!group) return null;
      const known = db.members.filter((m) => m.groupId === group.id).length;
      return { group_id: group.id, group_name: group.name, member_count: known || 3 };
    },
  });
}

export function useJoinGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      await wait();
      const group = findInvitation(code) ?? fail('Ce code n\'existe pas ou a expiré.');
      if (!db.groups.some((g) => g.id === group.id)) db.groups.push({ ...group });
      if (!db.members.some((m) => m.groupId === group.id && m.userId === ME)) {
        db.members.push({ groupId: group.id, userId: ME, role: 'member', joinedAt: new Date().toISOString() });
      }
      return group.id;
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function useRemoveMember(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      await wait();
      db.members = db.members.filter((m) => !(m.groupId === groupId && m.userId === userId));
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
