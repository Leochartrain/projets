import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { isConfigured } from '@/lib/supabase';
import { router } from './router';
import { SetupPage } from './SetupPage';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    // Données considérées fraîches 30 s : on navigue entre les écrans sans tout recharger.
    queries: { staleTime: 30_000, retry: 1 },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isConfigured ? (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>
    ) : (
      <SetupPage />
    )}
  </StrictMode>,
);
