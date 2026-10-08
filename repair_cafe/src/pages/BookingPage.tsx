import { useState, type FormEvent } from 'react';
import { CHARTER, rateAmount, suggestedRate, type BookingConfirmation, type MembershipSettings } from '@shared/domain';
import { api, errorText, usePublicMembership, usePublicSessions, useSave } from '@/api';
import { currentYear } from '@/components/membership';
import { emptyObject, emptyVisitor, objectPayload, ObjectFields, VisitorFields } from '@/components/forms';
import { Button, Card, EmptyState, ErrorBox, Spinner } from '@/components/ui';
import { euros, hour, longDate } from '@/format';

/** Les tarifs de l'adhésion, et celui qui s'applique dès que la commune est saisie. */
function MembershipNotice({ settings, city }: { settings: MembershipSettings; city: string }) {
  const rate = suggestedRate(city, settings);
  const towns = settings.reducedTowns;
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-blue-soft px-4 py-3 text-sm text-blue">
      <p>
        <strong>Adhésion {currentYear()} obligatoire</strong>, à régler sur place si tu n'es pas encore adhérent cette année :{' '}
        {euros(settings.reducedCents)}
        {towns.length > 0 && ` pour les habitants de ${towns.length > 1 ? `${towns.slice(0, -1).join(', ')} et ${towns.at(-1)}` : towns[0]}`}, {euros(settings.standardCents)} sinon.
      </p>
      {rate && (
        <p className="font-semibold">
          Pour {city.trim()} : {euros(rateAmount(rate, settings))}.
        </p>
      )}
    </div>
  );
}

/** Page publique : choisir une séance et un créneau, décrire l'objet, accepter la charte. */
export function BookingPage() {
  const { data: sessions, isPending, error } = usePublicSessions();
  const { data: membership } = usePublicMembership();
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [slotTime, setSlotTime] = useState<string | null>(null);
  const [object, setObject] = useState(emptyObject);
  const [visitor, setVisitor] = useState(emptyVisitor);
  const [charter, setCharter] = useState(false);
  const [done, setDone] = useState<BookingConfirmation | null>(null);
  const book = useSave(() => api.post<BookingConfirmation>('/public/bookings', { sessionId, slotTime, ...visitor, ...objectPayload(object), charter }));

  const session = sessions?.find((s) => s.id === sessionId) ?? null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setDone(await book.mutateAsync(undefined));
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <img src="/icon.svg" alt="" className="size-9" />
          <div>
            <p className="font-display text-lg font-bold leading-tight">Repair Café</p>
            <p className="text-sm text-muted">On répare ensemble, gratuitement, plutôt que de jeter.</p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
        {done ? (
          <Card className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-accent-soft text-2xl text-accent">✓</span>
            <h1 className="text-2xl">C’est noté !</h1>
            <p>
              On t’attend le <strong>{longDate(done.date)}</strong> à <strong>{hour(done.slotTime)}</strong>
              <br />
              {done.place}
            </p>
            <p className="text-sm text-muted">
              Pense à apporter l’objet, son chargeur ou ses accessoires, et si tu en as, la pièce de rechange. Si tu n’as pas encore adhéré cette année, prévois de quoi régler
              l’adhésion. Rendez-vous n° {done.repairId}.
            </p>
            <Button
              variant="secondary"
              onClick={() => {
                setDone(null);
                setObject(emptyObject);
                setSlotTime(null);
                setCharter(false);
              }}
            >
              Réserver pour un autre objet
            </Button>
          </Card>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl">Prendre rendez-vous</h1>
              <p className="text-muted">Un grille-pain qui ne chauffe plus, un jean à la fermeture cassée, un vélo qui freine mal ? Réserve un créneau : un bénévole le répare avec toi.</p>
            </div>

            {isPending && <Spinner />}
            {error && <ErrorBox>{errorText(error)}</ErrorBox>}
            {sessions?.length === 0 && <EmptyState title="Pas de séance ouverte pour l’instant">Les prochaines dates arrivent bientôt. Tu peux aussi passer sans rendez-vous pendant une séance.</EmptyState>}

            {sessions && sessions.length > 0 && (
              <form onSubmit={submit} className="flex flex-col gap-6">
                <Card className="flex flex-col gap-4">
                  <h2 className="text-lg">1. Quand ?</h2>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {sessions.map((s) => (
                      <label key={s.id} className={`flex cursor-pointer flex-col rounded-xl border p-3 transition ${sessionId === s.id ? 'border-accent bg-accent-soft/60' : 'border-line hover:border-field'}`}>
                        <span className="flex items-center gap-2 font-medium first-letter:uppercase">
                          <input
                            type="radio"
                            name="session"
                            required
                            className="accent-accent"
                            checked={sessionId === s.id}
                            onChange={() => {
                              setSessionId(s.id);
                              setSlotTime(null);
                            }}
                          />
                          {longDate(s.date)}
                        </span>
                        <span className="pl-5 text-sm text-muted">
                          {hour(s.startTime)} – {hour(s.endTime)} · {s.place}
                        </span>
                      </label>
                    ))}
                  </div>
                  {session && (
                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-medium">Heure d’arrivée</span>
                      <div className="flex flex-wrap gap-2">
                        {session.slots.map((slot) => (
                          <button
                            key={slot.time}
                            type="button"
                            disabled={slot.free === 0}
                            aria-pressed={slotTime === slot.time}
                            onClick={() => setSlotTime(slot.time)}
                            className={`h-10 min-w-16 rounded-lg border px-3 font-medium tabular-nums transition disabled:cursor-not-allowed disabled:border-line disabled:text-muted/50 disabled:line-through ${
                              slotTime === slot.time ? 'border-accent bg-accent text-white' : 'border-field bg-white hover:border-accent'
                            }`}
                          >
                            {hour(slot.time)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>

                <Card className="flex flex-col gap-4">
                  <h2 className="text-lg">2. Quel objet ?</h2>
                  <ObjectFields value={object} onChange={setObject} withWeight={false} />
                </Card>

                <Card className="flex flex-col gap-4">
                  <h2 className="text-lg">3. Tes coordonnées</h2>
                  <p className="-mt-2 text-sm text-muted">Un e-mail ou un téléphone, pour te prévenir en cas de changement.</p>
                  <VisitorFields value={visitor} onChange={setVisitor} />
                  {membership && <MembershipNotice settings={membership} city={visitor.city} />}
                </Card>

                <Card className="flex flex-col gap-4">
                  <h2 className="text-lg">4. La charte</h2>
                  <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
                    {CHARTER.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  <label className="flex items-start gap-2 font-medium">
                    <input type="checkbox" required className="mt-1 size-4 accent-accent" checked={charter} onChange={(e) => setCharter(e.target.checked)} />
                    J’ai lu la charte et je l’accepte.
                  </label>
                </Card>

                {book.error && <ErrorBox>{errorText(book.error)}</ErrorBox>}
                <Button type="submit" className="h-12 text-base" disabled={book.isPending || !slotTime}>
                  {slotTime && session ? `Réserver le ${longDate(session.date)} à ${hour(slotTime)}` : 'Choisis un créneau'}
                </Button>
              </form>
            )}
          </>
        )}
      </main>
    </div>
  );
}
