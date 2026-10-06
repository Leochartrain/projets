import { Navigate, Outlet, useLocation } from 'react-router';
import { Spinner } from '@/components/ui';
import { useAuth } from './AuthProvider';

/** Écrans réservés aux personnes connectées : sinon, direction la connexion, puis retour ici. */
export function RequireAuth() {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!session) return <Navigate to={`/connexion?suite=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <Outlet />;
}
