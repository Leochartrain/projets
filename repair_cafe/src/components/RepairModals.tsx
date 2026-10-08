import { useState, type FormEvent } from 'react';
import { OUTCOMES, OUTCOME_HINTS, OUTCOME_LABELS, categoryLabel, type Outcome, type Repair, type Visitor } from '@shared/domain';
import { api, errorText, useSave, useSettings, useUpdateRepair, useVisitors, useVolunteers } from '@/api';
import { hour, parseDecimal } from '@/format';
import { emptyObject, emptyVisitor, objectPayload, ObjectFields, VisitorFields, type ObjectDraft, type VisitorDraft } from './forms';
import { currentYear, emptyMembership, MembershipBadge, MembershipFields, membershipPayload, type MembershipDraft } from './membership';
import { Button, ErrorBox, Modal, SearchInput, SelectField, TextArea, TextField } from './ui';

/**
 * Nouvel objet à l'accueil : un rendez-vous sur un créneau, ou un passage sans rendez-vous.
 * On cherche d'abord le visiteur (il est peut-être déjà venu), sinon on le crée.
 */
export function NewRepairModal({ open, onClose, sessionId, slotTime }: { open: boolean; onClose: () => void; sessionId: number; slotTime: string | null }) {
  const [search, setSearch] = useState('');
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<VisitorDraft>(emptyVisitor);
  const [charter, setCharter] = useState(true);
  const [object, setObject] = useState<ObjectDraft>(emptyObject);
  const [membership, setMembership] = useState<MembershipDraft>(emptyMembership);
  // Commune d'un visiteur déjà connu qui n'en a pas encore (fiches d'avant l'adhésion).
  const [visitorCity, setVisitorCity] = useState('');
  const { data: visitors } = useVisitors(search);
  const { data: settings } = useSettings();
  const city = visitor ? (visitor.city ?? visitorCity) : draft.city;

  const save = useSave(async () => {
    const payload = membershipPayload(membership, city, settings);
    let visitorId = visitor?.id;
    if (visitorId === undefined) {
      visitorId = (await api.post<Visitor>('/visitors', { ...draft, charterAccepted: charter, membership: payload })).id;
    } else if (!visitor?.membership && payload) {
      if (!visitor?.city && visitorCity.trim()) await api.patch(`/visitors/${visitorId}`, { city: visitorCity });
      await api.post(`/visitors/${visitorId}/memberships`, payload);
    }
    return api.post<Repair>('/repairs', { ...objectPayload(object), visitorId, sessionId, slotTime });
  });

  function close() {
    setSearch('');
    setVisitor(null);
    setCreating(false);
    setDraft(emptyVisitor);
    setObject(emptyObject);
    setMembership(emptyMembership);
    setVisitorCity('');
    save.reset();
    onClose();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await save.mutateAsync(undefined);
    close();
  }

  const title = slotTime ? `Rendez-vous de ${hour(slotTime)}` : 'Passage sans rendez-vous';
  const hasVisitor = visitor || creating;

  return (
    <Modal open={open} onClose={close} title={title} wide>
      <form onSubmit={submit} className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <span className="label">Visiteur</span>
          {visitor ? (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-paper px-4 py-3">
              <div>
                <p className="font-medium">
                  {visitor.firstName} {visitor.lastName}
                </p>
                <p className="text-sm text-muted">{[visitor.phone, visitor.email, visitor.city].filter(Boolean).join(' · ') || 'Pas de coordonnées'}</p>
              </div>
              <div className="flex items-center gap-2">
                <MembershipBadge visitor={visitor} />
                <Button variant="ghost" size="sm" onClick={() => setVisitor(null)}>
                  Changer
                </Button>
              </div>
            </div>
          ) : creating ? (
            <div className="flex flex-col gap-4">
              <VisitorFields value={draft} onChange={setDraft} />
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5 size-4 accent-accent" checked={charter} onChange={(e) => setCharter(e.target.checked)} />
                La charte du Repair Café a été lue et acceptée.
              </label>
              <MembershipFields city={draft.city} value={membership} onChange={setMembership} />
              <Button variant="ghost" size="sm" className="self-start" onClick={() => setCreating(false)}>
                ← Chercher un visiteur existant
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <SearchInput value={search} onChange={setSearch} placeholder="Nom, téléphone ou e-mail" />
                <Button variant="secondary" onClick={() => setCreating(true)}>
                  Nouveau
                </Button>
              </div>
              {search.trim() && (
                <ul className="flex max-h-56 flex-col overflow-y-auto rounded-xl border border-line">
                  {(visitors ?? []).slice(0, 20).map((v) => (
                    <li key={v.id}>
                      <button type="button" onClick={() => setVisitor(v)} className="flex w-full items-center justify-between gap-3 border-b border-line px-4 py-2.5 text-left last:border-0 hover:bg-paper">
                        <span className="font-medium">
                          {v.firstName} {v.lastName}
                        </span>
                        <span className="text-sm text-muted">{v.phone ?? v.email ?? ''}</span>
                      </button>
                    </li>
                  ))}
                  {visitors?.length === 0 && (
                    <li className="px-4 py-3 text-sm text-muted">
                      Personne à ce nom.{' '}
                      <button
                        type="button"
                        className="font-medium text-accent underline"
                        onClick={() => {
                          const [first = '', ...rest] = search.trim().split(/\s+/);
                          setDraft({ ...emptyVisitor, firstName: first, lastName: rest.join(' ') });
                          setCreating(true);
                        }}
                      >
                        Créer la fiche
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}
        </section>

        {visitor && !visitor.membership && !visitor.anonymized && (
          <section className="flex flex-col gap-3">
            {!visitor.city && <TextField label="Commune du visiteur" hint="Elle fixe le tarif de l'adhésion." value={visitorCity} onChange={(e) => setVisitorCity(e.target.value)} />}
            <MembershipFields city={city} value={membership} onChange={setMembership} />
          </section>
        )}

        {hasVisitor && (
          <section className="flex flex-col gap-3">
            <span className="label">Objet apporté</span>
            <ObjectFields value={object} onChange={setObject} />
          </section>
        )}

        {save.error && <ErrorBox>{errorText(save.error)}</ErrorBox>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close}>
            Annuler
          </Button>
          <Button type="submit" disabled={!hasVisitor || save.isPending}>
            {slotTime ? 'Enregistrer le rendez-vous' : 'Ajouter à la file d’attente'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Choix du réparateur : ceux qui ont la compétence d'abord. */
function VolunteerSelect({ repair, value, onChange }: { repair: Repair; value: string; onChange: (value: string) => void }) {
  const { data: volunteers } = useVolunteers();
  const active = (volunteers ?? []).filter((v) => v.active || String(v.id) === value);
  const skilled = active.filter((v) => v.skills.includes(repair.category));
  const others = active.filter((v) => !v.skills.includes(repair.category));
  return (
    <SelectField label="Réparateur" required value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="" disabled>
        Choisir…
      </option>
      {skilled.length > 0 && (
        <optgroup label={categoryLabel(repair.category)}>
          {skilled.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </optgroup>
      )}
      <optgroup label={skilled.length ? 'Autres bénévoles' : 'Bénévoles'}>
        {others.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </optgroup>
    </SelectField>
  );
}

export function StartRepairModal({ repair, onClose }: { repair: Repair | null; onClose: () => void }) {
  return repair ? <StartRepair key={repair.id} repair={repair} onClose={onClose} /> : null;
}

/** Avant la réparation, on vérifie l'adhésion de l'année : sinon on l'encaisse ici. */
function StartRepair({ repair, onClose }: { repair: Repair; onClose: () => void }) {
  const [volunteerId, setVolunteerId] = useState(repair.volunteerId ? String(repair.volunteerId) : '');
  const [membership, setMembership] = useState<MembershipDraft>(emptyMembership);
  const [city, setCity] = useState(repair.visitorCity ?? '');
  const { data: settings } = useSettings();
  const update = useUpdateRepair();
  const pay = useSave(async () => {
    const payload = membershipPayload(membership, city, settings);
    if (!payload) return;
    if (!repair.visitorCity && city.trim()) await api.patch(`/visitors/${repair.visitorId}`, { city });
    await api.post(`/visitors/${repair.visitorId}/memberships`, payload);
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!repair.visitorIsMember) await pay.mutateAsync(undefined);
    await update.mutateAsync({ id: repair.id, status: 'in_progress', volunteerId: Number(volunteerId) });
    onClose();
  }

  const error = pay.error ?? update.error;

  return (
    <Modal open onClose={onClose} title={`Prendre en charge : ${repair.object}`} wide={!repair.visitorIsMember}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          {repair.visitorName} · {repair.problem}
        </p>
        <VolunteerSelect repair={repair} value={volunteerId} onChange={setVolunteerId} />
        {!repair.visitorIsMember && (
          <>
            <p className="rounded-lg bg-amber-soft px-4 py-3 text-sm text-amber">
              {repair.visitorName} n'a pas encore réglé son adhésion {currentYear()}, obligatoire pour faire réparer un objet.
            </p>
            {!repair.visitorCity && <TextField label="Commune du visiteur" value={city} onChange={(e) => setCity(e.target.value)} />}
            <MembershipFields city={city} value={membership} onChange={setMembership} />
          </>
        )}
        {error && <ErrorBox>{errorText(error)}</ErrorBox>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={update.isPending || pay.isPending || !volunteerId}>
            {repair.visitorIsMember || !membership.paid ? 'Commencer la réparation' : 'Encaisser et commencer'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Fin de réparation : résultat, diagnostic, poids et participation libre. */
export function FinishRepairModal({ repair, onClose }: { repair: Repair | null; onClose: () => void }) {
  return repair ? <FinishRepair key={repair.id} repair={repair} onClose={onClose} /> : null;
}

function FinishRepair({ repair, onClose }: { repair: Repair; onClose: () => void }) {
  const [outcome, setOutcome] = useState<Outcome | ''>(repair.outcome ?? '');
  const [diagnosis, setDiagnosis] = useState(repair.diagnosis ?? '');
  const [weight, setWeight] = useState(repair.weightKg?.toString().replace('.', ',') ?? '');
  const [donation, setDonation] = useState('');
  const [volunteerId, setVolunteerId] = useState(repair.volunteerId ? String(repair.volunteerId) : '');
  const update = useUpdateRepair();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const euros = parseDecimal(donation);
    await update.mutateAsync({
      id: repair.id,
      status: 'done',
      outcome: outcome || null,
      diagnosis,
      weightKg: parseDecimal(weight),
      donationCents: euros === null ? null : Math.round(euros * 100),
      volunteerId: volunteerId ? Number(volunteerId) : null,
    });
    onClose();
  }

  const close = onClose;

  return (
    <Modal open onClose={close} title={`Terminer : ${repair.object}`} wide>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-medium">Résultat</legend>
          {OUTCOMES.map((o) => (
            <label key={o} className={`flex cursor-pointer flex-col gap-0.5 rounded-xl border p-3 transition ${outcome === o ? 'border-accent bg-accent-soft/60' : 'border-line hover:border-field'}`}>
              <span className="flex items-center gap-2 font-medium">
                <input type="radio" name="outcome" required className="accent-accent" checked={outcome === o} onChange={() => setOutcome(o)} />
                {OUTCOME_LABELS[o]}
              </span>
              <span className="pl-5 text-xs text-muted">{OUTCOME_HINTS[o]}</span>
            </label>
          ))}
        </fieldset>
        <TextArea label="Diagnostic et réparation" placeholder="Ce qui était cassé, ce qui a été fait, la pièce à commander…" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-3">
          <VolunteerSelect repair={repair} value={volunteerId} onChange={setVolunteerId} />
          <TextField label="Poids (kg)" inputMode="decimal" placeholder="Estimé si vide" value={weight} onChange={(e) => setWeight(e.target.value)} />
          <TextField label="Participation (€)" inputMode="decimal" placeholder="0" value={donation} onChange={(e) => setDonation(e.target.value)} />
        </div>
        {update.error && <ErrorBox>{errorText(update.error)}</ErrorBox>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close}>
            Annuler
          </Button>
          <Button type="submit" disabled={update.isPending || !outcome}>
            Terminer
          </Button>
        </div>
      </form>
    </Modal>
  );
}
