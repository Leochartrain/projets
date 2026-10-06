import * as z from 'zod/mini';

/** Nombre facultatif saisi au clavier : vide → null, « 1,5 » → 1.5. */
const optionalNumber = (max: number) =>
  z
    .pipe(
      z.string(),
      z.transform((value) => (value.trim() === '' ? null : Number(value.trim().replace(',', '.')))),
    )
    .check(z.refine((value) => value === null || (Number.isFinite(value) && value >= 0 && value <= max), 'Nombre invalide'));

/** Champs du formulaire de recette qui demandent une vérification (les autres sont du texte libre). */
export const recipeFormSchema = z.object({
  title: z.string().check(z.trim(), z.minLength(1, 'Donne un titre à la recette'), z.maxLength(120)),
  servings: optionalNumber(1000),
  prepMinutes: optionalNumber(10000),
  cookMinutes: optionalNumber(10000),
});
