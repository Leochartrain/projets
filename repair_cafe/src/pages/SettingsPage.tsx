import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { MIN_PASSWORD, ROLES, ROLE_LABELS, type MembershipSettings, type Role, type TeamUser } from '@shared/domain';
import { api, errorText, useCurrentUser, useSave, useSettings, useUsers } from '@/api';
import { currentYear } from '@/components/membership';
import { Button, Card, ErrorBox, Modal, PageHeader, SelectField, Spinner, TextArea, TextField } from '@/components/ui';
import { parseDecimal, shortDate } from '@/format';

export function SettingsPage() {
  const user = useCurrentUser();
  const { data: settings, isPending, error } = useSettings();
  const isAdmin = user.role === 'admin';
  return (
    <>
      <PageHeader title="Réglages" subtitle="Ton compte, les comptes de l'équipe et les règles de l'association." />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <AccountCard user={user} />
          {isPending && <Spinner />}
          {error && <ErrorBox>{errorText(error)}</ErrorBox>}
          {settings && <MembershipSettingsForm key={JSON.stringify(settings)} settings={settings} editable={isAdmin} />}
        </div>
        {isAdmin && <TeamCard me={user} />}
      </div>
    </>
  );
}

// --- Mon compte -----------------------------------------------------------------

function AccountCard({ user }: { user: TeamUser }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [done, setDone] = useState(false);
  const change = useSave(() => api.put('/auth/password', { currentPassword: current, newPassword: next }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    await change.mutateAsync(undefined);
    setCurrent('');
    setNext('');
    setDone(true);
  }

  async function logout() {
    await api.post('/auth/logout', {}).catch(() => undefined);
    queryClient.clear();
    navigate('/connexion', { replace: true });
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg">Mon compte</h2>
          <p className="text-sm text-muted">
            {user.name} · identifiant <strong className="text-ink">{user.username}</strong> · {ROLE_LABELS[user.role]}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={logout}>
          Se déconnecter
        </Button>
      </div>
      <form onSubmit={submit} onChange={() => setDone(false)} className="grid gap-3 sm:grid-cols-2">
        <TextField label="Mot de passe actuel" type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <TextField
          label="Nouveau mot de passe"
          type="password"
          required
          minLength={MIN_PASSWORD}
          autoComplete="new-password"
          hint={`Au moins ${MIN_PASSWORD} caractères.`}
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        {change.error && (
          <div className="sm:col-span-2">
            <ErrorBox>{errorText(change.error)}</ErrorBox>
          </div>
        )}
        <div className="flex items-center justify-end gap-3 sm:col-span-2">
          {done && <span className="text-sm text-accent">Mot de passe changé.</span>}
          <Button type="submit" variant="secondary" disabled={change.isPending}>
            Changer le mot de passe
          </Button>
        </div>
      </form>
    </Card>
  );
}

// --- Équipe (administrateurs) ------------------------------------------------------

function TeamCard({ me }: { me: TeamUser }) {
  const { data: users, isPending, error } = useUsers();
  const [editing, setEditing] = useState<TeamUser | 'new' | null>(null);
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg">Comptes de l'équipe</h2>
          <p className="text-sm text-muted">Les administrateurs gèrent les comptes et les réglages ; les bénévoles ont accès à tout le reste.</p>
        </div>
        <Button size="sm" onClick={() => setEditing('new')}>
          Ajouter
        </Button>
      </div>
      {isPending && <Spinner />}
      {error && <ErrorBox>{errorText(error)}</ErrorBox>}
      <ul className="flex flex-col divide-y divide-line">
        {users?.map((u) => (
          <li key={u.id} className={`flex items-center justify-between gap-3 py-3 ${u.active ? '' : 'opacity-50'}`}>
            <div className="min-w-0">
              <p className="font-medium">
                {u.name}
                {u.id === me.id && <span className="font-normal text-muted"> (toi)</span>}
              </p>
              <p className="text-sm text-muted">
                {u.username} · {ROLE_LABELS[u.role]}
                {!u.active && ' · désactivé'}
                {u.lastLoginAt && ` · vu le ${shortDate(u.lastLoginAt)}`}
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setEditing(u)}>
              Modifier
            </Button>
          </li>
        ))}
      </ul>
      {editing && <UserModal user={editing === 'new' ? null : editing} isMe={editing !== 'new' && editing.id === me.id} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function UserModal({ user, isMe, onClose }: { user: TeamUser | null; isMe: boolean; onClose: () => void }) {
  const [name, setName] = useState(user?.name ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [role, setRole] = useState<Role>(user?.role ?? 'member');
  const [active, setActive] = useState(user?.active ?? true);
  const [password, setPassword] = useState('');
  const save = useSave(() =>
    user
      ? api.patch<TeamUser>(`/users/${user.id}`, { name, role, active, ...(password ? { password } : {}) })
      : api.post<TeamUser>('/users', { name, username, role, password }),
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    await save.mutateAsync(undefined);
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={user ? user.name : 'Nouveau compte'}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField label="Nom" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        {user ? (
          <p className="text-sm text-muted">
            Identifiant : <strong className="text-ink">{user.username}</strong>
          </p>
        ) : (
          <TextField label="Identifiant" required autoCapitalize="none" hint="Sans espace, par exemple « fatou.d »." value={username} onChange={(e) => setUsername(e.target.value)} />
        )}
        <SelectField label="Rôle" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </SelectField>
        <TextField
          label={user ? 'Nouveau mot de passe' : 'Mot de passe'}
          type="password"
          autoComplete="new-password"
          required={!user}
          minLength={MIN_PASSWORD}
          hint={user ? 'Laisser vide pour ne pas le changer. Ses connexions en cours seront fermées.' : `Au moins ${MIN_PASSWORD} caractères, à transmettre à la personne.`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {user && !isMe && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-accent" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Compte actif (décocher pour bloquer l'accès sans supprimer le compte)
          </label>
        )}
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

// --- Adhésion -------------------------------------------------------------------

const toEuros = (cents: number) => (cents / 100).toString().replace('.', ',');

function MembershipSettingsForm({ settings, editable }: { settings: MembershipSettings; editable: boolean }) {
  const [reduced, setReduced] = useState(toEuros(settings.reducedCents));
  const [standard, setStandard] = useState(toEuros(settings.standardCents));
  const [towns, setTowns] = useState(settings.reducedTowns.join('\n'));
  const [saved, setSaved] = useState(false);
  const save = useSave(() =>
    api.put<MembershipSettings>('/settings', {
      reducedCents: Math.round((parseDecimal(reduced) ?? 0) * 100),
      standardCents: Math.round((parseDecimal(standard) ?? 0) * 100),
      reducedTowns: towns
        .split(/[\n,;]/)
        .map((t) => t.trim())
        .filter(Boolean),
    }),
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    await save.mutateAsync(undefined);
    setSaved(true);
  }

  return (
    <Card>
      <form onSubmit={submit} onChange={() => setSaved(false)} className="flex flex-col gap-5">
        <fieldset disabled={!editable} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg">Adhésion annuelle</h2>
            <p className="text-sm text-muted">
              Obligatoire pour faire réparer un objet. Elle vaut pour l'année civile ({currentYear()} : du 1<sup>er</sup> janvier au 31 décembre) et se règle à l'accueil.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Tarif réduit (€)" inputMode="decimal" required value={reduced} onChange={(e) => setReduced(e.target.value)} />
            <TextField label="Tarif normal (€)" inputMode="decimal" required value={standard} onChange={(e) => setStandard(e.target.value)} />
          </div>
          <TextArea
            label="Communes au tarif réduit"
            rows={8}
            hint="Une commune par ligne. Les accents, majuscules, tirets et « St » / « Saint » ne comptent pas. Les habitants des autres communes paient le tarif normal."
            value={towns}
            onChange={(e) => setTowns(e.target.value)}
          />
        </fieldset>
        {save.error && <ErrorBox>{errorText(save.error)}</ErrorBox>}
        {editable ? (
          <div className="flex items-center justify-end gap-3">
            {saved && <span className="text-sm text-accent">Réglages enregistrés.</span>}
            <Button type="submit" disabled={save.isPending}>
              Enregistrer
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted">Seuls les administrateurs peuvent modifier ces réglages.</p>
        )}
      </form>
    </Card>
  );
}
