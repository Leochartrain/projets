import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Screen } from '@/components/layout';
import { Button, EmptyState, ErrorBox, Spinner, TextField } from '@/components/ui';
import { errorMessage } from '@/lib/supabase';
import { normalizeCode, useCreateGroup, useMyGroups } from './api';

/** Mes groupes, en créer un, ou en rejoindre un avec un code. */
export function GroupsPage() {
  const navigate = useNavigate();
  const { data: groups, isPending, error } = useMyGroups();
  const createGroup = useCreateGroup();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    const id = await createGroup.mutateAsync(name);
    setName('');
    navigate(`/groupes/${id}`);
  }

  function join(event: FormEvent) {
    event.preventDefault();
    const clean = normalizeCode(code);
    if (clean.length === 6) navigate(`/rejoindre/${clean}`);
  }

  return (
    <Screen title="Groupes">
      {isPending && <Spinner />}
      {error && <ErrorBox>{errorMessage(error)}</ErrorBox>}
      {groups?.length === 0 && (
        <EmptyState title="Aucun groupe pour l'instant">Crée celui de ta famille, ou rejoins-en un avec le code qu'on t'a envoyé.</EmptyState>
      )}
      {groups && groups.length > 0 && (
        <ul className="flex flex-col gap-3">
          {groups.map((group) => (
            <li key={group.id}>
              <Link to={`/groupes/${group.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card p-4 transition hover:border-field">
                <span className="flex flex-col gap-1">
                  <span className="font-display text-lg font-bold">{group.name}</span>
                  <span className="text-sm text-muted">
                    {group.memberCount} membre{group.memberCount > 1 ? 's' : ''} · {group.recipeCount} recette{group.recipeCount > 1 ? 's' : ''}
                  </span>
                </span>
                {group.role === 'admin' && <span className="label">Admin</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={join} className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
        <h2 className="text-lg">Rejoindre un groupe</h2>
        <TextField label="Code reçu" value={code} onChange={(e) => setCode(e.target.value)} placeholder="K7P-2QX" autoCapitalize="characters" autoComplete="off" />
        <Button type="submit" variant="secondary" disabled={normalizeCode(code).length !== 6}>
          Rejoindre
        </Button>
      </form>

      <form onSubmit={create} className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
        <h2 className="text-lg">Créer un groupe</h2>
        <TextField label="Nom du groupe" value={name} onChange={(e) => setName(e.target.value)} placeholder="Famille Richard" maxLength={60} />
        {createGroup.error && <ErrorBox>{errorMessage(createGroup.error)}</ErrorBox>}
        <Button type="submit" disabled={!name.trim() || createGroup.isPending}>
          Créer le groupe
        </Button>
      </form>
    </Screen>
  );
}
