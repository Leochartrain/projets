import { Link } from 'react-router';
import { Icon } from '@/components/Icon';
import { categoryLabel, totalDuration } from '@/lib/format';
import type { RecipeSummary } from './api';

/** Carte d'une recette dans une liste : photo (ou couleur selon la catégorie), titre, origine, durée. */
export function RecipeCard({ recipe, photoUrl }: { recipe: RecipeSummary; photoUrl?: string }) {
  const meta = [categoryLabel(recipe.category), totalDuration(recipe.prepMinutes, recipe.cookMinutes)].filter(Boolean).join(' · ');
  return (
    <Link to={`/recettes/${recipe.id}`} className="flex gap-3 rounded-2xl border border-line bg-card p-2.5 transition hover:border-field">
      <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-mustard-soft">
        {photoUrl ? (
          <img src={photoUrl} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center font-display text-2xl font-bold text-mustard">{recipe.title.charAt(0)}</div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <span className="truncate font-display text-lg font-bold leading-tight">{recipe.title}</span>
        <span className="truncate text-sm text-muted">
          {recipe.passedDownBy ? `Transmis par ${recipe.passedDownBy}` : `Par ${recipe.authorName}`}
        </span>
        <span className="flex items-center gap-2 font-mono text-xs text-muted">
          {!recipe.shared && (
            <span className="inline-flex items-center gap-1 rounded-md bg-basil-soft px-1.5 py-0.5 text-basil">
              <Icon name="lock" size={12} />
              Brouillon
            </span>
          )}
          {meta}
        </span>
      </div>
    </Link>
  );
}
