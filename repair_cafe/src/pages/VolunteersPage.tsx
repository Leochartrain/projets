import { useState, type FormEvent } from 'react';
import { CATEGORIES, categoryLabel, type CategoryId, type Volunteer } from '@shared/domain';
import { api, errorText, useSave, useVolunteers } from '@/api';
import { Button, Card, Chip, EmptyState, ErrorBox, Modal, PageHeader, Spinner, TextField } from '@/components/ui';
import { plural } from '@/format';

export function VolunteersPage() {
  const { data: volunteers, isPending, error } = useVolunteers();
  const [editing, setEditing] = useState<Volunteer | 'new' | null>(null);

  return (
    <>
      <PageHeader title="Bénévoles" subtitle="Les réparateurs et leurs spécialités." actions={<Button onClick={() => setEditing('new')}>Nouveau bénévole</Button>} />
      {isPending && <Spinner />}
      {error && <ErrorBox>{errorText(error)}</ErrorBox>}
      {volunteers?.length === 0 && <EmptyState title="Aucun bénévole">Ajoute les réparateurs pour leur attribuer les objets à l'atelier.</EmptyState>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {volunteers?.map((v) => (
          <Card key={v.id} className={`flex flex-col gap-3 ${v.active ? '' : 'opacity-60'}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg">{v.name}</h2>
                <p className="text-sm text-muted">{[v.phone, v.email].filter(Boolean).join(' · ') || 'Pas de coordonnées'}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setEditing(v)}>
                Modifier
              </Button>
            </div>
            <div className="flex flex-wrap gap-1">
              {v.skills.length ? v.skills.map((s) => <Chip key={s}>{categoryLabel(s)}</Chip>) : <span className="text-sm text-muted">Touche-à-tout</span>}
            </div>
            <p className="text-sm">
              {plural(v.interventions, 'intervention')}
              {v.interventions > 0 && <span className="text-muted"> · {plural(v.repaired, 'objet réparé', 'objets réparés')}</span>}
              {!v.active && <span className="text-muted"> · inactif</span>}
            </p>
          </Card>
        ))}
      </div>
      {editing && <VolunteerModal volunteer={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function VolunteerModal({ volunteer, onClose }: { volunteer: Volunteer | null; onClose: () => void }) {
  const [name, setName] = useState(volunteer?.name ?? '');
  const [phone, setPhone] = useState(volunteer?.phone ?? '');
  const [email, setEmail] = useState(volunteer?.email ?? '');
  const [skills, setSkills] = useState<CategoryId[]>(volunteer?.skills ?? []);
  const [active, setActive] = useState(volunteer?.active ?? true);
  const save = useSave(() => {
    const body = { name, phone, email, skills, active };
    return volunteer ? api.patch<Volunteer>(`/volunteers/${volunteer.id}`, body) : api.post<Volunteer>('/volunteers', body);
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    await save.mutateAsync(undefined);
    onClose();
  }

  const toggle = (id: CategoryId) => setSkills(skills.includes(id) ? skills.filter((s) => s !== id) : [...skills, id]);

  return (
    <Modal open onClose={onClose} title={volunteer ? volunteer.name : 'Nouveau bénévole'}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField label="Nom" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Téléphone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <TextField label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Spécialités</legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={skills.includes(c.id)}
                onClick={() => toggle(c.id)}
                className={`rounded-full border px-3 py-1 text-sm transition ${skills.includes(c.id) ? 'border-accent bg-accent-soft text-accent-strong' : 'border-line text-muted hover:border-field'}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-accent" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Actif (proposé à l'atelier)
        </label>
        {save.error && <ErrorBox>{errorText(save.error)}</ErrorBox>}
        <div className="flex justify-end gap-2">
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
