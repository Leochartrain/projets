import { createBrowserRouter } from 'react-router';
import { AppLayout } from '@/components/layout';
import { LoginPage } from '@/features/auth/LoginPage';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { HomePage } from '@/features/recipes/HomePage';

/**
 * L'accueil et la connexion sont dans le paquet principal ; les autres écrans
 * sont chargés à la demande (un téléphone ne télécharge que ce qu'il affiche).
 */
export const router = createBrowserRouter([
  { path: '/connexion', Component: LoginPage },
  {
    Component: RequireAuth,
    children: [
      {
        Component: AppLayout,
        children: [
          { index: true, Component: HomePage },
          { path: 'groupes', lazy: async () => ({ Component: (await import('@/features/groups/GroupsPage')).GroupsPage }) },
          { path: 'groupes/:id', lazy: async () => ({ Component: (await import('@/features/groups/GroupPage')).GroupPage }) },
          { path: 'favoris', lazy: async () => ({ Component: (await import('@/features/recipes/FavoritesPage')).FavoritesPage }) },
          { path: 'profil', lazy: async () => ({ Component: (await import('@/features/profile/ProfilePage')).ProfilePage }) },
        ],
      },
      { path: 'rejoindre/:code', lazy: async () => ({ Component: (await import('@/features/groups/JoinPage')).JoinPage }) },
      { path: 'recettes/ajouter', lazy: async () => ({ Component: (await import('@/features/recipes/AddRecipePage')).AddRecipePage }) },
      { path: 'recettes/nouvelle', lazy: async () => ({ Component: (await import('@/features/recipes/RecipeEditorPage')).RecipeEditorPage }) },
      { path: 'recettes/:id', lazy: async () => ({ Component: (await import('@/features/recipes/RecipePage')).RecipePage }) },
      { path: 'recettes/:id/modifier', lazy: async () => ({ Component: (await import('@/features/recipes/RecipeEditorPage')).RecipeEditorPage }) },
      { path: 'recettes/:id/cuisiner', lazy: async () => ({ Component: (await import('@/features/recipes/CookPage')).CookPage }) },
    ],
  },
  { path: '*', lazy: async () => ({ Component: (await import('@/NotFoundPage')).NotFoundPage }) },
]);
