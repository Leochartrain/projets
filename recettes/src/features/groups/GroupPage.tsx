import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/layout';
import { Avatar, Button, EmptyState, ErrorBox, Spinner } from '@/components/ui';
import { useUserId } from '@/features/auth/AuthProvider';
import { RecipeList } from '@/features/recipes/RecipeList';
import { errorMessage } from '@/lib/supabase';
import { formatCode, inviteLink, useCreateInvitation, useGroup, useInvitation, useRemoveMember } from './api';

/** Page d'un groupe : membres, code d'invitation (administrateurs) et recettes partagées. */
export function GroupPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const userId = useUserId();
  const { data: group, isPending, error } = useGroup(id);
  const isAdmin = group?.myRole === 'admin';
  const removeMember = useRemoveMember(id);
  const [confirmLeave, setConfirmLeave] = useState(false);

  if (isPending) return <Spinner />;
  if (error) return <Screen back="/groupes"><ErrorBox>{errorMessage(error)}</ErrorBox></Screen>;

  const admins = group.members.filter((m) => m.role === 'admin');
  // Le dernier administrateur ne peut pas partir sans en nommer un autre (sinon plus personne ne peut inviter).
  const lastAdmin = isAdmin && admins.length === 1 && group.members.length > 1;

  async function leave() {
    await removeMember.mutateAsync(userId);
    navigate('/groupes', { replace: true });
  }

  return (
    <Screen title={group.name} back="/groupes">
      <section className="flex flex-col gap-3">
        <span className="label">
          {group.members.length} membre{group.members.length > 1 ? 's' : ''}
        </span>
        <ul className="flex flex-wrap gap-3">
          {group.members.map((member) => (
            <li key={member.id} className="flex items-center gap-2 rounded-full border border-line bg-card py-1 pl-1 pr-4">
              <Avatar name={member.name} size={32} />
              <span className="font-display font-medium">{member.id === userId ? 'Toi' : member.name}</span>
              {member.role === 'admin' && <span className="font-mono text-[10px] uppercase text-muted">admin</span>}
            </li>
          ))}
        </ul>
      </section>

      {isAdmin && <InviteCard groupId={group.id} groupName={group.name} />}

      <section className="flex flex-col gap-3">
        <span className="label">Recettes du groupe</span>
        <RecipeList filter={{ kind: 'group', groupId: group.id }} empty={<EmptyState title="Pas encore de recettes">Partage une recette avec ce groupe depuis son écran de modification.</EmptyState>} />
      </section>

      <section className="flex flex-col gap-3 border-t border-line pt-5">
        {lastAdmin ? (
          <p className="text-sm text-muted">Tu es le seul administrateur : tu ne peux pas quitter le groupe tant qu'il a d'autres membres.</p>
        ) : confirmLeave ? (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => setConfirmLeave(false)}>
              Rester
            </Button>
            <Button variant="danger" onClick={leave} disabled={removeMember.isPending}>
              Quitter
            </Button>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setConfirmLeave(true)}>
            Quitter le groupe
          </Button>
        )}
      </section>
    </Screen>
  );
}

/** Code et lien d'invitation, valables 7 jours, à copier ou à partager (WhatsApp, SMS…). */
function InviteCard({ groupId, groupName }: { groupId: string; groupName: string }) {
  const { data: invitation, isPending } = useInvitation(groupId, true);
  const create = useCreateInvitation(groupId);
  const [copied, setCopied] = useState(false);

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(inviteLink(code));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function share(code: string) {
    const text = `Rejoins « ${groupName} » sur Carnet de famille pour partager nos recettes : ${inviteLink(code)}`;
    if (navigator.share) await navigator.share({ title: groupName, text }).catch(() => undefined);
    else await copy(code);
  }

  const daysLeft = invitation ? Math.max(1, Math.ceil((new Date(invitation.expires_at).getTime() - Date.now()) / 86_400_000)) : 0;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <h2 className="text-lg">Inviter quelqu'un</h2>
      {isPending ? (
        <Spinner />
      ) : invitation ? (
        <>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-paper px-4 py-3">
            <span className="font-mono text-2xl tracking-[0.18em]">{formatCode(invitation.code)}</span>
            <span className="font-mono text-xs text-muted">
              valable {daysLeft} jour{daysLeft > 1 ? 's' : ''}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => copy(invitation.code)}>
              <Icon name={copied ? 'check' : 'copy'} size={18} />
              {copied ? 'Copié !' : 'Copier'}
            </Button>
            <Button onClick={() => share(invitation.code)}>
              <Icon name="share" size={18} />
              Partager
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-muted">Crée un code à envoyer à ta famille ou à tes amis. Il reste valable 7 jours.</p>
          {create.error && <ErrorBox>{errorMessage(create.error)}</ErrorBox>}
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            Créer un code d'invitation
          </Button>
        </>
      )}
    </section>
  );
}
