import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import type { Session } from '@shared/domain';
import { api, errorText, useSave, useSessions } from '@/api';
import { Button, Card, EmptyState, ErrorBox, Modal, PageHeader, Spinner, TextArea, TextField } from '@/components/ui';
import { hour, longDate, plural, todayIso } from '@/format';

export function SessionsPage() {
  const { data: sessions, isPending, error } = useSessions();
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const today = todayIso();
  const upcoming = (sessions ?? []).filter((s) => s.date >= today).reverse();
  const past = (sessions ?? []).filter((s) => s.date < today);

  return (
    <>
      <PageHeader title="Séances" subtitle="Les permanences du Repair Café : créneaux, rendez-vous et bilan." actions={<Button onClick={() => setCreating(true)}>Nouvelle séance</Button>} />
      {isPending && <Spinner />}
      {error && <ErrorBox>{errorText(error)}</ErrorBox>}

      {sessions && (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="label">À venir</h2>
            {upcoming.length === 0 ? (
              <EmptyState title="Aucune séance prévue">Crée la prochaine séance pour ouvrir les réservations en ligne.</EmptyState>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {upcoming.map((s) => (
                  <SessionCard key={s.id} session={s} today={s.date === today} />
                ))}
              </div>
            )}
          </section>

          {past.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="label">Passées</h2>
              <Card className="p-0">
                <ul>
                  {past.map((s) => (
                    <li key={s.id} className="border-b border-line last:border-0">
                      <Link to={`/seances/${s.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-paper">
                        <span className="font-medium first-letter:uppercase">{longDate(s.date)}</span>
                        <span className="text-sm text-muted">
                          {plural(s.done, 'objet traité', 'objets traités')} · {s.place}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )}
        </>
      )}

      {creating && <SessionFormModal open onClose={() => setCreating(false)} onSaved={(s) => navigate(`/seances/${s.id}`)} defaults={sessions?.[0]} />}
    </>
  );
}

function SessionCard({ session, today }: { session: Session; today: boolean }) {
  const fill = session.capacity ? Math.min(100, Math.round((session.booked / session.capacity) * 100)) : 0;
  return (
    <Link to={`/seances/${session.id}`} className={`flex flex-col gap-3 rounded-2xl border bg-card p-5 transition hover:border-accent ${today ? 'border-accent ring-2 ring-accent/15' : 'border-line'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="label">{today ? "Aujourd'hui" : `${hour(session.startTime)} – ${hour(session.endTime)}`}</span>
        {today && <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-white">En cours</span>}
      </div>
      <p className="font-display text-xl font-bold first-letter:uppercase">{longDate(session.date)}</p>
      <p className="text-sm text-muted">{session.place}</p>
      <div className="flex flex-col gap-1.5">
        <div className="h-2 overflow-hidden rounded-full bg-grey-soft">
          <div className="h-full rounded-full bg-accent" style={{ width: `${fill}%` }} />
        </div>
        <span className="text-sm">
          {session.booked} / {session.capacity} places réservées
        </span>
      </div>
    </Link>
  );
}

/** Prochain samedi : les Repair Cafés ont souvent lieu le week-end. */
function nextSaturday(): string {
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  return d.toLocaleDateString('sv-SE');
}

export function SessionFormModal({ open, onClose, onSaved, session, defaults }: { open: boolean; onClose: () => void; onSaved?: (s: Session) => void; session?: Session; defaults?: Session }) {
  const base = session ?? defaults;
  const [form, setForm] = useState({
    date: session?.date ?? nextSaturday(),
    startTime: base?.startTime ?? '14:00',
    endTime: base?.endTime ?? '18:00',
    place: base?.place ?? '',
    slotMinutes: String(base?.slotMinutes ?? 30),
    perSlot: String(base?.perSlot ?? 3),
    notes: session?.notes ?? '',
  });
  const set = (patch: Partial<typeof form>) => setForm({ ...form, ...patch });
  const save = useSave(() => {
    const body = { ...form, slotMinutes: Number(form.slotMinutes), perSlot: Number(form.perSlot) };
    return session ? api.patch<Session>(`/sessions/${session.id}`, body) : api.post<Session>('/sessions', body);
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    const saved = await save.mutateAsync(undefined);
    onClose();
    onSaved?.(saved);
  }

  return (
    <Modal open={open} onClose={onClose} title={session ? 'Modifier la séance' : 'Nouvelle séance'}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <TextField label="Date" type="date" required value={form.date} onChange={(e) => set({ date: e.target.value })} />
        </div>
        <TextField label="Ouverture" type="time" required value={form.startTime} onChange={(e) => set({ startTime: e.target.value })} />
        <TextField label="Fermeture" type="time" required value={form.endTime} onChange={(e) => set({ endTime: e.target.value })} />
        <div className="sm:col-span-2">
          <TextField label="Lieu" required placeholder="Maison de quartier, 12 rue des Lilas" value={form.place} onChange={(e) => set({ place: e.target.value })} />
        </div>
        <TextField label="Durée d'un créneau (min)" type="number" min={10} max={240} step={5} required value={form.slotMinutes} onChange={(e) => set({ slotMinutes: e.target.value })} />
        <TextField label="Rendez-vous par créneau" type="number" min={1} max={50} required hint="En gros, le nombre de réparateurs présents." value={form.perSlot} onChange={(e) => set({ perSlot: e.target.value })} />
        <div className="sm:col-span-2">
          <TextArea label="Notes pour l'équipe" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
        </div>
        {save.error && (
          <div className="sm:col-span-2">
            <ErrorBox>{errorText(save.error)}</ErrorBox>
          </div>
        )}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={save.isPending}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Modal>
  );
}
