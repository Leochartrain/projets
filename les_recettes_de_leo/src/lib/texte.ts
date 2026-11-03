/** Minuscules sans accents, pour la recherche (utilisé au rendu et dans le navigateur). */
export function normaliser(texte: string): string {
  return texte.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}
