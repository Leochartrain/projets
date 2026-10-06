import { Screen } from '@/components/layout';
import { EmptyState } from '@/components/ui';
import { RecipeList } from './RecipeList';

export function FavoritesPage() {
  return (
    <Screen title="Favoris">
      <RecipeList filter={{ kind: 'favorites' }} empty={<EmptyState title="Aucun favori">Touche le cœur d'une recette pour la retrouver ici.</EmptyState>} />
    </Screen>
  );
}
