import type { RecipeCategory } from './database.types';

export const CATEGORIES: { value: RecipeCategory; label: string }[] = [
  { value: 'apero', label: 'Apéro' },
  { value: 'entree', label: 'Entrée' },
  { value: 'plat', label: 'Plat' },
  { value: 'accompagnement', label: 'Accompagnement' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'boisson', label: 'Boisson' },
  { value: 'autre', label: 'Autre' },
];

export function categoryLabel(category: RecipeCategory | null): string | null {
  return CATEGORIES.find((c) => c.value === category)?.label ?? null;
}

/** 25 → « 25 min », 90 → « 1 h 30 », 120 → « 2 h ». */
export function formatDuration(minutes: number | null): string | null {
  if (minutes === null || minutes <= 0) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${String(rest).padStart(2, '0')}` : `${hours} h`;
}

export function totalDuration(prep: number | null, cook: number | null): string | null {
  const total = (prep ?? 0) + (cook ?? 0);
  return total > 0 ? formatDuration(total) : null;
}

/** 4,8 avec une virgule, comme en France. */
export function formatRating(rating: number): string {
  return rating.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function initials(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}
