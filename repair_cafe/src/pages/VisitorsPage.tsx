import { useDeferredValue, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import type { Visitor } from '@shared/domain';
import { api, errorText, useSave, useVisitors } from '@/api';
import { emptyVisitor, VisitorFields } from '@/components/forms';
import { Button, Card, EmptyState, ErrorBox, Modal, PageHeader, SearchInput, Spinner } from '@/components/ui';
import { plural, shortDate } from '@/format';

export function VisitorsPage() {
  const [q, setQ] = useState('');
  const { data: visitors, isPending, error, isPlaceholderData } = useVisitors(useDeferredValue(q));
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader title="Visiteurs" subtitle="Les personnes venues faire réparer un objet." actions={<Button onClick={() => setCreating(true)}>Nouveau visiteur</Button>} />
      <SearchInput value={q} onChange={setQ} placeholder="Nom, téléphone ou e-mail" />
      {isPending && <Spinner />}
      {error && <ErrorBox>{errorText(error)}</ErrorBox>}
      {visitors?.length === 0 && <EmptyState title={q ? 'Personne à ce nom' : 'Aucun visiteur'}>Les visiteurs sont créés à l'accueil ou quand ils réservent en ligne.</EmptyState>}
      {visitors && visitors.length > 0 && (
        <Card className={`overflow-x-auto p-0 transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}>
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Nom</th>
                <th className="px-3 py-3 font-semibold">Contact</th>
                <th className="px-3 py-3 font-semibold">Objets</th>
                <th className="px-5 py-3 font-semibold">Dernière visite</th>
              </tr>
            </thead>
            <tbody>
              {visitors.map((v) => (
                <tr key={v.id} className="border-b border-line last:border-0 hover:bg-paper">
                  <td className="px-5 py-3">
                    <Link to={`/visiteurs/${v.id}`} className={`font-medium hover:underline ${v.anonymized ? 'text-muted italic' : ''}`}>
                      {v.lastName.toUpperCase()} {v.firstName}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-muted">{[v.phone, v.email].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="px-3 py-3 tabular-nums">{v.repairCount}</td>
                  <td className="px-5 py-3 whitespace-nowrap">{v.lastVisit ? shortDate(v.lastVisit) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-line px-5 py-2 text-xs text-muted">{plural(visitors.length, 'visiteur')}</p>
        </Card>
      )}
      {creating && <NewVisitorModal onClose={() => setCreating(false)} />}
    </>
  );
}

function NewVisitorModal({ onClose }: { onClose: () => void }) {
  const [draft, setDraft] = useState(emptyVisitor);
  const [charter, setCharter] = useState(false);
  const navigate = useNavigate();
  const save = useSave(() => api.post<Visitor>('/visitors', { ...draft, charterAccepted: charter }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const visitor = await save.mutateAsync(undefined);
    navigate(`/visiteurs/${visitor.id}`);
  }

  return (
    <Modal open onClose={onClose} title="Nouveau visiteur" wide>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <VisitorFields value={draft} onChange={setDraft} />
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-accent" checked={charter} onChange={(e) => setCharter(e.target.checked)} />
          La charte du Repair Café a été lue et acceptée.
        </label>
        {save.error && <ErrorBox>{errorText(save.error)}</ErrorBox>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={save.isPending}>
            Créer la fiche
          </Button>
        </div>
      </form>
    </Modal>
  );
}
