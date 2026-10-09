import type { Rng } from './rng.ts';

/**
 * Deux gènes par animal, chacun avec deux allèles (un de chaque parent).
 *
 * Couleur, du plus dominant au plus récessif :
 *   G doré (n'apparaît que par mutation) > N normal > v variante > a albinos.
 * Motif : T tacheté (dominant) > t uni.
 *
 * Un animal « normal » peut donc porter en secret un allèle v ou a, que l'élevage révèle.
 */
export type ColorAllele = 'G' | 'N' | 'v' | 'a';
export type PatternAllele = 'T' | 't';

export interface Genotype {
  color: [ColorAllele, ColorAllele];
  pattern: [PatternAllele, PatternAllele];
}

export type Coat = 'dore' | 'normal' | 'variante' | 'albinos';

export interface Phenotype {
  coat: Coat;
  spotted: boolean;
}

/** Probabilité qu'un allèle de couleur transmis mute en doré. */
export const MUTATION_RATE = 0.02;

const DOMINANCE: readonly ColorAllele[] = ['G', 'N', 'v', 'a'];
const COAT_OF: Record<ColorAllele, Coat> = { G: 'dore', N: 'normal', v: 'variante', a: 'albinos' };

export const COATS: readonly Coat[] = ['normal', 'variante', 'albinos', 'dore'];

/** Multiplicateur d'attraction (et de prix de revente) selon la rareté. */
const COAT_RARITY: Record<Coat, number> = { normal: 1, variante: 1.5, albinos: 2.5, dore: 5 };
const SPOTTED_RARITY = 1.2;

export function phenotype(g: Genotype): Phenotype {
  const best = DOMINANCE.find((allele) => g.color.includes(allele))!;
  return { coat: COAT_OF[best], spotted: g.pattern.includes('T') };
}

export function rarity(p: Phenotype): number {
  return COAT_RARITY[p.coat] * (p.spotted ? SPOTTED_RARITY : 1);
}

/** Clé d'une entrée du bestiaire, par exemple « lapin:albinos:1 ». */
export function phenotypeKey(species: string, p: Phenotype): string {
  return `${species}:${p.coat}:${p.spotted ? 1 : 0}`;
}

/** Le petit reçoit un allèle au hasard de chaque parent, pour chaque gène. */
export function cross(mother: Genotype, father: Genotype, rng: Rng): Genotype {
  const inherit = (allele: ColorAllele): ColorAllele => (rng.chance(MUTATION_RATE) ? 'G' : allele);
  return {
    color: [inherit(rng.pick(mother.color)), inherit(rng.pick(father.color))],
    pattern: [rng.pick(mother.pattern), rng.pick(father.pattern)],
  };
}

/** Génotype d'un animal acheté : surtout normal, mais parfois porteur d'un allèle rare. */
export function randomGenotype(rng: Rng): Genotype {
  const color = (): ColorAllele => {
    const r = rng.next();
    return r < 0.7 ? 'N' : r < 0.94 ? 'v' : 'a';
  };
  const pattern = (): PatternAllele => (rng.chance(0.2) ? 'T' : 't');
  return { color: [color(), color()], pattern: [pattern(), pattern()] };
}

export function genotypeLabel(g: Genotype): string {
  return `${g.color.join('')} · ${g.pattern.join('')}`;
}
