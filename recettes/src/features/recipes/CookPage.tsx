import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Icon } from '@/components/Icon';
import { Button, ErrorBox, Spinner } from '@/components/ui';
import { formatIngredient } from '@/lib/ingredients';
import { errorMessage } from '@/lib/supabase';
import { useRecipe } from './api';

/**
 * Mode cuisine : une étape à la fois en grand, les ingrédients à cocher, et
 * l'écran qui reste allumé (les mains pleines de farine ne déverrouillent pas un téléphone).
 */
export function CookPage() {
  const { id = '' } = useParams();
  const { data: recipe, isPending, error } = useRecipe(id);
  const [step, setStep] = useState(0);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [showIngredients, setShowIngredients] = useState(false);
  const awake = useWakeLock();

  if (isPending) return <Spinner />;
  if (error) return <ErrorBox>{errorMessage(error)}</ErrorBox>;

  const total = recipe.steps.length;
  const toggle = (index: number) => {
    const next = new Set(checked);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setChecked(next);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-[#16202b] text-[#eef2f5]">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between gap-3">
          <Link to={`/recettes/${recipe.id}`} aria-label="Quitter le mode cuisine" className="flex size-11 items-center justify-center rounded-full bg-[#243241]">
            <Icon name="close" size={20} />
          </Link>
          <span className="font-mono text-xs uppercase tracking-[0.08em] text-[#9aa6b1]">{awake ? 'Écran toujours allumé' : recipe.title}</span>
        </header>

        <div className="flex flex-col gap-2">
          <span className="font-mono text-sm text-[#8db8e6]">
            Étape {step + 1} sur {total}
          </span>
          <div className="flex gap-1.5" aria-hidden="true">
            {recipe.steps.map((_, index) => (
              <span key={index} className={`h-1.5 flex-1 rounded-full ${index <= step ? 'bg-[#8db8e6]' : 'bg-[#2c3a4a]'}`} />
            ))}
          </div>
        </div>

        <p className="flex-1 text-[27px] leading-[1.45]" aria-live="polite">
          {recipe.steps[step]}
        </p>

        {recipe.ingredients.length > 0 && (
          <section className="flex flex-col gap-3 rounded-2xl bg-[#1f2b38] p-4">
            <button type="button" onClick={() => setShowIngredients(!showIngredients)} className="flex items-center justify-between font-mono text-xs uppercase tracking-[0.08em] text-[#9aa6b1]" aria-expanded={showIngredients}>
              Ingrédients · {checked.size}/{recipe.ingredients.length}
              <span>{showIngredients ? 'Masquer' : 'Afficher'}</span>
            </button>
            {showIngredients && (
              <ul className="flex flex-col gap-2">
                {recipe.ingredients.map((ingredient, index) => {
                  const { amount, name } = formatIngredient(ingredient);
                  return (
                    <li key={index}>
                      <label className={`flex min-h-10 items-center gap-3 text-lg ${checked.has(index) ? 'text-[#9aa6b1] line-through' : ''}`}>
                        <input type="checkbox" checked={checked.has(index)} onChange={() => toggle(index)} className="size-5 accent-[#8db8e6]" />
                        {[amount, name].filter(Boolean).join(' ')}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="min-h-15 bg-[#243241] text-[#eef2f5]">
            Précédente
          </Button>
          {step < total - 1 ? (
            <Button onClick={() => setStep(step + 1)} className="min-h-15 bg-[#8db8e6] text-[#16202b]">
              Suivante
            </Button>
          ) : (
            <Link to={`/recettes/${recipe.id}#avis`} className="flex min-h-15 items-center justify-center rounded-2xl bg-[#9ccb8b] font-display font-bold text-[#16202b]">
              Terminé !
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/** Empêche l'écran de se mettre en veille tant que la page est affichée (si le navigateur le permet). */
function useWakeLock(): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
        if (cancelled) await lock.release();
        else setActive(true);
        lock.addEventListener('release', () => setActive(false));
      } catch {
        setActive(false);
      }
    };
    // Le verrou saute quand on change d'onglet : on le reprend au retour.
    const onVisible = () => document.visibilityState === 'visible' && void request();
    if ('wakeLock' in navigator) {
      void request();
      document.addEventListener('visibilitychange', onVisible);
    }
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, []);
  return active;
}
