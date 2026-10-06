import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

interface AuthState {
  session: Session | null;
  /** Vrai tant qu'on ne sait pas encore si l'utilisateur est connecté. */
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ session: null, loading: true });

/** Garde la session Supabase à jour (connexion, déconnexion, renouvellement du jeton). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true });
  const queryClient = useQueryClient();

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setState({ session: data.session, loading: false }));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setState({ session, loading: false });
      // Changement d'utilisateur : on oublie les données de l'ancien.
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') queryClient.clear();
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  return <AuthContext value={state}>{children}</AuthContext>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

/** Identifiant de l'utilisateur connecté (les écrans qui l'appellent sont protégés par RequireAuth). */
export function useUserId(): string {
  const { session } = useAuth();
  if (!session) throw new Error('Utilisateur non connecté');
  return session.user.id;
}
