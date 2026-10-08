import { useQueryClient } from '@tanstack/react-query';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { ROLE_LABELS, type TeamUser } from '@shared/domain';
import { api, errorText, useMe } from '@/api';
import { ErrorBox, Spinner } from './ui';

const NAV: { to: string; label: string; icon: string }[] = [
  { to: '/', label: 'Tableau de bord', icon: 'M3 12h7V3H3zM14 21h7v-9h-7zM14 3v5h7V3zM3 21h7v-5H3z' },
  { to: '/seances', label: 'Séances', icon: 'M4 6h16v14H4zM4 10h16M9 3v5M15 3v5' },
  { to: '/reparations', label: 'Réparations', icon: 'M14.7 6.3a4 4 0 0 0-5.4 5.2L4 16.8V20h3.2l5.3-5.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.4-.6-.6-2.4z' },
  { to: '/visiteurs', label: 'Visiteurs', icon: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 19v-1a4 4 0 0 0-3-3.9M15.5 3.1a3.5 3.5 0 0 1 0 6.8' },
  { to: '/benevoles', label: 'Bénévoles', icon: 'M12 21s-7-4.4-9.3-9A5 5 0 0 1 12 6.5 5 5 0 0 1 21.3 12C19 16.6 12 21 12 21z' },
  { to: '/reglages', label: 'Réglages', icon: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M16 4v4M10 10v4M18 16v4' },
];

function NavIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

/** Écrans de l'équipe : il faut être connecté, sinon direction la page de connexion (puis retour ici). */
export function Layout() {
  const { data: me, isPending, error } = useMe();
  const location = useLocation();
  if (isPending) return <Spinner />;
  if (error) return <ErrorBox>{errorText(error)}</ErrorBox>;
  if (!me.user) return <Navigate to={`/connexion?suite=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <Shell user={me.user} />;
}

function UserMenu({ user }: { user: TeamUser }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  async function logout() {
    await api.post('/auth/logout', {}).catch(() => undefined);
    queryClient.clear();
    navigate('/connexion', { replace: true });
  }
  return (
    <div className="flex flex-col gap-1 border-t border-line px-2 pt-4">
      <p className="truncate text-sm font-medium" title={user.name}>
        {user.name}
      </p>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted">{ROLE_LABELS[user.role]}</p>
        <button type="button" onClick={logout} className="-mr-2 rounded-lg px-2 py-1 text-xs text-muted hover:bg-grey-soft hover:text-ink">
          Se déconnecter
        </button>
      </div>
    </div>
  );
}

/** Menu à gauche sur ordinateur, en bas sur téléphone (le poste d'accueil est souvent une tablette). */
function Shell({ user }: { user: TeamUser }) {
  return (
    <div className="min-h-dvh md:flex">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r border-line bg-card px-4 py-6 md:flex">
        <div className="flex items-center gap-2.5 px-2">
          <img src="/icon.svg" alt="" className="size-9" />
          <div className="flex flex-col leading-tight">
            <span className="font-display text-lg font-bold">Repair Café</span>
            <span className="text-xs text-muted">Gestion de l'atelier</span>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 font-medium transition ${isActive ? 'bg-accent-soft text-accent-strong' : 'text-muted hover:bg-grey-soft hover:text-ink'}`
              }
            >
              <NavIcon d={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <a href="/reserver" target="_blank" rel="noreferrer" className="mt-auto rounded-xl bg-paper p-3 text-sm text-muted hover:text-ink">
          <span className="font-medium text-ink">Page de réservation ↗</span>
          <br />
          Le lien à donner au public pour prendre rendez-vous.
        </a>
        <UserMenu user={user} />
      </aside>

      <main className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6 px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-8">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-6 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `flex flex-col items-center gap-1 py-2 text-[11px] font-medium ${isActive ? 'text-accent' : 'text-muted'}`}
          >
            <NavIcon d={item.icon} />
            {item.label === 'Tableau de bord' ? 'Accueil' : item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
