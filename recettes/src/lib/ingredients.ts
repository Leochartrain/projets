/** Un ingrédient tel qu'il est enregistré : « 200 g chocolat noir » → { 200, "g", "chocolat noir" }. */
export interface Ingredient {
  quantity: number | null;
  unit: string | null;
  name: string;
}

/** Unités reconnues, avec leurs façons courantes de les écrire (forme normalisée en premier). */
const UNITS: [canonical: string, ...aliases: string[]][] = [
  ['kg', 'kilo', 'kilos', 'kilogramme', 'kilogrammes'],
  ['g', 'gr', 'gramme', 'grammes'],
  ['mg'],
  ['l', 'litre', 'litres'],
  ['dl'],
  ['cl'],
  ['ml'],
  ['c. à soupe', 'c. a soupe', 'c.à.s', 'càs', 'cas', 'cs', 'cuillère à soupe', 'cuillères à soupe', 'cuillere a soupe', 'c à soupe'],
  ['c. à café', 'c. a cafe', 'c.à.c', 'càc', 'cac', 'cc', 'cuillère à café', 'cuillères à café', 'cuillere a cafe', 'c à café'],
  ['pincée', 'pincées', 'pincee'],
  ['sachet', 'sachets'],
  ['pot', 'pots'],
  ['verre', 'verres'],
  ['tasse', 'tasses'],
  ['bol', 'bols'],
  ['gousse', 'gousses'],
  ['tranche', 'tranches'],
  ['brin', 'brins'],
  ['botte', 'bottes'],
  ['boîte', 'boîtes', 'boite', 'boites'],
  ['noix'],
  ['filet', 'filets'],
];

const ALIASES = UNITS.flatMap(([canonical, ...aliases]) => [canonical, ...aliases].map((alias) => ({ alias, canonical })))
  // Les plus longues d'abord : « c. à soupe » avant « c ».
  .sort((a, b) => b.alias.length - a.alias.length);

const FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };

/**
 * Lit une ligne d'ingrédient écrite naturellement : « 200 g de chocolat noir »,
 * « 1/2 c. à soupe de sucre », « 1,5 l lait », « 3 œufs », « sel ».
 */
export function parseIngredient(line: string): Ingredient {
  let rest = line.trim().replace(/\s+/g, ' ');
  let quantity: number | null = null;

  // Quantité : entier, décimal (virgule ou point), fraction « 1/2 », « 1 1/2 » ou « ½ ».
  const match = rest.match(/^(\d+(?:[.,]\d+)?)(?:\s+(\d+)\/(\d+))?(?:\/(\d+))?\s*([½¼¾⅓⅔])?/) ?? rest.match(/^([½¼¾⅓⅔])/);
  if (match && match[0].trim()) {
    const [whole, first, fracNum, fracDen, slashDen, glyph] = match;
    if (first && FRACTIONS[first] !== undefined) {
      quantity = FRACTIONS[first];
    } else if (first) {
      quantity = Number(first.replace(',', '.'));
      if (slashDen) quantity /= Number(slashDen);
      if (fracNum && fracDen) quantity += Number(fracNum) / Number(fracDen);
      if (glyph) quantity += FRACTIONS[glyph] ?? 0;
    }
    rest = rest.slice(whole.length).trim();
  }

  // Unité, collée ou non au nombre (« 200g »), suivie d'une espace ou de « de ».
  let unit: string | null = null;
  const lower = rest.toLowerCase();
  for (const { alias, canonical } of ALIASES) {
    if (!lower.startsWith(alias)) continue;
    const after = rest.slice(alias.length);
    if (after === '' || /^[\s.,]/.test(after)) {
      unit = canonical;
      rest = after.replace(/^[.,]?\s*/, '');
      break;
    }
  }

  // « de chocolat », « d'huile » : l'article ne fait pas partie du nom.
  if (quantity !== null || unit !== null) rest = rest.replace(/^(de |d'|d’)/i, '');
  return { quantity, unit, name: rest.trim() };
}

/** Écriture lisible d'une quantité : 0,5 → « ½ », 1,25 → « 1 ¼ », 1,3 → « 1,3 ». */
export function formatQuantity(quantity: number): string {
  const whole = Math.floor(quantity + 1e-9);
  const fraction = quantity - whole;
  const glyph = Object.entries(FRACTIONS).find(([, value]) => Math.abs(value - fraction) < 0.01)?.[0];
  if (glyph) return whole > 0 ? `${whole} ${glyph}` : glyph;
  const rounded = Math.round(quantity * 100) / 100;
  return String(rounded).replace('.', ',');
}

/** Ligne affichée : « 200 g chocolat noir », « 3 œufs », « sel ». */
export function formatIngredient(ingredient: Ingredient): { amount: string; name: string } {
  const amount = [ingredient.quantity !== null ? formatQuantity(ingredient.quantity) : '', ingredient.unit ?? '']
    .filter(Boolean)
    .join(' ');
  return { amount, name: ingredient.name };
}

/** Ligne éditable, l'inverse de parseIngredient. */
export function ingredientToLine(ingredient: Ingredient): string {
  const { amount, name } = formatIngredient(ingredient);
  return [amount, name].filter(Boolean).join(' ');
}

/** Lit la colonne JSON de la base sans faire confiance à son contenu. */
export function readIngredients(value: unknown): Ingredient[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const { quantity, unit, name } = item as Record<string, unknown>;
    if (typeof name !== 'string' || !name.trim()) return [];
    return [{ quantity: typeof quantity === 'number' && Number.isFinite(quantity) ? quantity : null, unit: typeof unit === 'string' && unit ? unit : null, name }];
  });
}

export function readSteps(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((step): step is string => typeof step === 'string' && step.trim() !== '') : [];
}
