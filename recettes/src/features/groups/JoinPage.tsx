import { useNavigate, useParams } from 'react-router';
import { Screen } from '@/components/layout';
import { Button, ButtonLink, ErrorBox, Spinner } from '@/components/ui';
import { errorMessage } from '@/lib/supabase';
import { formatCode, normalizeCode, useInvitationPreview, useJoinGroup } from './api';

/** Arrivée par un lien d'invitation : « Rejoindre Famille Richard ? ». */
export function JoinPage() {
  const { code: raw = '' } = useParams();
  const code = normalizeCode(raw);
  const navigate = useNavigate();
  const { data: preview, isPending, error } = useInvitationPreview(code);
  const join = useJoinGroup();

  async function accept() {
    const groupId = await join.mutateAsync(code);
    navigate(`/groupes/${groupId}`, { replace: true });
  }

  return (
    <Screen title="Invitation" back="/groupes">
      {isPending && <Spinner />}
      {error && <ErrorBox>{errorMessage(error)}</ErrorBox>}
      {!isPending && !error && !preview && (
        <div className="flex flex-col gap-4">
          <ErrorBox>Le code {formatCode(code)} n'existe pas ou a expiré. Demande un nouveau lien à la personne qui t'a invité.</ErrorBox>
          <ButtonLink to="/groupes" variant="secondary">
            Voir mes groupes
          </ButtonLink>
        </div>
      )}
      {preview && (
        <div className="flex flex-col gap-5 rounded-3xl bg-accent p-6 text-accent-ink">
          <span className="font-mono text-xs uppercase tracking-[0.08em] opacity-80">Tu es invité à rejoindre</span>
          <h2 className="text-3xl">{preview.group_name}</h2>
          <p className="opacity-90">
            {preview.member_count} membre{preview.member_count > 1 ? 's' : ''} partagent déjà leurs recettes ici. Tes recettes restent privées tant que tu ne les partages pas.
          </p>
          {join.error && <ErrorBox>{errorMessage(join.error)}</ErrorBox>}
          <Button onClick={accept} disabled={join.isPending} className="bg-accent-ink text-accent">
            Rejoindre le groupe
          </Button>
        </div>
      )}
    </Screen>
  );
}
