import { useDeferredValue, useState } from 'react';
import { Link } from 'react-router';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/layout';
import { ButtonLink, EmptyState } from '@/components/ui';
import { useMyGroups } from '@/features/groups/api';
import { useProfile } from '@/features/profile/api';
import type { RecipeFilter } from './api';
import { RecipeList } from './RecipeList';

/** Accueil : recherche, filtres (tout, un groupe, mes brouillons) et recettes récentes. */
export function HomePage() {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [filter, setFilter] = useState<RecipeFilter>({ kind: 'all' });
  const { data: groups } = useMyGroups();
  const { data: profile } = useProfile();

  const chips: { key: string; label: string; filter: RecipeFilter }[] = [
    { key: 'all', label: 'Tout', filter: { kind: 'all' } },
    ...(groups ?? []).map((g) => ({ key: g.id, label: g.name, filter: { kind: 'group' as const, groupId: g.id } })),
    { key: 'drafts', label: 'Mes brouillons', filter: { kind: 'drafts' } },
  ];
  const activeKey = filter.kind === 'group' ? filter.groupId : filter.kind;

  return (
    <Screen>
      <header className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="label">{profile ? `Bonjour ${profile.display_name}` : 'Bonjour'}</span>
          <h1 className="text-3xl">Carnet de famille</h1>
        </div>
      </header>

      <label className="flex h-12 items-center gap-3 rounded-xl border border-field bg-card px-4 focus-within:border-accent">
        <Icon name="search" size={18} className="text-muted" />
        <span className="sr-only">Rechercher</span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Une recette, un ingrédient…"
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted/70"
        />
      </label>

      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]" role="tablist" aria-label="Filtrer les recettes">
        {chips.map((chip) => (
          <button
            key={chip.key}
            role="tab"
            type="button"
            aria-selected={chip.key === activeKey}
            onClick={() => setFilter(chip.filter)}
            className={`h-10 shrink-0 rounded-full px-4 font-display text-sm font-medium transition ${
              chip.key === activeKey ? 'bg-ink text-paper' : chip.key === 'drafts' ? 'bg-line/70 text-muted' : 'bg-accent-soft text-accent'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <RecipeList
        filter={filter}
        search={deferredSearch}
        empty={
          filter.kind === 'drafts' ? (
            <EmptyState title="Aucun brouillon">Les recettes que tu ne partages avec aucun groupe apparaissent ici.</EmptyState>
          ) : (
            <EmptyState title="Ton carnet est vide">
              <div className="flex flex-col items-center gap-4">
                <p>Ajoute ta première recette, ou rejoins le groupe de ta famille pour voir les siennes.</p>
                <ButtonLink to="/groupes" variant="secondary">
                  Voir les groupes
                </ButtonLink>
              </div>
            </EmptyState>
          )
        }
      />

      <Link
        to="/recettes/ajouter"
        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-5 z-10 flex h-14 items-center gap-2 rounded-full bg-accent px-6 font-display text-base font-bold text-accent-ink shadow-lg shadow-accent/30"
      >
        <Icon name="plus" />
        Ajouter
      </Link>
    </Screen>
  );
}
