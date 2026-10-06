import type { MoveId } from './moves.ts';
import type { Type } from './types.ts';

export type StatId = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';
export type Stats = Record<StatId, number>;
/** Courbes d'expérience de la 4e génération utilisées ici. */
export type GrowthRate = 'medium-fast' | 'medium-slow';

export interface Species {
  /** Numéro du Pokédex national (sert aussi à charger les sprites de Diamant et Perle). */
  id: number;
  name: string;
  types: Type[];
  base: Stats;
  /** Expérience de base de la 4e génération. */
  baseExp: number;
  /** Taux de capture (3 à 255 : plus c'est haut, plus c'est facile). */
  catchRate: number;
  growth: GrowthRate;
  /** Attaques apprises par niveau dans Diamant et Perle (jusqu'au niveau 16). */
  learnset: [level: number, move: MoveId][];
  /** Description du Pokédex, résumée. */
  entry: string;
}

export type SpeciesId = 'piplup' | 'starly' | 'bidoof' | 'kricketot' | 'shinx' | 'budew' | 'wurmple' | 'abra';

/** Statistiques, taux de capture et attaques officiels (PokeAPI), expérience de base de Diamant et Perle. */
export const SPECIES: Record<SpeciesId, Species> = {
  piplup: {
    id: 393, name: 'Tiplouf', types: ['water'], base: { hp: 53, atk: 51, def: 53, spa: 61, spd: 56, spe: 40 },
    baseExp: 63, catchRate: 45, growth: 'medium-slow',
    learnset: [[1, 'pound'], [4, 'growl'], [8, 'bubble'], [11, 'water-sport'], [15, 'peck']],
    entry: 'Très fier, il déteste accepter la nourriture des autres. Son épais duvet le protège du froid.',
  },
  starly: {
    id: 396, name: 'Étourmi', types: ['normal', 'flying'], base: { hp: 40, atk: 55, def: 30, spa: 30, spd: 30, spe: 60 },
    baseExp: 56, catchRate: 255, growth: 'medium-slow',
    learnset: [[1, 'tackle'], [1, 'growl'], [5, 'quick-attack'], [9, 'wing-attack'], [13, 'double-team']],
    entry: 'Ils vivent en grandes nuées. Seuls, ils sont faibles, mais leurs battements d\'ailes font beaucoup de bruit.',
  },
  bidoof: {
    id: 399, name: 'Keunotor', types: ['normal'], base: { hp: 59, atk: 45, def: 40, spa: 35, spd: 40, spe: 31 },
    baseExp: 58, catchRate: 255, growth: 'medium-fast',
    learnset: [[1, 'tackle'], [5, 'growl'], [9, 'defense-curl'], [13, 'rollout']],
    entry: 'Il ronge sans cesse des troncs et des pierres pour user ses incisives. Rien ne le perturbe.',
  },
  kricketot: {
    id: 401, name: 'Crikzik', types: ['bug'], base: { hp: 37, atk: 25, def: 41, spa: 25, spd: 41, spe: 25 },
    baseExp: 54, catchRate: 255, growth: 'medium-slow',
    learnset: [[1, 'growl'], [1, 'bide']],
    entry: 'Ses antennes s\'entrechoquent avec un bruit de xylophone. Il fait ce bruit toute la nuit.',
  },
  shinx: {
    id: 403, name: 'Lixy', types: ['electric'], base: { hp: 45, atk: 65, def: 34, spa: 40, spd: 34, spe: 45 },
    baseExp: 60, catchRate: 235, growth: 'medium-slow',
    learnset: [[1, 'tackle'], [5, 'leer'], [9, 'charge'], [13, 'bite']],
    entry: 'Tous les muscles de son corps produisent de l\'électricité. Il brille en cas de danger.',
  },
  budew: {
    id: 406, name: 'Rozbouton', types: ['grass', 'poison'], base: { hp: 40, atk: 30, def: 35, spa: 50, spd: 70, spe: 55 },
    baseExp: 68, catchRate: 255, growth: 'medium-slow',
    learnset: [[1, 'absorb'], [4, 'growth'], [7, 'water-sport'], [10, 'stun-spore'], [13, 'mega-drain']],
    entry: 'Il garde son bourgeon fermé tout l\'hiver. Au printemps, il s\'ouvre et répand son pollen.',
  },
  wurmple: {
    id: 265, name: 'Chenipotte', types: ['bug'], base: { hp: 45, atk: 45, def: 35, spa: 20, spd: 30, spe: 20 },
    baseExp: 56, catchRate: 255, growth: 'medium-fast',
    learnset: [[1, 'tackle'], [1, 'string-shot'], [5, 'poison-sting']],
    entry: 'Il se défend avec les épines de sa queue. Il se nourrit de feuilles en faisant attention aux Étourmi.',
  },
  abra: {
    id: 63, name: 'Abra', types: ['psychic'], base: { hp: 25, atk: 20, def: 15, spa: 105, spd: 55, spe: 90 },
    baseExp: 75, catchRate: 200, growth: 'medium-slow',
    learnset: [[1, 'teleport']],
    entry: 'Il dort 18 heures par jour. Au moindre danger, il se téléporte, même en dormant.',
  },
};

/** Expérience totale nécessaire pour atteindre un niveau. */
export function expForLevel(growth: GrowthRate, level: number): number {
  if (level <= 1) return 0;
  const n = level;
  if (growth === 'medium-fast') return n ** 3;
  // Moyenne-lente : 6/5 n³ − 15 n² + 100 n − 140.
  return Math.floor((6 / 5) * n ** 3 - 15 * n ** 2 + 100 * n - 140);
}

/** Les 25 natures : +10 % sur une statistique, −10 % sur une autre (ou neutre). */
export const NATURES: { name: string; up: StatId | null; down: StatId | null }[] = [
  { name: 'Hardi', up: null, down: null },
  { name: 'Solo', up: 'atk', down: 'def' },
  { name: 'Brave', up: 'atk', down: 'spe' },
  { name: 'Rigide', up: 'atk', down: 'spa' },
  { name: 'Mauvais', up: 'atk', down: 'spd' },
  { name: 'Assuré', up: 'def', down: 'atk' },
  { name: 'Docile', up: null, down: null },
  { name: 'Relax', up: 'def', down: 'spe' },
  { name: 'Malin', up: 'def', down: 'spa' },
  { name: 'Lâche', up: 'def', down: 'spd' },
  { name: 'Timide', up: 'spe', down: 'atk' },
  { name: 'Pressé', up: 'spe', down: 'def' },
  { name: 'Sérieux', up: null, down: null },
  { name: 'Jovial', up: 'spe', down: 'spa' },
  { name: 'Naïf', up: 'spe', down: 'spd' },
  { name: 'Modeste', up: 'spa', down: 'atk' },
  { name: 'Doux', up: 'spa', down: 'def' },
  { name: 'Discret', up: 'spa', down: 'spe' },
  { name: 'Pudique', up: null, down: null },
  { name: 'Foufou', up: 'spa', down: 'spd' },
  { name: 'Calme', up: 'spd', down: 'atk' },
  { name: 'Gentil', up: 'spd', down: 'def' },
  { name: 'Malpoli', up: 'spd', down: 'spe' },
  { name: 'Prudent', up: 'spd', down: 'spa' },
  { name: 'Bizarre', up: null, down: null },
];

export const STAT_NAMES: Record<StatId, string> = {
  hp: 'PV',
  atk: 'Attaque',
  def: 'Défense',
  spa: 'Atq. Spé.',
  spd: 'Déf. Spé.',
  spe: 'Vitesse',
};
