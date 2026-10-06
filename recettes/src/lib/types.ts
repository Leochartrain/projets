// Types métier plus précis que ceux générés depuis la base : Postgres ne transforme
// pas les contraintes `check (… in (…))` en types, on les lit donc ici avec vérification.

export const MEMBER_ROLES = ['admin', 'member'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const RECIPE_CATEGORIES = ['apero', 'entree', 'plat', 'accompagnement', 'dessert', 'boisson', 'autre'] as const;
export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];

export function asRole(value: string): MemberRole {
  return value === 'admin' ? 'admin' : 'member';
}

export function asCategory(value: string | null): RecipeCategory | null {
  return RECIPE_CATEGORIES.find((category) => category === value) ?? null;
}
