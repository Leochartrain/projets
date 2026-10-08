import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { MIN_PASSWORD, type Me, type TeamUser } from '@shared/domain';
import { api, errorText, meKey, useMe } from '@/api';
import { Button, ErrorBox, Spinner, TextField } from '@/components/ui';

/** Connexion de l'équipe ; sur une base toute neuve, création du premier compte (administrateur). */
export function LoginPage() {
  const { data: me, isPending } = useMe();
  const [params] = useSearchParams();
  const next = params.get('suite')?.startsWith('/') ? params.get('suite')! : '/';

  if (isPending) return <Spinner />;
  if (me?.user) return <Navigate to={next} replace />;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <img src="/icon.svg" alt="" className="size-14" />
          <div>
            <h1 className="text-2xl">Repair Café</h1>
            <p className="text-muted">{me?.needsSetup ? 'Première connexion : crée le compte administrateur.' : "Espace de l'équipe"}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-card p-6 shadow-sm">{me?.needsSetup ? <SetupForm next={next} /> : <LoginForm next={next} />}</div>
        <a href="/reserver" className="text-center text-sm text-muted hover:text-ink">
          Tu veux faire réparer un objet ? Prends rendez-vous ici.
        </a>
      </div>
    </main>
  );
}

function useSignedIn(next: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return (user: TeamUser) => {
    // Rien de l'éventuelle session précédente ne doit rester en cache.
    queryClient.clear();
    queryClient.setQueryData<Me>(meKey, { user, needsSetup: false });
    navigate(next, { replace: true });
  };
}

function LoginForm({ next }: { next: string }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const signedIn = useSignedIn(next);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      signedIn(await api.post<TeamUser>('/auth/login', { username, password }));
    } catch (e) {
      setError(e);
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <TextField label="Identifiant" required autoFocus autoComplete="username" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} />
      <TextField label="Mot de passe" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error !== null && <ErrorBox>{errorText(error)}</ErrorBox>}
      <Button type="submit" className="h-11" disabled={pending}>
        Se connecter
      </Button>
      <p className="text-center text-xs text-muted">Mot de passe oublié ? Un administrateur peut le réinitialiser dans Réglages.</p>
    </form>
  );
}

function SetupForm({ next }: { next: string }) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const signedIn = useSignedIn(next);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      signedIn(await api.post<TeamUser>('/auth/setup', { name, username, password }));
    } catch (e) {
      setError(e);
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <TextField label="Ton nom" required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      <TextField label="Identifiant" required autoComplete="username" autoCapitalize="none" hint="Sans espace, par exemple « marie.d »." value={username} onChange={(e) => setUsername(e.target.value)} />
      <TextField label="Mot de passe" type="password" required minLength={MIN_PASSWORD} autoComplete="new-password" hint={`Au moins ${MIN_PASSWORD} caractères.`} value={password} onChange={(e) => setPassword(e.target.value)} />
      {error !== null && <ErrorBox>{errorText(error)}</ErrorBox>}
      <Button type="submit" className="h-11" disabled={pending}>
        Créer le compte
      </Button>
    </form>
  );
}
