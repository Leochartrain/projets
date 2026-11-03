// Affichage des quantités, partagé par la page (rendu initial) et le calcul des portions (navigateur).

const FRACTIONS: Record<number, string> = { 0.25: '¼', 0.5: '½', 0.75: '¾' };

/** Unités qu'on mesure à la cuillère ou à la pièce : arrondi au quart, affiché en fractions (1 ½). */
function enFractions(unite: string): boolean {
  return unite === '' || unite.startsWith('c.') || unite === 'feuille' || unite === 'feuilles';
}

/** Arrondit une quantité recalculée à quelque chose qu'on peut peser ou compter. */
export function arrondir(valeur: number, unite: string): number {
  if (enFractions(unite)) return Math.max(0.25, Math.round(valeur * 4) / 4);
  if (valeur >= 100) return Math.round(valeur / 5) * 5;
  if (valeur >= 10) return Math.round(valeur);
  return Math.max(0.5, Math.round(valeur * 2) / 2);
}

/** 1.5 → « 1 ½ » (pièces, cuillères) ou « 1,5 » (grammes). */
export function formater(valeur: number, unite: string): string {
  if (enFractions(unite)) {
    const entier = Math.floor(valeur);
    const reste = Math.round((valeur - entier) * 4) / 4;
    const frac = FRACTIONS[reste];
    if (!frac) return String(entier || 0);
    return entier ? `${entier} ${frac}` : frac;
  }
  return valeur.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
}

/** Quantité affichée pour un nombre de parts donné. */
export function quantitePour(base: number, unite: string, partsBase: number, parts: number): string {
  if (parts === partsBase) return formater(base, unite);
  return formater(arrondir((base * parts) / partsBase, unite), unite);
}
