import { useDeferredValue, useState } from 'react';
import { Link } from 'react-router';
import { CATEGORIES, OUTCOMES, OUTCOME_LABELS, STATUSES, STATUS_LABELS, categoryLabel } from '@shared/domain';
import { errorText, useRepairs } from '@/api';
import { Card, EmptyState, ErrorBox, PageHeader, RepairBadge, SearchInput, Spinner } from '@/components/ui';
import { shortDate } from '@/format';

const selectClass = 'h-10 rounded-lg border border-field bg-white px-3 text-sm outline-none focus:border-accent';

/** Toutes les fiches : recherche, filtres et export pour le bilan annuel ou le Repair Monitor. */
export function RepairsPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [outcome, setOutcome] = useState('');
  const { data: repairs, isPending, error, isPlaceholderData } = useRepairs({ q: useDeferredValue(q), status, category, outcome });

  return (
    <>
      <PageHeader
        title="Réparations"
        subtitle="Chaque objet apporté a sa fiche : panne, diagnostic, résultat."
        actions={
          <a href="/api/repairs/export.csv" className="inline-flex h-10 items-center rounded-lg border border-field bg-card px-4 font-medium hover:border-ink/40" download>
            Exporter (CSV)
          </a>
        }
      />
      <div className="flex flex-wrap gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Objet, marque, panne, visiteur…" />
        <select aria-label="Étape" className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Toutes les étapes</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select aria-label="Catégorie" className={selectClass} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Toutes les catégories</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <select aria-label="Résultat" className={selectClass} value={outcome} onChange={(e) => setOutcome(e.target.value)}>
          <option value="">Tous les résultats</option>
          {OUTCOMES.map((o) => (
            <option key={o} value={o}>
              {OUTCOME_LABELS[o]}
            </option>
          ))}
        </select>
      </div>

      {isPending && <Spinner />}
      {error && <ErrorBox>{errorText(error)}</ErrorBox>}
      {repairs?.length === 0 && <EmptyState title="Aucune réparation">Rien ne correspond à ces filtres.</EmptyState>}
      {repairs && repairs.length > 0 && (
        <Card className={`overflow-x-auto p-0 transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}>
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">N°</th>
                <th className="px-3 py-3 font-semibold">Objet</th>
                <th className="px-3 py-3 font-semibold">Visiteur</th>
                <th className="px-3 py-3 font-semibold">Séance</th>
                <th className="px-3 py-3 font-semibold">Réparateur</th>
                <th className="px-5 py-3 font-semibold">État</th>
              </tr>
            </thead>
            <tbody>
              {repairs.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0 hover:bg-paper">
                  <td className="px-5 py-3 tabular-nums text-muted">{r.id}</td>
                  <td className="px-3 py-3">
                    <Link to={`/reparations/${r.id}`} className="font-medium hover:underline">
                      {r.object}
                      {r.brand && <span className="font-normal text-muted"> {r.brand}</span>}
                    </Link>
                    <p className="text-xs text-muted">{categoryLabel(r.category)}</p>
                  </td>
                  <td className="px-3 py-3">
                    <Link to={`/visiteurs/${r.visitorId}`} className="hover:underline">
                      {r.visitorName}
                    </Link>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">{r.sessionDate ? <Link to={`/seances/${r.sessionId}`} className="hover:underline">{shortDate(r.sessionDate)}</Link> : '—'}</td>
                  <td className="px-3 py-3">{r.volunteerName ?? '—'}</td>
                  <td className="px-5 py-3">
                    <RepairBadge status={r.status} outcome={r.outcome} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
