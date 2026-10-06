import { useMemo, type ReactNode } from 'react';
import { EmptyState, ErrorBox, Spinner } from '@/components/ui';
import { errorMessage } from '@/lib/supabase';
import { usePhotoUrls, useRecipes, type RecipeFilter } from './api';
import { RecipeCard } from './RecipeCard';

/** Liste de recettes selon un filtre, avec les photos chargées en une seule requête. */
export function RecipeList({ filter, search = '', empty }: { filter: RecipeFilter; search?: string; empty: ReactNode }) {
  const { data, isPending, error, isPlaceholderData } = useRecipes(filter, search);
  const photos = useMemo(() => (data ?? []).flatMap((r) => (r.photo ? [r.photo] : [])), [data]);
  const { data: urls } = usePhotoUrls(photos);

  if (isPending) return <Spinner />;
  if (error) return <ErrorBox>{errorMessage(error)}</ErrorBox>;
  if (data.length === 0) {
    return search ? <EmptyState title="Aucune recette trouvée">Essaie un autre mot, par exemple un ingrédient.</EmptyState> : <>{empty}</>;
  }
  return (
    <ul className={`flex flex-col gap-3 transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}>
      {data.map((recipe) => (
        <li key={recipe.id}>
          <RecipeCard recipe={recipe} photoUrl={recipe.photo ? urls?.[recipe.photo] : undefined} />
        </li>
      ))}
    </ul>
  );
}
