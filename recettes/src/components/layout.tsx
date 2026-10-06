import type { ReactNode } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { Icon, type IconName } from './Icon';

/** Écran avec un en-tête (retour, titre, actions) et un contenu centré, lisible sur ordinateur aussi. */
export function Screen({
  title,
  back,
  actions,
  children,
  wide = false,
}: {
  title?: ReactNode;
  back?: string;
  actions?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`mx-auto flex w-full flex-col gap-5 px-5 pb-32 pt-[max(1.5rem,env(safe-area-inset-top))] ${wide ? 'max-w-3xl' : 'max-w-xl'}`}>
      {(title || back || actions) && (
        <header className="flex min-h-12 items-center gap-3">
          {back && (
            <Link to={back} aria-label="Retour" className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-card">
              <Icon name="back" size={20} />
            </Link>
          )}
          {title && <h1 className="min-w-0 flex-1 text-2xl leading-tight">{title}</h1>}
          {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </div>
  );
}

const TABS: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'Accueil', icon: 'home', end: true },
  { to: '/groupes', label: 'Groupes', icon: 'users' },
  { to: '/favoris', label: 'Favoris', icon: 'heart' },
  { to: '/profil', label: 'Profil', icon: 'user' },
];

/** Écrans principaux : le contenu, et la barre d'onglets en bas de l'écran. */
export function AppLayout() {
  return (
    <>
      <Outlet />
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <ul className="mx-auto grid max-w-xl grid-cols-4">
          {TABS.map((tab) => (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `flex h-16 flex-col items-center justify-center gap-1 font-display text-xs font-medium ${isActive ? 'text-accent' : 'text-muted'}`
                }
              >
                <Icon name={tab.icon} />
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
