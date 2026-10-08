import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { PAYMENT_LABELS, RATE_LABELS, categoryLabel, type Visitor, type VisitorDetail } from '@shared/domain';
import { api, errorText, useSave, useVisitor } from '@/api';
import { VisitorFields, type VisitorDraft } from '@/components/forms';
import { currentYear, MembershipBadge, PayMembershipModal } from '@/components/membership';
import { Button, Card, EmptyState, ErrorBox, PageHeader, RepairBadge, Spinner, TextArea } from '@/components/ui';
import { euros, shortDate } from '@/format';

export function VisitorPage() {
  const id = Number(useParams().id);
  const { data: visitor, isPending, error } = useVisitor(id);
  if (isPending) return <Spinner />;
  if (error) return <ErrorBox>{errorText(error)}</ErrorBox>;
  return <VisitorSheet key={`${visitor.id}-${visitor.anonymized}`} visitor={visitor} />;
}

function VisitorSheet({ visitor }: { visitor: VisitorDetail }) {
  const [draft, setDraft] = useState<VisitorDraft>({
    firstName: visitor.firstName,
    lastName: visitor.lastName,
    phone: visitor.phone ?? '',
    email: visitor.email ?? '',
    postalCode: visitor.postalCode ?? '',
    city: visitor.city ?? '',
  });
  const [paying, setPaying] = useState(false);
  const removeMembership = useSave((membershipId: number) => api.delete(`/memberships/${membershipId}`));
  const [notes, setNotes] = useState(visitor.notes ?? '');
  const [saved, setSaved] = useState(false);
  const [confirmErase, setConfirmErase] = useState(false);
  const save = useSave(() => api.patch<Visitor>(`/visitors/${visitor.id}`, { ...draft, notes }));
  const charter = useSave((accepted: boolean) => api.patch<Visitor>(`/visitors/${visitor.id}`, { charterAccepted: accepted }));
  const erase = useSave(() => api.delete(`/visitors/${visitor.id}`));

  async function submit(event: FormEvent) {
    event.preventDefault();
    await save.mutateAsync(undefined);
    setSaved(true);
  }

  return (
    <>
      <Link to="/visiteurs" className="text-sm text-muted hover:text-ink">
        ← Tous les visiteurs
      </Link>
      <PageHeader title={`${visitor.firstName} ${visitor.lastName}`} subtitle={`Fiche créée le ${shortDate(visitor.createdAt)}`} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="flex flex-col gap-6">
          {visitor.anonymized ? (
            <Card>
              <p className="text-muted">Les données personnelles de ce visiteur ont été effacées à sa demande. Ses réparations restent comptées dans les statistiques.</p>
            </Card>
          ) : (
            <Card>
              <form onSubmit={submit} onChange={() => setSaved(false)} className="flex flex-col gap-4">
                <VisitorFields value={draft} onChange={setDraft} />
                <TextArea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
                {save.error && <ErrorBox>{errorText(save.error)}</ErrorBox>}
                <div className="flex items-center justify-end gap-3">
                  {saved && <span className="text-sm text-accent">Enregistré.</span>}
                  <Button type="submit" disabled={save.isPending}>
                    Enregistrer
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {!visitor.anonymized && (
            <Card className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg">Adhésion</h2>
                <MembershipBadge visitor={visitor} />
              </div>
              {visitor.membership ? (
                <p className="text-sm">
                  {currentYear()} réglée le <strong>{shortDate(visitor.membership.paidAt)}</strong> : {euros(visitor.membership.amountCents)} ({RATE_LABELS[visitor.membership.rate].toLowerCase()}
                  {visitor.membership.paymentMethod && `, ${PAYMENT_LABELS[visitor.membership.paymentMethod].toLowerCase()}`}).
                </p>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-amber">Adhésion {currentYear()} pas encore réglée : obligatoire pour faire réparer un objet.</p>
                  <Button size="sm" onClick={() => setPaying(true)}>
                    Encaisser l'adhésion
                  </Button>
                </div>
              )}
              {visitor.memberships.length > 0 && (
                <ul className="flex flex-col divide-y divide-line text-sm">
                  {visitor.memberships.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2 py-2">
                      <span>
                        <strong>{m.year}</strong> · {euros(m.amountCents)} · {RATE_LABELS[m.rate]}
                        {m.paymentMethod && ` · ${PAYMENT_LABELS[m.paymentMethod]}`}
                      </span>
                      {m.year === currentYear() && (
                        <Button size="sm" variant="ghost" title="Annuler cette adhésion (erreur de saisie)" disabled={removeMembership.isPending} onClick={() => removeMembership.mutate(m.id)}>
                          Annuler
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {removeMembership.error && <ErrorBox>{errorText(removeMembership.error)}</ErrorBox>}
            </Card>
          )}

          {!visitor.anonymized && (
            <Card className="flex flex-col gap-3">
              <h2 className="text-lg">Charte et données personnelles</h2>
              {visitor.charterAcceptedAt ? (
                <p className="text-sm">
                  Charte acceptée le <strong>{shortDate(visitor.charterAcceptedAt)}</strong>.
                </p>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-amber">Charte pas encore signée : à faire signer à l'accueil.</p>
                  <Button size="sm" variant="secondary" onClick={() => charter.mutate(true)}>
                    Marquer comme signée
                  </Button>
                </div>
              )}
              <p className="text-sm text-muted">Le visiteur peut demander l'effacement de ses données : son nom et ses coordonnées sont supprimés, ses réparations restent dans les statistiques sans lien avec lui.</p>
              {erase.error && <ErrorBox>{errorText(erase.error)}</ErrorBox>}
              {confirmErase ? (
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setConfirmErase(false)}>
                    Annuler
                  </Button>
                  <Button variant="danger" disabled={erase.isPending} onClick={() => erase.mutate(undefined)}>
                    Effacer définitivement
                  </Button>
                </div>
              ) : (
                <Button variant="secondary" className="self-start" onClick={() => setConfirmErase(true)}>
                  Effacer ses données
                </Button>
              )}
            </Card>
          )}
        </div>

        <Card className="flex flex-col gap-4">
          <h2 className="text-lg">Objets apportés</h2>
          {visitor.repairs.length === 0 ? (
            <EmptyState title="Aucun objet pour l’instant" />
          ) : (
            <ul className="flex flex-col gap-2">
              {visitor.repairs.map((r) => (
                <li key={r.id}>
                  <Link to={`/reparations/${r.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 hover:border-field">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {r.object}
                        {r.brand && <span className="font-normal text-muted"> {r.brand}</span>}
                      </p>
                      <p className="text-sm text-muted">
                        {r.sessionDate ? shortDate(r.sessionDate) : 'Sans séance'} · {categoryLabel(r.category)}
                        {r.volunteerName && ` · avec ${r.volunteerName}`}
                      </p>
                    </div>
                    <RepairBadge status={r.status} outcome={r.outcome} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      {paying && <PayMembershipModal visitorId={visitor.id} visitorName={`${visitor.firstName} ${visitor.lastName}`} city={visitor.city} onClose={() => setPaying(false)} />}
    </>
  );
}
