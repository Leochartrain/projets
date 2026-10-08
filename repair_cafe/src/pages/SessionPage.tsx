import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { categoryLabel, type Repair, type Status } from '@shared/domain';
import { api, errorText, useSave, useSession, useUpdateRepair } from '@/api';
import { FinishRepairModal, NewRepairModal, StartRepairModal } from '@/components/RepairModals';
import { Button, Card, ErrorBox, PageHeader, RepairBadge, Spinner, Stat } from '@/components/ui';
import { clock, hour, longDate, minutesSince, plural, todayIso } from '@/format';
import { SessionFormModal } from './SessionsPage';

/**
 * Le jour J : à gauche le planning des rendez-vous (on pointe les arrivées),
 * à droite l'atelier (file d'attente, réparations en cours, terminées).
 */
export function SessionPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const { data: session, isPending, error } = useSession(id);
  const update = useUpdateRepair();
  const remove = useSave(() => api.delete(`/sessions/${id}`));
  const [adding, setAdding] = useState<{ slot: string | null } | null>(null);
  const [starting, setStarting] = useState<Repair | null>(null);
  const [finishing, setFinishing] = useState<Repair | null>(null);
  const [editing, setEditing] = useState(false);

  if (isPending) return <Spinner />;
  if (error) return <ErrorBox>{errorText(error)}</ErrorBox>;

  const by = (...statuses: Status[]) => session.repairs.filter((r) => statuses.includes(r.status));
  const waiting = by('waiting').sort((a, b) => (a.arrivedAt ?? '').localeCompare(b.arrivedAt ?? ''));
  const inProgress = by('in_progress');
  const done = by('done').sort((a, b) => (b.endedAt ?? '').localeCompare(a.endedAt ?? ''));
  const absent = by('no_show', 'cancelled');
  const isToday = session.date === todayIso();
  const isPast = session.date < todayIso();
  const setStatus = (repair: Repair, status: Status) => update.mutate({ id: repair.id, status });

  return (
    <>
      <Link to="/seances" className="text-sm text-muted hover:text-ink">
        ← Toutes les séances
      </Link>
      <PageHeader
        title={<span className="first-letter:uppercase">{longDate(session.date)}</span>}
        subtitle={`${session.place} · ${hour(session.startTime)} – ${hour(session.endTime)}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Modifier
            </Button>
            {!isPast && <Button onClick={() => setAdding({ slot: null })}>Passage sans rendez-vous</Button>}
          </>
        }
      />
      {session.notes && <p className="rounded-xl bg-amber-soft px-4 py-3 text-sm text-amber">{session.notes}</p>}
      {update.error && <ErrorBox>{errorText(update.error)}</ErrorBox>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Rendez-vous" value={`${session.booked}/${session.capacity}`} detail={plural(by('booked').length, 'pas encore arrivé', 'pas encore arrivés')} />
        <Stat label="En attente" value={waiting.length} detail={waiting[0]?.arrivedAt ? `depuis ${minutesSince(waiting[0].arrivedAt)} min pour le premier` : 'personne'} />
        <Stat label="En réparation" value={inProgress.length} />
        <Stat label="Terminés" value={done.length} tone="accent" detail={plural(done.filter((r) => r.outcome === 'repaired').length, 'réparé', 'réparés')} />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Card className="flex flex-col gap-4">
          <h2 className="text-lg">Planning</h2>
          <ol className="flex flex-col">
            {session.slots.map((slot) => {
              const repairs = session.repairs.filter((r) => r.slotTime === slot && r.status !== 'cancelled' && r.status !== 'no_show');
              const free = session.perSlot - repairs.length;
              return (
                <li key={slot} className="flex gap-4 border-t border-line py-3 first:border-0 first:pt-0">
                  <div className="w-12 shrink-0 pt-0.5">
                    <p className="font-display font-bold tabular-nums">{hour(slot)}</p>
                    <p className="text-xs text-muted">
                      {repairs.length}/{session.perSlot}
                    </p>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    {repairs.map((r) => (
                      <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-paper px-3 py-2">
                        <RepairLabel repair={r} />
                        {r.status === 'booked' ? (
                          <div className="flex gap-1">
                            <Button size="sm" onClick={() => setStatus(r, 'waiting')}>
                              Arrivé
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setStatus(r, 'no_show')}>
                              Absent
                            </Button>
                          </div>
                        ) : (
                          <RepairBadge status={r.status} outcome={r.outcome} />
                        )}
                      </div>
                    ))}
                    {free > 0 && !isPast && (
                      <button type="button" onClick={() => setAdding({ slot })} className="self-start rounded-lg px-2 py-1 text-sm font-medium text-accent hover:bg-accent-soft">
                        + Rendez-vous ({plural(free, 'place libre', 'places libres')})
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>

        <div className="flex flex-col gap-4">
          <Column title="En attente" count={waiting.length} empty={isToday ? 'Personne n’attend. Les arrivées pointées au planning arrivent ici.' : 'Personne en attente.'}>
            {waiting.map((r) => (
              <WorkshopCard key={r.id} repair={r} meta={r.arrivedAt ? `Arrivé à ${clock(r.arrivedAt)} · attend depuis ${minutesSince(r.arrivedAt)} min` : null}>
                <Button size="sm" onClick={() => setStarting(r)}>
                  Prendre en charge
                </Button>
              </WorkshopCard>
            ))}
          </Column>
          <Column title="En réparation" count={inProgress.length} empty="Aucune réparation en cours.">
            {inProgress.map((r) => (
              <WorkshopCard key={r.id} repair={r} meta={`${r.volunteerName ?? 'Réparateur ?'}${r.startedAt ? ` · depuis ${clock(r.startedAt)}` : ''}`}>
                <Button size="sm" onClick={() => setFinishing(r)}>
                  Terminer
                </Button>
              </WorkshopCard>
            ))}
          </Column>
          <Column title="Terminés" count={done.length} empty="Rien de terminé pour l’instant.">
            {done.map((r) => (
              <WorkshopCard key={r.id} repair={r} meta={r.volunteerName}>
                <RepairBadge status={r.status} outcome={r.outcome} />
              </WorkshopCard>
            ))}
          </Column>
          {absent.length > 0 && (
            <details className="rounded-2xl border border-line bg-card px-5 py-3">
              <summary className="cursor-pointer text-sm font-medium text-muted">{plural(absent.length, 'absent ou annulé', 'absents ou annulés')}</summary>
              <ul className="mt-3 flex flex-col gap-2">
                {absent.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                    <RepairLabel repair={r} />
                    <div className="flex items-center gap-2">
                      <RepairBadge status={r.status} outcome={r.outcome} />
                      {!isPast && (
                        <Button size="sm" variant="ghost" onClick={() => setStatus(r, 'waiting')}>
                          Finalement arrivé
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>

      {session.booked === 0 && (
        <div className="flex flex-col items-start gap-2 border-t border-line pt-5">
          {remove.error && <ErrorBox>{errorText(remove.error)}</ErrorBox>}
          <Button variant="ghost" onClick={() => remove.mutateAsync(undefined).then(() => navigate('/seances'))}>
            Supprimer cette séance
          </Button>
        </div>
      )}

      <NewRepairModal open={adding !== null} onClose={() => setAdding(null)} sessionId={session.id} slotTime={adding?.slot ?? null} />
      <StartRepairModal repair={starting} onClose={() => setStarting(null)} />
      <FinishRepairModal repair={finishing} onClose={() => setFinishing(null)} />
      {editing && <SessionFormModal open onClose={() => setEditing(false)} session={session} />}
    </>
  );
}

function RepairLabel({ repair }: { repair: Repair }) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <Link to={`/reparations/${repair.id}`} className="min-w-0 hover:underline">
        <span className="font-medium">{repair.object}</span>
        <span className="text-muted"> · {repair.visitorName}</span>
      </Link>
      {repair.status === 'booked' && <NotMember repair={repair} />}
    </div>
  );
}

/** Rappel à l'accueil : l'adhésion de l'année n'est pas réglée. */
function NotMember({ repair }: { repair: Repair }) {
  if (repair.visitorIsMember) return null;
  return <span className="inline-flex self-start rounded-full bg-amber-soft px-2 py-0.5 text-xs font-semibold text-amber">Adhésion {new Date().getFullYear()} à régler</span>;
}

function Column({ title, count, empty, children }: { title: string; count: number; empty: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-lg">
        {title}
        <span className="rounded-full bg-grey-soft px-2 text-sm font-semibold text-muted">{count}</span>
      </h2>
      {count === 0 ? <p className="text-sm text-muted">{empty}</p> : <div className="flex flex-col gap-2">{children}</div>}
    </Card>
  );
}

function WorkshopCard({ repair, meta, children }: { repair: Repair; meta: string | null; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <Link to={`/reparations/${repair.id}`} className="font-medium hover:underline">
          {repair.object}
          {repair.brand && <span className="font-normal text-muted"> {repair.brand}</span>}
        </Link>
        <p className="truncate text-sm text-muted">
          {categoryLabel(repair.category)} · {repair.visitorName} · {repair.problem}
        </p>
        {meta && <p className="text-xs text-muted">{meta}</p>}
        {repair.status === 'waiting' && <NotMember repair={repair} />}
      </div>
      {children}
    </div>
  );
}
