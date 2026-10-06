import { useState, type FormEvent } from 'react';
import { Screen } from '@/components/layout';
import { Button, ErrorBox, TextField } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { errorMessage, supabase } from '@/lib/supabase';
import { useDeleteAccount, useProfile, useUpdateName } from './api';

export function ProfilePage() {
  const { session } = useAuth();
  const { data: profile } = useProfile();
  const updateName = useUpdateName();
  const deleteAccount = useDeleteAccount();
  const [name, setName] = useState<string | null>(null);
  const [confirm, setConfirm] = useState('');
  const [saved, setSaved] = useState(false);
  const currentName = name ?? profile?.display_name ?? '';

  async function saveName(event: FormEvent) {
    event.preventDefault();
    if (!currentName.trim()) return;
    await updateName.mutateAsync(currentName);
    setSaved(true);
  }

  return (
    <Screen title="Profil">
      <form onSubmit={saveName} className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
        <TextField
          label="Ton prénom, tel que les autres le voient"
          value={currentName}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          maxLength={40}
        />
        {updateName.error && <ErrorBox>{errorMessage(updateName.error)}</ErrorBox>}
        <Button type="submit" variant="secondary" disabled={updateName.isPending || !currentName.trim()}>
          {saved ? 'Enregistré' : 'Enregistrer'}
        </Button>
      </form>

      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
        <span className="label">Compte</span>
        <p className="break-all">{session?.user.email}</p>
        <Button variant="secondary" onClick={() => void supabase.auth.signOut()}>
          Se déconnecter
        </Button>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-danger/30 bg-danger-soft/40 p-4">
        <h2 className="text-lg">Supprimer mon compte</h2>
        <p className="text-sm">
          Tes recettes, leurs photos, tes avis et tes groupes dont tu es le seul membre seront supprimés définitivement. Tape <strong>SUPPRIMER</strong> pour confirmer.
        </p>
        <TextField label="Confirmation" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
        {deleteAccount.error && <ErrorBox>{errorMessage(deleteAccount.error)}</ErrorBox>}
        <Button variant="danger" disabled={confirm !== 'SUPPRIMER' || deleteAccount.isPending} onClick={() => deleteAccount.mutate()}>
          Supprimer définitivement
        </Button>
      </section>
    </Screen>
  );
}
