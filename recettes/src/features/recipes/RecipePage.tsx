import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Icon } from '@/components/Icon';
import { ButtonLink, ErrorBox, Spinner } from '@/components/ui';
import { useUserId } from '@/features/auth/AuthProvider';
import { Reviews } from '@/features/reviews/Reviews';
import { averageRating, useReviews } from '@/features/reviews/api';
import { categoryLabel, formatDuration, formatRating } from '@/lib/format';
import { formatIngredient } from '@/lib/ingredients';
import { errorMessage } from '@/lib/supabase';
import { useFavoriteIds, usePhotoUrls, useRecipe, useToggleFavorite } from './api';

type Tab = 'ingredients' | 'steps' | 'original';

export function RecipePage() {
  const { id = '' } = useParams();
  const userId = useUserId();
  const { data: recipe, isPending, error } = useRecipe(id);
  const { data: urls } = usePhotoUrls(recipe ? [...recipe.photoPaths, ...recipe.originalPaths] : []);
  const { data: favorites } = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();
  const { data: reviews } = useReviews(id);
  const [tab, setTab] = useState<Tab>('ingredients');

  if (isPending) return <Spinner />;
  if (error) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4 p-5">
        <ErrorBox>{error.message.includes('0 rows') ? "Cette recette n'existe pas ou n'est pas partagée avec toi." : errorMessage(error)}</ErrorBox>
        <ButtonLink to="/" variant="secondary">
          Retour à l'accueil
        </ButtonLink>
      </div>
    );
  }

  const isAuthor = recipe.authorId === userId;
  const favorite = favorites?.has(recipe.id) ?? false;
  const cover = recipe.photoPaths[0] ? urls?.[recipe.photoPaths[0]] : undefined;
  const rating = reviews ? averageRating(reviews) : null;
  const facts = [
    { label: 'Pour', value: recipe.servings ? `${String(recipe.servings).replace('.', ',')} ${recipe.servingsLabel ?? 'personnes'}` : null },
    { label: 'Préparation', value: formatDuration(recipe.prepMinutes) },
    { label: 'Cuisson', value: formatDuration(recipe.cookMinutes) },
  ].filter((fact) => fact.value);
  const tabs: { key: Tab; label: string }[] = [
    { key: 'ingredients', label: 'Ingrédients' },
    { key: 'steps', label: 'Étapes' },
    ...(recipe.originalPaths.length > 0 ? [{ key: 'original' as const, label: "Fiche d'origine" }] : []),
  ];

  return (
    <article className="mx-auto w-full max-w-xl pb-32">
      <div className="relative h-64 bg-mustard-soft sm:rounded-b-3xl sm:overflow-hidden">
        {cover && <img src={cover} alt={`Photo : ${recipe.title}`} className="size-full object-cover" />}
        <div className="absolute inset-x-0 top-0 flex justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <Link to="/" aria-label="Retour" className="flex size-11 items-center justify-center rounded-full bg-card/90 backdrop-blur">
            <Icon name="back" size={20} />
          </Link>
          <div className="flex gap-2">
            {isAuthor && (
              <Link to={`/recettes/${recipe.id}/modifier`} aria-label="Modifier la recette" className="flex size-11 items-center justify-center rounded-full bg-card/90 backdrop-blur">
                <Icon name="pen" size={20} />
              </Link>
            )}
            <button
              type="button"
              aria-label={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              aria-pressed={favorite}
              onClick={() => toggleFavorite.mutate({ recipeId: recipe.id, favorite: !favorite })}
              className="flex size-11 items-center justify-center rounded-full bg-card/90 text-danger backdrop-blur"
            >
              <Icon name="heart" size={20} filled={favorite} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5 px-5 pt-5">
        <header className="flex flex-col gap-1.5">
          {categoryLabel(recipe.category) && <span className="label">{categoryLabel(recipe.category)}</span>}
          <h1 className="text-3xl leading-tight">{recipe.title}</h1>
          <p className="text-muted">
            {recipe.passedDownBy ? `Transmis par ${recipe.passedDownBy}` : `Recette de ${recipe.authorName}`}
            {recipe.passedDownBy && !isAuthor && ` · ajoutée par ${recipe.authorName}`}
          </p>
          {rating && (
            <a href="#avis" className="font-display font-semibold">
              ★ {formatRating(rating.average)} <span className="font-medium text-muted">· {rating.count} avis</span>
            </a>
          )}
        </header>

        {facts.length > 0 && (
          <dl className="grid grid-cols-3 gap-2">
            {facts.map((fact) => (
              <div key={fact.label} className="flex flex-col gap-1 rounded-xl border border-line bg-card p-3">
                <dt className="label">{fact.label}</dt>
                <dd className="font-display text-base font-bold">{fact.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {recipe.story && <blockquote className="border-l-2 border-accent pl-4 italic text-accent">« {recipe.story} »</blockquote>}

        <div role="tablist" className="flex gap-1 rounded-xl bg-line/60 p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`h-10 flex-1 rounded-lg font-display text-sm font-semibold ${tab === t.key ? 'bg-card shadow-sm' : 'text-muted'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'ingredients' && (
          <ul className="flex flex-col gap-2.5 text-[17px]">
            {recipe.ingredients.length === 0 && <li className="text-muted">Pas d'ingrédients notés.</li>}
            {recipe.ingredients.map((ingredient, index) => {
              const { amount, name } = formatIngredient(ingredient);
              return (
                <li key={index} className="flex gap-3">
                  <span className="w-24 shrink-0 font-mono text-sm leading-7 text-muted tabular-nums">{amount}</span>
                  <span>{name}</span>
                </li>
              );
            })}
          </ul>
        )}
        {tab === 'steps' && (
          <ol className="flex flex-col gap-4">
            {recipe.steps.length === 0 && <li className="text-muted">Pas d'étapes notées.</li>}
            {recipe.steps.map((step, index) => (
              <li key={index} className="flex gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-accent font-display font-bold text-accent">{index + 1}</span>
                <p className="pt-0.5 text-[17px] leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
        )}
        {tab === 'original' && (
          <div className="flex flex-col gap-3">
            {recipe.originalPaths.map((path) =>
              urls?.[path] ? (
                <a key={path} href={urls[path]} target="_blank" rel="noreferrer">
                  <img src={urls[path]} alt="Photo de la fiche d'origine" loading="lazy" className="w-full rounded-xl border border-line" />
                </a>
              ) : null,
            )}
          </div>
        )}

        <section className="flex flex-col gap-2">
          <span className="label">Visible par</span>
          <p className="flex flex-wrap gap-2">
            {recipe.groups.length === 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-basil-soft px-3 py-1.5 text-sm text-basil">
                <Icon name="lock" size={14} /> Toi seul
              </span>
            ) : (
              recipe.groups.map((group) => (
                <Link key={group.id} to={`/groupes/${group.id}`} className="rounded-full bg-accent-soft px-3 py-1.5 text-sm text-accent">
                  {group.name}
                </Link>
              ))
            )}
          </p>
        </section>

        <Reviews recipeId={recipe.id} groups={recipe.groups} isAuthor={isAuthor} />
      </div>

      {recipe.steps.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-paper/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <ButtonLink to={`/recettes/${recipe.id}/cuisiner`} className="mx-auto w-full max-w-xl">
            <Icon name="play" size={20} />
            Cuisiner
          </ButtonLink>
        </div>
      )}
    </article>
  );
}
