import { Link } from 'react-router';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/layout';

/** Choix entre scanner des fiches et écrire une recette. */
export function AddRecipePage() {
  return (
    <Screen title="Ajouter une recette" back="/">
      <div aria-disabled="true" className="flex flex-col gap-3 rounded-3xl bg-accent/85 p-6 text-accent-ink">
        <span className="flex size-13 items-center justify-center rounded-2xl bg-accent-ink/15">
          <Icon name="scan" size={28} />
        </span>
        <h2 className="text-2xl">Scanner des fiches</h2>
        <p className="opacity-90">Prends en photo une ou plusieurs fiches, même écrites à la main. Tu relis chaque recette avant de l'enregistrer.</p>
        <span className="self-start rounded-lg bg-accent-ink/15 px-3 py-1.5 font-mono text-xs">Bientôt disponible</span>
      </div>

      <Link to="/recettes/nouvelle" className="flex flex-col gap-3 rounded-3xl border border-line bg-card p-6 transition hover:border-accent">
        <span className="flex size-13 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <Icon name="pen" size={26} />
        </span>
        <h2 className="text-xl">Écrire la recette</h2>
        <p className="text-muted">Pour une recette que tu connais par cœur, ou pour la peaufiner avant de la partager.</p>
      </Link>

      <p className="flex items-start gap-3 rounded-2xl bg-basil-soft p-4 text-basil">
        <Icon name="lock" className="mt-0.5 shrink-0" />
        <span>
          Une nouvelle recette est <strong>visible par toi seul</strong>. Tu choisis ensuite avec quels groupes la partager.
        </span>
      </p>
    </Screen>
  );
}
