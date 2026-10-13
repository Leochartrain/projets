// Remplace features/recipes/api en mode visite : mêmes hooks, données de demo/store.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { recipeKeys, type Recipe, type RecipeFilter, type RecipeInput, type RecipeSummary } from '@/features/recipes/api';
import { db, fail, ME, myGroupIds, profileName, sharesOf, visibleRecipes, wait, type DemoRecipe } from './store';

export { recipeKeys };
export type { Recipe, RecipeFilter, RecipeInput, RecipeSummary };

const plain = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

function toSummary(r: DemoRecipe): RecipeSummary {
  return {
    id: r.id,
    title: r.title,
    passedDownBy: r.passedDownBy,
    category: r.category,
    prepMinutes: r.prepMinutes,
    cookMinutes: r.cookMinutes,
    photo: r.photoPaths[0] ?? null,
    authorName: profileName(r.authorId),
    shared: sharesOf(r.id).length > 0,
  };
}

export function useRecipes(filter: RecipeFilter, search: string) {
  return useQuery({
    queryKey: recipeKeys.list(filter, search),
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<RecipeSummary[]> => {
      await wait();
      if (filter.kind === 'favorites') {
        const visible = visibleRecipes();
        return [...db.favorites]
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .flatMap((f) => visible.filter((r) => r.id === f.recipeId))
          .map(toSummary);
      }
      let rows = visibleRecipes();
      if (filter.kind === 'group') rows = rows.filter((r) => sharesOf(r.id).some((s) => s.groupId === filter.groupId));
      if (filter.kind === 'drafts') rows = rows.filter((r) => r.authorId === ME && sharesOf(r.id).length === 0);
      const words = plain(search).split(/\s+/).filter(Boolean);
      if (words.length > 0) {
        rows = rows.filter((r) => {
          const text = plain([r.title, r.passedDownBy, r.story, ...r.ingredients.map((x) => x.name), ...r.steps].join(' '));
          return words.every((word) => text.includes(word));
        });
      }
      return [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(toSummary);
    },
  });
}

export function useRecipe(id: string, enabled = true) {
  return useQuery({
    queryKey: recipeKeys.detail(id),
    enabled: enabled && Boolean(id),
    queryFn: async (): Promise<Recipe> => {
      await wait();
      const r = visibleRecipes().find((x) => x.id === id) ?? fail('Cette recette est introuvable.');
      const mine = myGroupIds();
      return {
        id: r.id,
        authorId: r.authorId,
        authorName: profileName(r.authorId),
        title: r.title,
        passedDownBy: r.passedDownBy,
        story: r.story,
        category: r.category,
        servings: r.servings,
        servingsLabel: r.servingsLabel,
        prepMinutes: r.prepMinutes,
        cookMinutes: r.cookMinutes,
        ingredients: r.ingredients.map((x) => ({ ...x })),
        steps: [...r.steps],
        photoPaths: [...r.photoPaths],
        originalPaths: [...r.originalPaths],
        groups: sharesOf(r.id)
          .filter((s) => mine.has(s.groupId))
          .flatMap((s) => db.groups.filter((g) => g.id === s.groupId)),
      };
    },
  });
}

export function useSaveRecipe(existingId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RecipeInput) => {
      await wait();
      const id = existingId ?? crypto.randomUUID();
      const row: DemoRecipe = {
        id,
        authorId: ME,
        title: input.title.trim(),
        passedDownBy: input.passedDownBy.trim() || null,
        story: input.story.trim() || null,
        category: input.category,
        servings: input.servings,
        servingsLabel: input.servingsLabel.trim() || null,
        prepMinutes: input.prepMinutes,
        cookMinutes: input.cookMinutes,
        ingredients: input.ingredients.map((x) => ({ quantity: x.quantity, unit: x.unit, name: x.name })),
        steps: input.steps.map((s) => s.trim()).filter(Boolean),
        // Pas de stockage en mode visite : la photo reste un lien local valable jusqu'au rechargement.
        photoPaths: [...input.photoPaths, ...input.newPhotos.map((f) => URL.createObjectURL(f))],
        originalPaths: [...input.originalPaths, ...input.newOriginals.map((f) => URL.createObjectURL(f))],
        updatedAt: new Date().toISOString(),
      };
      const index = db.recipes.findIndex((r) => r.id === id);
      if (index >= 0) {
        if (db.recipes[index]!.authorId !== ME) fail('Seul l\'auteur peut modifier cette recette.');
        db.recipes[index] = row;
      } else {
        db.recipes.push(row);
      }
      const mine = myGroupIds();
      db.shares = [...db.shares.filter((s) => s.recipeId !== id), ...input.groupIds.filter((g) => mine.has(g)).map((groupId) => ({ recipeId: id, groupId }))];
      return id;
    },
    onSuccess: (id) => {
      void queryClient.invalidateQueries({ queryKey: recipeKeys.all });
      void queryClient.invalidateQueries({ queryKey: recipeKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });
}

export function useDeleteRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (recipe: Recipe) => {
      await wait();
      db.recipes = db.recipes.filter((r) => r.id !== recipe.id);
      db.shares = db.shares.filter((s) => s.recipeId !== recipe.id);
      db.favorites = db.favorites.filter((f) => f.recipeId !== recipe.id);
      db.reviews = db.reviews.filter((r) => r.recipeId !== recipe.id);
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

/** Les « chemins » du mode visite sont déjà des liens affichables. */
export function usePhotoUrls(paths: readonly string[]) {
  return useQuery({
    queryKey: recipeKeys.photos(paths),
    enabled: paths.length > 0,
    queryFn: async () => Object.fromEntries(paths.map((path) => [path, path])),
  });
}

export function useFavoriteIds() {
  return useQuery({
    queryKey: recipeKeys.favorites,
    queryFn: async () => new Set(db.favorites.map((f) => f.recipeId)),
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ recipeId, favorite }: { recipeId: string; favorite: boolean }) => {
      db.favorites = db.favorites.filter((f) => f.recipeId !== recipeId);
      if (favorite) db.favorites.push({ recipeId, createdAt: new Date().toISOString() });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: recipeKeys.favorites });
      void queryClient.invalidateQueries({ queryKey: ['recipes', 'list'] });
    },
  });
}
