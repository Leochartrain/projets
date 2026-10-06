import { useState, type FormEvent } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { Button, ErrorBox, TextField } from '@/components/ui';
import { errorMessage, googleEnabled, supabase } from '@/lib/supabase';
import { useAuth } from './AuthProvider';

type Mode = 'login' | 'signup' | 'link';

/**
 * Connexion et inscription : e-mail et mot de passe, lien de connexion par
 * e-mail (sans mot de passe), ou Google si c'est activé. Un compte e-mail marche
 * aussi pour les utilisateurs d'iPhone ; « Se connecter avec Apple » viendra
 * avec l'App Store (il demande un compte développeur Apple).
 */
export function LoginPage() {
  const { session } = useAuth();
  const [params] = useSearchParams();
  const next = safeNext(params.get('suite'));
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (session) return <Navigate to={next} replace />;

  const redirectTo = `${window.location.origin}${next}`;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name.trim() }, emailRedirectTo: redirectTo },
        });
        if (error) throw error;
        // Si la confirmation par e-mail est activée, il n'y a pas encore de session.
        if (!data.session) setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
        if (error) throw error;
        setSent(true);
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (error) setError(errorMessage(error));
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-5 py-10">
      <div className="flex flex-col gap-2">
        <span className="label">Les recettes de famille, à l'abri</span>
        <h1 className="text-4xl">Carnet de famille</h1>
      </div>

      {sent ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-basil-soft p-5 text-basil">
          <p className="font-display text-lg font-bold">Regarde tes e-mails</p>
          <p>
            Un lien vient d'être envoyé à <strong>{email}</strong>. Ouvre-le sur cet appareil pour te connecter.
          </p>
          <Button variant="ghost" onClick={() => setSent(false)}>
            Revenir
          </Button>
        </div>
      ) : (
        <>
          <div role="tablist" className="grid grid-cols-2 gap-1 rounded-2xl bg-line/60 p-1">
            {(['login', 'signup'] as const).map((tab) => (
              <button
                key={tab}
                role="tab"
                type="button"
                aria-selected={mode === tab || (tab === 'login' && mode === 'link')}
                onClick={() => setMode(tab)}
                className={`h-11 rounded-xl font-display font-bold ${mode === tab || (tab === 'login' && mode === 'link') ? 'bg-card text-ink shadow-sm' : 'text-muted'}`}
              >
                {tab === 'login' ? 'Se connecter' : 'Créer un compte'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="flex flex-col gap-4">
            {mode === 'signup' && (
              <TextField label="Ton prénom" value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} autoComplete="given-name" placeholder="Bertrand" />
            )}
            <TextField label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" inputMode="email" />
            {mode !== 'link' && (
              <TextField
                label="Mot de passe"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                hint={mode === 'signup' ? '6 caractères au moins.' : undefined}
              />
            )}
            {error && <ErrorBox>{error}</ErrorBox>}
            <Button type="submit" disabled={busy}>
              {busy ? 'Un instant…' : mode === 'login' ? 'Se connecter' : mode === 'signup' ? 'Créer mon compte' : 'Recevoir un lien de connexion'}
            </Button>
            {mode !== 'signup' && (
              <Button variant="ghost" onClick={() => setMode(mode === 'link' ? 'login' : 'link')}>
                {mode === 'link' ? 'Utiliser un mot de passe' : 'Recevoir un lien par e-mail, sans mot de passe'}
              </Button>
            )}
          </form>

          {googleEnabled && (
            <div className="flex flex-col gap-3">
              <p className="text-center text-sm text-muted">ou</p>
              <Button variant="secondary" onClick={google}>
                Continuer avec Google
              </Button>
            </div>
          )}
        </>
      )}
    </main>
  );
}

/** Retour après connexion : seulement vers une page de l'appli (pas vers un autre site). */
function safeNext(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}
