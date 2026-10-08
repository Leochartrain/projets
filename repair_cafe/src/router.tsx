import { createBrowserRouter } from 'react-router';
import { Layout } from './components/Layout';
import { BookingPage } from './pages/BookingPage';
import { DashboardPage } from './pages/DashboardPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RepairPage } from './pages/RepairPage';
import { RepairsPage } from './pages/RepairsPage';
import { SessionPage } from './pages/SessionPage';
import { SessionsPage } from './pages/SessionsPage';
import { SettingsPage } from './pages/SettingsPage';
import { VisitorPage } from './pages/VisitorPage';
import { VisitorsPage } from './pages/VisitorsPage';
import { VolunteersPage } from './pages/VolunteersPage';

export const router = createBrowserRouter([
  // Page publique, sans le menu de l'équipe.
  { path: '/reserver', Component: BookingPage },
  {
    Component: Layout,
    children: [
      { index: true, Component: DashboardPage },
      { path: 'seances', Component: SessionsPage },
      { path: 'seances/:id', Component: SessionPage },
      { path: 'reparations', Component: RepairsPage },
      { path: 'reparations/:id', Component: RepairPage },
      { path: 'visiteurs', Component: VisitorsPage },
      { path: 'visiteurs/:id', Component: VisitorPage },
      { path: 'benevoles', Component: VolunteersPage },
      { path: 'reglages', Component: SettingsPage },
      { path: '*', Component: NotFoundPage },
    ],
  },
]);
