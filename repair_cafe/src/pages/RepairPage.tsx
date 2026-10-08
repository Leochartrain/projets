import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { OUTCOMES, OUTCOME_LABELS, STATUSES, STATUS_LABELS, categoryLabel, type Outcome, type Repair, type Status } from '@shared/domain';
import { errorText, useRepair, useUpdateRepair, useVolunteers } from '@/api';
import { objectPayload, ObjectFields, type ObjectDraft } from '@/components/forms';
import { Button, Card, ErrorBox, PageHeader, RepairBadge, SelectField, Spinner, TextArea, TextField } from '@/components/ui';
import { clock, euros, hour, parseDecimal, shortDate } from '@/format';

export function RepairPage() {
  const id = Number(useParams().id);
  const { data: repair, isPending, error } = useRepair(id);
  if (isPending) return <Spinner />;
  if (error) return <ErrorBox>{errorText(error)}</ErrorBox>;
  return <RepairSheet key={repair.id} repair={repair} />;
}

function toDraft(r: Repair): ObjectDraft {
  return {
    category: r.category,
    object: r.object,
    brand: r.brand ?? '',
    model: r.model ?? '',
    ageYears: r.ageYears?.toString() ?? '',
    problem: r.problem,
    weightKg: r.weightKg?.toString().replace('.', ',') ?? '',
  };
}

function RepairSheet({ repair }: { repair: Repair }) {
  const { data: volunteers } = useVolunteers();
  const update = useUpdateRepair();
  const [object, setObject] = useState(() => toDraft(repair));
  const [status, setStatus] = useState<Status>(repair.status);
  const [outcome, setOutcome] = useState<Outcome | ''>(repair.outcome ?? '');
  const [volunteerId, setVolunteerId] = useState(repair.volunteerId?.toString() ?? '');
  const [diagnosis, setDiagnosis] = useState(repair.diagnosis ?? '');
  const [notes, setNotes] = useState(repair.notes ?? '');
  const [donation, setDonation] = useState(repair.donationCents === null ? '' : (repair.donationCents / 100).toString().replace('.', ','));
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const donationEuros = parseDecimal(donation);
    await update.mutateAsync({
      id: repair.id,
      ...objectPayload(object),
      category: object.category || repair.category,
      status,
      outcome: outcome || null,
      volunteerId: volunteerId ? Number(volunteerId) : null,
      diagnosis,
      notes,
      donationCents: donationEuros === null ? null : Math.round(donationEuros * 100),
    } as Partial<Repair> & { id: number });
    setSaved(true);
  }

  const timeline = [
    repair.slotTime && repair.sessionDate ? `Rendez-vous le ${shortDate(repair.sessionDate)} à ${hour(repair.slotTime)}` : repair.sessionDate ? `Passage sans rendez-vous le ${shortDate(repair.sessionDate)}` : null,
    repair.arrivedAt && `Arrivé à ${clock(repair.arrivedAt)}`,
    repair.startedAt && `Pris en charge à ${clock(repair.startedAt)}`,
    repair.endedAt && `Terminé à ${clock(repair.endedAt)}`,
  ].filter(Boolean);

  return (
    <>
      <Link to={repair.sessionId ? `/seances/${repair.sessionId}` : '/reparations'} className="text-sm text-muted hover:text-ink">
        ← {repair.sessionId ? 'Retour à la séance' : 'Toutes les réparations'}
      </Link>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {repair.object}
            <RepairBadge status={repair.status} outcome={repair.outcome} />
          </span>
        }
        subtitle={
          <>
            Fiche n° {repair.id} · {categoryLabel(repair.category)} · apporté par{' '}
            <Link to={`/visiteurs/${repair.visitorId}`} className="font-medium text-ink underline">
              {repair.visitorName}
            </Link>
            {repair.visitorPhone && ` (${repair.visitorPhone})`}
          </>
        }
      />
      {timeline.length > 0 && <p className="text-sm text-muted">{timeline.join(' → ')}</p>}

      <form onSubmit={submit} onChange={() => setSaved(false)} className="grid items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Card className="flex flex-col gap-4">
          <h2 className="text-lg">L'objet</h2>
          <ObjectFields value={object} onChange={setObject} />
        </Card>

        <Card className="flex flex-col gap-4">
          <h2 className="text-lg">La réparation</h2>
          <SelectField label="Étape" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </SelectField>
          <SelectField label="Réparateur" value={volunteerId} onChange={(e) => setVolunteerId(e.target.value)}>
            <option value="">—</option>
            {(volunteers ?? [])
              .filter((v) => v.active || String(v.id) === volunteerId)
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
          </SelectField>
          <SelectField label="Résultat" required={status === 'done'} value={outcome} onChange={(e) => setOutcome(e.target.value as Outcome | '')}>
            <option value="">—</option>
            {OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {OUTCOME_LABELS[o]}
              </option>
            ))}
          </SelectField>
          <TextArea label="Diagnostic et réparation" rows={4} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
          <TextArea label="Notes internes" rows={2} placeholder="Pièce commandée, rappeler le visiteur…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <TextField
            label="Participation libre (€)"
            inputMode="decimal"
            hint={repair.donationCents ? `Enregistré : ${euros(repair.donationCents)}` : undefined}
            value={donation}
            onChange={(e) => setDonation(e.target.value)}
          />
        </Card>

        <div className="flex flex-wrap items-center justify-end gap-3 lg:col-span-2">
          {update.error && <ErrorBox>{errorText(update.error)}</ErrorBox>}
          {saved && !update.error && <span className="text-sm text-accent">Fiche enregistrée.</span>}
          <Button type="submit" disabled={update.isPending}>
            Enregistrer la fiche
          </Button>
        </div>
      </form>
    </>
  );
}
