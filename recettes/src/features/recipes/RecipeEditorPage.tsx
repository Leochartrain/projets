import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/layout';
import { Button, ErrorBox, Spinner, TextArea, TextField } from '@/components/ui';
import { useUserId } from '@/features/auth/AuthProvider';
import { useMyGroups } from '@/features/groups/api';
import type { RecipeCategory } from '@/lib/types';
import { CATEGORIES } from '@/lib/format';
import { ingredientToLine, parseIngredient } from '@/lib/ingredients';
import { errorMessage } from '@/lib/supabase';
import { useDeleteRecipe, useRecipe, useSaveRecipe, type Recipe } from './api';
import { recipeFormSchema } from './form';
import { PhotoPicker } from './PhotoPicker';

/** Nouvelle recette (/recettes/nouvelle) ou modification (/recettes/:id/modifier, auteur seulement). */
export function RecipeEditorPage() {
  const { id } = useParams();
  const userId = useUserId();
  const { data: recipe, isPending, error } = useRecipe(id ?? '', Boolean(id));
  if (!id) return <RecipeForm />;
  if (isPending) return <Spinner />;
  if (error) return <ErrorBox>{errorMessage(error)}</ErrorBox>;
  if (recipe.authorId !== userId) return <ErrorBox>Seul l'auteur peut modifier cette recette.</ErrorBox>;
  return <RecipeForm key={recipe.id} recipe={recipe} />;
}

function RecipeForm({ recipe }: { recipe?: Recipe }) {
  const navigate = useNavigate();
  const save = useSaveRecipe(recipe?.id);
  const remove = useDeleteRecipe();
  const { data: groups } = useMyGroups();

  const [title, setTitle] = useState(recipe?.title ?? '');
  const [passedDownBy, setPassedDownBy] = useState(recipe?.passedDownBy ?? '');
  const [story, setStory] = useState(recipe?.story ?? '');
  const [category, setCategory] = useState<RecipeCategory | null>(recipe?.category ?? null);
  const [servings, setServings] = useState(recipe?.servings ? String(recipe.servings).replace('.', ',') : '');
  const [servingsLabel, setServingsLabel] = useState(recipe?.servingsLabel ?? '');
  const [prep, setPrep] = useState(recipe?.prepMinutes ? String(recipe.prepMinutes) : '');
  const [cook, setCook] = useState(recipe?.cookMinutes ? String(recipe.cookMinutes) : '');
  const [ingredients, setIngredients] = useState<string[]>(recipe ? [...recipe.ingredients.map(ingredientToLine), ''] : ['', '', '']);
  const [steps, setSteps] = useState<string[]>(recipe ? [...recipe.steps, ''] : ['']);
  const [photoPaths, setPhotoPaths] = useState(recipe?.photoPaths ?? []);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [originalPaths, setOriginalPaths] = useState(recipe?.originalPaths ?? []);
  const [newOriginals, setNewOriginals] = useState<File[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>(recipe?.groups.map((g) => g.id) ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = recipeFormSchema.safeParse({ title, servings, prepMinutes: prep, cookMinutes: cook });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])));
      return;
    }
    setErrors({});
    const id = await save.mutateAsync({
      ...parsed.data,
      passedDownBy,
      story,
      category,
      servingsLabel,
      ingredients: ingredients.map((line) => line.trim()).filter(Boolean).map(parseIngredient),
      steps,
      photoPaths,
      newPhotos,
      originalPaths,
      newOriginals,
      groupIds,
    });
    navigate(`/recettes/${id}`, { replace: true });
  }

  async function destroy() {
    if (!recipe) return;
    await remove.mutateAsync(recipe);
    navigate('/', { replace: true });
  }

  /** Une liste de lignes éditables qui garde toujours une ligne vide à la fin. */
  const editLine = (list: string[], setList: (next: string[]) => void, index: number, value: string) => {
    const next = list.map((line, i) => (i === index ? value : line));
    if (index === next.length - 1 && value.trim()) next.push('');
    setList(next);
  };

  return (
    <Screen title={recipe ? 'Modifier la recette' : 'Nouvelle recette'} back={recipe ? `/recettes/${recipe.id}` : '/recettes/ajouter'}>
      <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
        <TextField label="Titre" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Les cookies de Bertrand" maxLength={120} error={errors.title} required />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Transmis par" value={passedDownBy} onChange={(e) => setPassedDownBy(e.target.value)} placeholder="Mamie Jeanne" maxLength={60} />
          <label className="flex flex-col gap-1.5">
            <span className="label">Catégorie</span>
            <select
              value={category ?? ''}
              onChange={(e) => setCategory((e.target.value || null) as RecipeCategory | null)}
              className="h-12 rounded-xl border border-field bg-card px-3 text-base"
            >
              <option value="">—</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <TextField label="Pour" inputMode="decimal" value={servings} onChange={(e) => setServings(e.target.value)} placeholder="4" error={errors.servings} />
          <TextField label="Unité" value={servingsLabel} onChange={(e) => setServingsLabel(e.target.value)} placeholder="personnes" maxLength={30} />
          <TextField label="Prépa (min)" inputMode="numeric" value={prep} onChange={(e) => setPrep(e.target.value)} placeholder="15" error={errors.prepMinutes} />
          <TextField label="Cuisson (min)" inputMode="numeric" value={cook} onChange={(e) => setCook(e.target.value)} placeholder="10" error={errors.cookMinutes} />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="label mb-2">Ingrédients</legend>
          {ingredients.map((line, index) => (
            <input
              key={index}
              aria-label={`Ingrédient ${index + 1}`}
              value={line}
              onChange={(e) => editLine(ingredients, setIngredients, index, e.target.value)}
              placeholder={index === 0 ? '200 g de chocolat noir' : index === 1 ? '3 œufs' : 'Un ingrédient par ligne'}
              className="h-12 rounded-xl border border-field bg-card px-4 text-base focus:border-accent focus:outline-none"
            />
          ))}
          <p className="text-sm text-muted">Écris-les comme d'habitude : la quantité et l'unité sont reconnues toutes seules.</p>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="label mb-2">Étapes</legend>
          {steps.map((step, index) => (
            <div key={index} className="flex gap-3">
              <span className="mt-3 flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-accent font-display text-sm font-bold text-accent">{index + 1}</span>
              <textarea
                aria-label={`Étape ${index + 1}`}
                value={step}
                onChange={(e) => editLine(steps, setSteps, index, e.target.value)}
                rows={2}
                placeholder={index === 0 ? 'Préchauffer le four à 180 °C.' : 'Étape suivante'}
                className="min-h-14 flex-1 rounded-xl border border-field bg-card px-4 py-3 text-base leading-relaxed focus:border-accent focus:outline-none"
              />
            </div>
          ))}
        </fieldset>

        <TextArea label="Anecdote" value={story} onChange={(e) => setStory(e.target.value)} maxLength={2000} placeholder="Le goûter de tous les mercredis chez mamie." />

        <PhotoPicker label="Photos du plat" hint="La première sert de couverture." paths={photoPaths} files={newPhotos} onPathsChange={setPhotoPaths} onFilesChange={setNewPhotos} />
        <PhotoPicker
          label="Fiche d'origine"
          hint="La photo de la recette écrite à la main, gardée telle quelle."
          paths={originalPaths}
          files={newOriginals}
          onPathsChange={setOriginalPaths}
          onFilesChange={setNewOriginals}
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="label mb-2">Partager avec · aucun coché = toi seul</legend>
          {groups?.length === 0 && <p className="text-sm text-muted">Tu ne fais encore partie d'aucun groupe : la recette restera dans tes brouillons.</p>}
          {groups?.map((group) => {
            const checked = groupIds.includes(group.id);
            return (
              <label key={group.id} className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border bg-card px-4 ${checked ? 'border-accent' : 'border-field'}`}>
                {group.name}
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => setGroupIds(checked ? groupIds.filter((g) => g !== group.id) : [...groupIds, group.id])}
                  className="size-5 accent-accent"
                />
              </label>
            );
          })}
        </fieldset>

        {save.error && <ErrorBox>{errorMessage(save.error)}</ErrorBox>}
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Enregistrement…' : recipe ? 'Enregistrer' : 'Ajouter la recette'}
        </Button>

        {recipe && (
          <div className="flex flex-col gap-3 border-t border-line pt-6">
            {confirmDelete ? (
              <>
                <p>Supprimer « {recipe.title} » pour tout le monde ? Ses photos et ses avis seront supprimés aussi.</p>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                    Annuler
                  </Button>
                  <Button variant="danger" onClick={destroy} disabled={remove.isPending}>
                    Supprimer
                  </Button>
                </div>
              </>
            ) : (
              <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                <Icon name="trash" size={18} />
                Supprimer la recette
              </Button>
            )}
          </div>
        )}
      </form>
    </Screen>
  );
}
