import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, type ReactNode } from 'react';
import { ME, MY_EMAIL } from './store';

// Remplace features/auth/AuthProvider en mode visite : on est toujours connecté, sans compte.

interface AuthState {
  session: Session | null;
  loading: boolean;
}

const session = { user: { id: ME, email: MY_EMAIL } } as unknown as Session;
const AuthContext = createContext<AuthState>({ session, loading: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <AuthContext value={{ session, loading: false }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center">
        <span className="rounded-b-lg bg-ink/80 px-3 py-1 font-mono text-[11px] text-paper">Mode visite · rien n'est enregistré</span>
      </div>
    </AuthContext>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

export function useUserId(): string {
  return ME;
}
