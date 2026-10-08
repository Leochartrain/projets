import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import type { PublicSession, Repair, Session, SessionDetail, Stats, Visitor, VisitorDetail, Volunteer } from '@shared/domain';

export class ApiError extends Error {}

async function request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: init?.method ?? 'GET',
      headers: init?.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError('Le serveur ne répond pas. Vérifie qu’il est bien lancé.');
  }
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(data?.error ?? `Erreur ${response.status}`);
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: (path: string) => request<void>(path, { method: 'DELETE' }),
};

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Une erreur inattendue s’est produite.';
}

// Lectures

export const useStats = () => useQuery({ queryKey: ['stats'], queryFn: () => api.get<Stats>('/stats') });
export const useSessions = () => useQuery({ queryKey: ['sessions'], queryFn: () => api.get<Session[]>('/sessions') });
export const useSession = (id: number) =>
  // La séance du jour bouge vite (plusieurs postes d'accueil) : on la relit toutes les 15 s.
  useQuery({ queryKey: ['sessions', id], queryFn: () => api.get<SessionDetail>(`/sessions/${id}`), refetchInterval: 15_000 });
export const useVisitors = (q: string) =>
  useQuery({ queryKey: ['visitors', q], queryFn: () => api.get<Visitor[]>(`/visitors?q=${encodeURIComponent(q)}`), placeholderData: keepPreviousData });
export const useVisitor = (id: number) => useQuery({ queryKey: ['visitors', 'detail', id], queryFn: () => api.get<VisitorDetail>(`/visitors/${id}`) });
export const useVolunteers = () => useQuery({ queryKey: ['volunteers'], queryFn: () => api.get<Volunteer[]>('/volunteers') });
export const useRepair = (id: number) => useQuery({ queryKey: ['repairs', id], queryFn: () => api.get<Repair>(`/repairs/${id}`) });
export const usePublicSessions = () => useQuery({ queryKey: ['public-sessions'], queryFn: () => api.get<PublicSession[]>('/public/sessions') });

export function useRepairs(filters: Record<string, string>) {
  const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
  return useQuery({ queryKey: ['repairs', 'list', params.toString()], queryFn: () => api.get<Repair[]>(`/repairs?${params}`), placeholderData: keepPreviousData });
}

/**
 * Une écriture. Tout est relu après coup : les écrans sont petits et liés entre eux
 * (une réparation terminée change la séance, le visiteur, le bénévole et les statistiques).
 */
export function useSave<TInput, TResult>(fn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => queryClient.invalidateQueries() });
}

export const useUpdateRepair = () => useSave(({ id, ...patch }: { id: number } & Partial<Repair>) => api.patch<Repair>(`/repairs/${id}`, patch));
