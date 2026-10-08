import { Link } from 'react-router';
import { OUTCOME_LABELS, categoryLabel, type Outcome, type Stats } from '@shared/domain';
import { errorText, useStats } from '@/api';
import { ButtonLink, Card, EmptyState, ErrorBox, PageHeader, RepairBadge, Spinner, Stat } from '@/components/ui';
import { euros, hour, kilos, longDate, plural, shortDate, todayIso } from '@/format';

const OUTCOME_COLORS: Record<Outcome, string> = {
  repaired: 'bg-accent',
  repairable: 'bg-[#d79a2b]',
  not_repairable: 'bg-danger',
  advice: 'bg-blue',
};

export function DashboardPage() {
  const { data: stats, isPending, error } = useStats();
  if (isPending) return <Spinner />;
  if (error) return <ErrorBox>{errorText(error)}</ErrorBox>;

  const rate = stats.finished ? Math.round((stats.repaired / stats.finished) * 100) : 0;

  return (
    <>
      <PageHeader title="Tableau de bord" subtitle="Ce que le Repair Café a sauvé de la poubelle, depuis le début." />
      <NextSession stats={stats} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Objets réparés" tone="accent" value={stats.repaired} detail={`${rate} % des ${plural(stats.finished, 'objet examiné', 'objets examinés')}`} />
        <Stat label="Déchets évités" value={kilos(stats.kgSaved)} detail="poids des objets réparés" />
        <Stat label="Visiteurs" value={stats.visitors} detail={plural(stats.volunteers, 'bénévole actif', 'bénévoles actifs')} />
        <Stat label="Participations" value={euros(stats.donationsCents)} detail="dons libres collectés" />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card className="flex flex-col gap-5">
          <h2 className="text-lg">Résultats</h2>
          {stats.finished === 0 ? (
            <p className="text-sm text-muted">Pas encore de réparation terminée.</p>
          ) : (
            <>
              <div className="flex h-4 overflow-hidden rounded-full" role="img" aria-label="Répartition des résultats">
                {(['repaired', 'repairable', 'advice', 'not_repairable'] as const).map((o) => {
                  const n = { repaired: stats.repaired, repairable: stats.repairable, advice: stats.advice, not_repairable: stats.notRepairable }[o];
                  return n ? <div key={o} className={`${OUTCOME_COLORS[o]} border-r-2 border-card last:border-0`} style={{ width: `${(n / stats.finished) * 100}%` }} /> : null;
                })}
              </div>
              <ul className="grid grid-cols-2 gap-2 text-sm">
                {(
                  [
                    ['repaired', stats.repaired],
                    ['repairable', stats.repairable],
                    ['advice', stats.advice],
                    ['not_repairable', stats.notRepairable],
                  ] as const
                ).map(([o, n]) => (
                  <li key={o} className="flex items-center gap-2">
                    <span className={`size-3 rounded-sm ${OUTCOME_COLORS[o]}`} />
                    {OUTCOME_LABELS[o]}
                    <span className="ml-auto tabular-nums text-muted">{n}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <h2 className="mt-2 text-lg">Par catégorie</h2>
          <ul className="flex flex-col gap-3">
            {stats.byCategory.map((c) => {
              const max = stats.byCategory[0]?.finished ?? 1;
              return (
                <li key={c.category} className="flex flex-col gap-1">
                  <div className="flex justify-between gap-2 text-sm">
                    <span>{categoryLabel(c.category)}</span>
                    <span className="tabular-nums text-muted">
                      {c.repaired} réparés / {c.finished}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-grey-soft">
                    <div className="flex h-full" style={{ width: `${(c.finished / max) * 100}%` }}>
                      <div className="h-full bg-accent" style={{ width: `${(c.repaired / c.finished) * 100}%` }} />
                      <div className="h-full flex-1 bg-field" />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg">Dernières réparations</h2>
            <Link to="/reparations" className="text-sm font-medium text-accent hover:underline">
              Tout voir
            </Link>
          </div>
          {stats.recent.length === 0 ? (
            <EmptyState title="Rien pour l’instant" />
          ) : (
            <ul className="flex flex-col">
              {stats.recent.map((r) => (
                <li key={r.id} className="border-b border-line last:border-0">
                  <Link to={`/reparations/${r.id}`} className="flex items-center justify-between gap-3 py-3 hover:opacity-80">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {r.object}
                        {r.brand && <span className="font-normal text-muted"> {r.brand}</span>}
                      </p>
                      <p className="truncate text-sm text-muted">
                        {r.sessionDate && shortDate(r.sessionDate)} · {r.volunteerName ?? '—'}
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
    </>
  );
}

function NextSession({ stats }: { stats: Stats }) {
  const session = stats.nextSession;
  if (!session) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <p>Aucune séance prévue : les visiteurs ne peuvent pas réserver.</p>
        <ButtonLink to="/seances" variant="primary">
          Planifier une séance
        </ButtonLink>
      </Card>
    );
  }
  const isToday = session.date === todayIso();
  return (
    <section className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl p-6 ${isToday ? 'bg-accent text-white' : 'border border-line bg-card'}`}>
      <div className="flex flex-col gap-1">
        <span className={`text-xs font-semibold uppercase tracking-wider ${isToday ? 'text-white/80' : 'text-muted'}`}>{isToday ? 'Séance du jour' : 'Prochaine séance'}</span>
        <p className="font-display text-2xl font-bold first-letter:uppercase">{longDate(session.date)}</p>
        <p className={isToday ? 'text-white/85' : 'text-muted'}>
          {hour(session.startTime)} – {hour(session.endTime)} · {session.place} · {session.booked}/{session.capacity} places réservées
        </p>
      </div>
      <ButtonLink to={`/seances/${session.id}`} variant={isToday ? 'secondary' : 'primary'}>
        {isToday ? 'Ouvrir l’atelier' : 'Voir le planning'}
      </ButtonLink>
    </section>
  );
}
