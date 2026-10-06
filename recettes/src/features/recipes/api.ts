import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserId } from '@/features/auth/AuthProvider';
import type { RecipeCategory } from '@/lib/database.types';
import { compressImage } from '@/lib/images';
import { readIngredients, readSteps, type Ingredient } from '@/lib/ingredients';
import { supabase } from '@/lib/supabase';

export const recipeKeys = {
  all: ['recipes'] as const,
  list: (filter: RecipeFilter, search: string) => ['recipes', 'list', filter, search] as const,
  detail: (id: string) => ['recipes', id] as const,
  favorites: ['favorites'] as const,
  photos: (paths: readonly string[]) => ['photos', ...paths] as const,
};

/** Tout ce que je peux voir, un groupe, mes brouillons (non partagés) ou mes favoris. */
export type RecipeFilter = { kind: 'all' } | { kind: 'group'; groupId: string } | { kind: 'drafts' } | { kind: 'favorites' };

export interface RecipeSummary {
  id: string;
  title: string;
  passedDownBy: string | null;
  category: RecipeCategory | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  photo: string | null;
  authorName: string;
  shared: boolean;
}

const SUMMARY = 'id, title, passed_down_by, category, prep_minutes, cook_minutes, photo_paths, author_id, author:profiles!inner(display_name), shares:recipe_shares(group_id)';

type SummaryRow = {
  id: string;
  title: string;
  passed_down_by: string | null;
  category: RecipeCategory | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  photo_paths: string[];
  author: { display_name: string };
  shares: { group_id: string }[];
};

function toSummary(row: SummaryRow): RecipeSummary {
  return {
    id: row.id,
    title: row.title,
    passedDownBy: row.passed_down_by,
    category: row.category,
    prepMinutes: row.prep_minutes,
    cookMinutes: row.cook_minutes,
    photo: row.photo_paths[0] ?? null,
    authorName: row.author.display_name,
    shared: row.shares.length > 0,
  };
}

export function useRecipes(filter: RecipeFilter, search: string) {
  const userId = useUserId();
  return useQuery({
    queryKey: recipeKeys.list(filter, search),
    // Pendant la frappe, on garde la liste précédente au lieu d'un écran vide.
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<RecipeSummary[]> => {
      if (filter.kind === 'favorites') {
        const { data, error } = await supabase.from('favorites').select(`created_at, recipe:recipes!inner(${SUMMARY})`).order('created_at', { ascending: false });
        if (error) throw error;
        return data.map((row) => toSummary(row.recipe as SummaryRow));
      }
      let query = supabase
        .from('recipes')
        .select(filter.kind === 'group' ? `${SUMMARY}, in_group:recipe_shares!inner(group_id)` : SUMMARY)
        .order('updated_at', { ascending: false })
        .limit(200);
      if (filter.kind === 'group') query = query.eq('in_group.group_id', filter.groupId);
      if (filter.kind === 'drafts') query = query.eq('author_id', userId);
      if (search.trim()) query = query.textSearch('search', search.trim(), { type: 'websearch', config: 'french' });
      const { data, error } = await query;
      if (error) throw error;
      const rows = (data as unknown as SummaryRow[]).map(toSummary);
      return filter.kind === 'drafts' ? rows.filter((r) => !r.shared) : rows;
    },
  });
}

export interface Recipe {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  passedDownBy: string | null;
  story: string | null;
  category: RecipeCategory | null;
  servings: number | null;
  servingsLabel: string | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  ingredients: Ingredient[];
  steps: string[];
  photoPaths: string[];
  originalPaths: string[];
  groups: { id: string; name: string }[];
}

export function useRecipe(id: string, enabled = true) {
  return useQuery({
    queryKey: recipeKeys.detail(id),
    enabled: enabled && Boolean(id),
    queryFn: async (): Promise<Recipe> => {
      const { data, error } = await supabase
        .from('recipes')
        .select('*, author:profiles!inner(display_name), shares:recipe_shares(group:groups(id, name))')
        .eq('id', id)
        .single();
      if (error) throw error;
      return {
        id: data.id,
        authorId: data.author_id,
        authorName: data.author.display_name,
        title: data.title,
        passedDownBy: data.passed_down_by,
        story: data.story,
        category: data.category,
        servings: data.servings,
        servingsLabel: data.servings_label,
        prepMinutes: data.prep_minutes,
        cookMinutes: data.cook_minutes,
        ingredients: readIngredients(data.ingredients),
        steps: readSteps(data.steps),
        photoPaths: data.photo_paths,
        originalPaths: data.original_paths,
        // Un groupe que je ne vois pas (je n'en suis pas membre) revient vide : on l'ignore.
        groups: data.shares.flatMap((share) => (share.group ? [share.group] : [])),
      };
    },
  });
}

export interface RecipeInput {
  title: string;
  passedDownBy: string;
  story: string;
  category: RecipeCategory | null;
  servings: number | null;
  servingsLabel: string;
  prepMinutes: number | null;
  cookMinutes: number | null;
  ingredients: Ingredient[];
  steps: string[];
  /** Photos gardées (chemins déjà envoyés) et nouvelles photos à envoyer. */
  photoPaths: string[];
  newPhotos: File[];
  originalPaths: string[];
  newOriginals: File[];
  groupIds: string[];
}

/** Crée ou met à jour une recette : photos réduites puis envoyées, recette enregistrée, groupes de partage. */
export function useSaveRecipe(existingId?: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RecipeInput) => {
      const id = existingId ?? crypto.randomUUID();
      const upload = (files: File[]) =>
        Promise.all(
          files.map(async (file) => {
            const blob = await compressImage(file);
            const extension = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg';
            const path = `${userId}/${id}/${crypto.randomUUID()}.${extension}`;
            const { error } = await supabase.storage.from('photos').upload(path, blob, { contentType: blob.type || 'image/jpeg' });
            if (error) throw error;
            return path;
          }),
        );
      const [newPhotoPaths, newOriginalPaths] = await Promise.all([upload(input.newPhotos), upload(input.newOriginals)]);

      const row = {
        title: input.title.trim(),
        passed_down_by: input.passedDownBy.trim() || null,
        story: input.story.trim() || null,
        category: input.category,
        servings: input.servings,
        servings_label: input.servingsLabel.trim() || null,
        prep_minutes: input.prepMinutes,
        cook_minutes: input.cookMinutes,
        ingredients: input.ingredients.map((i) => ({ quantity: i.quantity, unit: i.unit, name: i.name })),
        steps: input.steps.map((s) => s.trim()).filter(Boolean),
        photo_paths: [...input.photoPaths, ...newPhotoPaths],
        original_paths: [...input.originalPaths, ...newOriginalPaths],
      };

      let removed: string[] = [];
      if (existingId) {
        const before = queryClient.getQueryData<Recipe>(recipeKeys.detail(existingId));
        const { error } = await supabase.from('recipes').update(row).eq('id', existingId);
        if (error) throw error;
        // Photos retirées de la recette : on les supprime du stockage.
        removed = [...(before?.photoPaths ?? []), ...(before?.originalPaths ?? [])].filter(
          (path) => !row.photo_paths.includes(path) && !row.original_paths.includes(path),
        );
      } else {
        const { error } = await supabase.from('recipes').insert({ id, ...row });
        if (error) throw error;
      }
      const { error: shareError } = await supabase.rpc('set_recipe_groups', { rid: id, gids: input.groupIds });
      if (shareError) throw shareError;
      if (removed.length > 0) await supabase.storage.from('photos').remove(removed);
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
      const { error } = await supabase.from('recipes').delete().eq('id', recipe.id);
      if (error) throw error;
      const paths = [...recipe.photoPaths, ...recipe.originalPaths];
      if (paths.length > 0) await supabase.storage.from('photos').remove(paths);
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

/** Liens temporaires vers des photos privées (valables une heure, gardés 50 minutes en cache). */
export function usePhotoUrls(paths: readonly string[]) {
  return useQuery({
    queryKey: recipeKeys.photos(paths),
    enabled: paths.length > 0,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('photos').createSignedUrls([...paths], 3600);
      if (error) throw error;
      return Object.fromEntries(data.flatMap((item) => (item.path && item.signedUrl ? [[item.path, item.signedUrl]] : [])));
    },
  });
}

export function useFavoriteIds() {
  return useQuery({
    queryKey: recipeKeys.favorites,
    queryFn: async () => {
      const { data, error } = await supabase.from('favorites').select('recipe_id');
      if (error) throw error;
      return new Set(data.map((f) => f.recipe_id));
    },
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ recipeId, favorite }: { recipeId: string; favorite: boolean }) => {
      const { error } = favorite
        ? await supabase.from('favorites').insert({ recipe_id: recipeId })
        : await supabase.from('favorites').delete().eq('recipe_id', recipeId);
      if (error) throw error;
    },
    // Le cœur change tout de suite, sans attendre le serveur.
    onMutate: async ({ recipeId, favorite }) => {
      await queryClient.cancelQueries({ queryKey: recipeKeys.favorites });
      const previous = queryClient.getQueryData<Set<string>>(recipeKeys.favorites);
      const next = new Set(previous);
      if (favorite) next.add(recipeId);
      else next.delete(recipeId);
      queryClient.setQueryData(recipeKeys.favorites, next);
      return { previous };
    },
    onError: (_error, _vars, context) => queryClient.setQueryData(recipeKeys.favorites, context?.previous),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: recipeKeys.favorites });
      void queryClient.invalidateQueries({ queryKey: ['recipes', 'list'] });
    },
  });
}
