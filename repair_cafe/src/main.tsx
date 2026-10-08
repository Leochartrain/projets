import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { ApiError, meKey } from './api';
import { router } from './router';
import './styles.css';

/** Session expirée ou fermée ailleurs : on relit « qui suis-je », et l'appli renvoie vers la connexion. */
function onError(error: unknown) {
  if (error instanceof ApiError && error.status === 401) void queryClient.invalidateQueries({ queryKey: meKey });
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError }),
  mutationCache: new MutationCache({ onError }),
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      // Inutile de réessayer une requête refusée (pas connecté, pas le droit, introuvable).
      retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 1,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
