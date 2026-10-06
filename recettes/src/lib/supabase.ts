import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Faux tant que .env.local n'est pas rempli (l'appli affiche alors comment faire). */
export const isConfigured = Boolean(url && anonKey);

export const supabase = createClient<Database>(url ?? 'http://localhost', anonKey ?? 'non-configure', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const googleEnabled = import.meta.env.VITE_AUTH_GOOGLE === '1';

/** Les erreurs de Supabase et de Postgres, en un message lisible. */
export function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    const message = error.message;
    if (message.includes('Invalid login credentials')) return 'E-mail ou mot de passe incorrect.';
    if (message.includes('User already registered')) return 'Un compte existe déjà avec cet e-mail : connecte-toi.';
    if (message.includes('Password should be')) return 'Le mot de passe doit faire au moins 6 caractères.';
    if (message.includes('rate limit')) return 'Trop de tentatives : réessaie dans quelques minutes.';
    if (message.includes('Failed to fetch')) return 'Pas de connexion au serveur. Vérifie ton accès à Internet.';
    return message;
  }
  return "Une erreur inattendue s'est produite.";
}
