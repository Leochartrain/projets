import { getCollection, type CollectionEntry } from 'astro:content';
import { CATEGORIES } from '../config';

export type Recette = CollectionEntry<'recettes'>;

/** Toutes les recettes, la plus récente d'abord. */
export async function getRecettes(): Promise<Recette[]> {
  const all = await getCollection('recettes');
  return all.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

/** Les catégories qui contiennent au moins une recette, dans l'ordre de la carte. */
export function categoriesUtilisees(recettes: Recette[]) {
  return CATEGORIES.map((c) => ({ ...c, count: recettes.filter((r) => r.data.categorie === c.slug).length })).filter(
    (c) => c.count > 0,
  );
}

export function categorie(slug: string) {
  return CATEGORIES.find((c) => c.slug === slug)!;
}

/** 95 → « 1 h 35 », 30 → « 30 min ». */
export function duree(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

/** Durée au format ISO 8601 attendu par Google (PT1H35M). */
export function dureeIso(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `PT${h ? `${h}H` : ''}${m || !h ? `${m}M` : ''}`;
}

export function tempsTotal(r: Recette): number {
  const t = r.data.temps;
  return t.preparation + t.cuisson + t.repos;
}

export { normaliser } from './texte';
