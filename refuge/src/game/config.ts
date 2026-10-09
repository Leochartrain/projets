import type { Coat } from './genetics.ts';

/**
 * Tout l'équilibrage du jeu est ici : coûts, durées, production.
 * Les durées sont en secondes et volontairement courtes (quelques minutes au plus)
 * pour que le jeu avance pendant qu'on le développe ; on les allongera plus tard.
 */

export const MAP_SIZE = 40;
export const MAX_TOWN_HALL = 5;

export type Resource = 'or' | 'nourriture';

export type BuildingType =
  | 'mairie'
  | 'cabane'
  | 'ferme'
  | 'billetterie'
  | 'enclos'
  | 'fleurs'
  | 'arbre'
  | 'fontaine';

export type BuildingCategory = 'base' | 'production' | 'animaux' | 'decor';

export interface LevelDef {
  cost: number;
  /** Durée de construction ou d'amélioration, en secondes (0 : immédiat). */
  time: number;
  /** Niveau de mairie nécessaire. */
  townHall: number;
  /** Ferme et billetterie : production par heure. */
  rate?: number;
  /** Ferme et billetterie : stock maximal avant de collecter. Enclos : nombre d'animaux. */
  capacity?: number;
  /** Mairie : stockage maximal d'or et de nourriture. */
  storage?: Record<Resource, number>;
}

export interface BuildingDef {
  name: string;
  description: string;
  category: BuildingCategory;
  /** Côté de l'emprise au sol, en cases. */
  size: number;
  levels: LevelDef[];
  /** Nombre maximal selon le niveau de mairie (index 0 = mairie niveau 1). */
  maxCount: number[];
  /** Les décorations se posent sans bâtisseur ni attente. */
  instant?: boolean;
  /** Bonus de bonheur donné aux enclos proches (décorations). */
  happiness?: number;
}

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  mairie: {
    name: 'Mairie',
    description: 'Le cœur du refuge. L’améliorer débloque de nouveaux bâtiments et animaux, et agrandit les réserves.',
    category: 'base',
    size: 4,
    maxCount: [1, 1, 1, 1, 1],
    levels: [
      { cost: 0, time: 0, townHall: 0, storage: { or: 2000, nourriture: 1500 } },
      { cost: 1500, time: 60, townHall: 1, storage: { or: 6000, nourriture: 4000 } },
      { cost: 5000, time: 600, townHall: 2, storage: { or: 15000, nourriture: 10000 } },
      { cost: 14000, time: 1800, townHall: 3, storage: { or: 40000, nourriture: 25000 } },
      { cost: 35000, time: 3600, townHall: 4, storage: { or: 100000, nourriture: 60000 } },
    ],
  },
  cabane: {
    name: 'Cabane de bâtisseur',
    description: 'Chaque cabane loge un bâtisseur. Un bâtisseur ne mène qu’un chantier à la fois.',
    category: 'base',
    size: 2,
    maxCount: [1, 2, 2, 3, 3],
    // Le prix dépend du nombre de cabanes déjà construites (voir CABANE_COSTS).
    levels: [{ cost: 0, time: 0, townHall: 1 }],
  },
  ferme: {
    name: 'Ferme',
    description: 'Fait pousser la nourriture des animaux. Pense à venir la récolter.',
    category: 'production',
    size: 3,
    maxCount: [1, 2, 2, 3, 4],
    levels: [
      { cost: 150, time: 10, townHall: 1, rate: 400, capacity: 500 },
      { cost: 400, time: 60, townHall: 1, rate: 600, capacity: 1000 },
      { cost: 1200, time: 300, townHall: 2, rate: 900, capacity: 2000 },
      { cost: 4000, time: 900, townHall: 3, rate: 1300, capacity: 4000 },
      { cost: 10000, time: 1800, townHall: 4, rate: 1800, capacity: 8000 },
    ],
  },
  billetterie: {
    name: 'Billetterie',
    description: 'Les visiteurs paient leur entrée ici. Plus tes animaux sont nombreux, rares et heureux, plus elle rapporte.',
    category: 'production',
    size: 2,
    maxCount: [1, 2, 2, 3, 3],
    levels: [
      { cost: 150, time: 10, townHall: 1, rate: 250, capacity: 500 },
      { cost: 500, time: 60, townHall: 1, rate: 350, capacity: 1200 },
      { cost: 1500, time: 300, townHall: 2, rate: 500, capacity: 3000 },
      { cost: 5000, time: 900, townHall: 3, rate: 700, capacity: 6000 },
      { cost: 12000, time: 1800, townHall: 4, rate: 1000, capacity: 12000 },
    ],
  },
  enclos: {
    name: 'Enclos',
    description: 'Accueille des animaux d’une seule espèce. Mets un mâle et une femelle adultes ensemble pour avoir des petits.',
    category: 'animaux',
    size: 4,
    maxCount: [2, 3, 4, 5, 6],
    levels: [
      { cost: 300, time: 15, townHall: 1, capacity: 4 },
      { cost: 800, time: 120, townHall: 2, capacity: 6 },
      { cost: 2500, time: 600, townHall: 3, capacity: 8 },
      { cost: 7000, time: 1200, townHall: 4, capacity: 10 },
      { cost: 18000, time: 2400, townHall: 5, capacity: 12 },
    ],
  },
  fleurs: {
    name: 'Massif de fleurs',
    description: 'Rend les animaux des enclos voisins un peu plus heureux.',
    category: 'decor',
    size: 1,
    maxCount: [10, 20, 30, 40, 50],
    instant: true,
    happiness: 0.05,
    levels: [{ cost: 50, time: 0, townHall: 1 }],
  },
  arbre: {
    name: 'Chêne',
    description: 'De l’ombre pour les enclos voisins.',
    category: 'decor',
    size: 1,
    maxCount: [5, 10, 15, 20, 25],
    instant: true,
    happiness: 0.08,
    levels: [{ cost: 100, time: 0, townHall: 1 }],
  },
  fontaine: {
    name: 'Fontaine',
    description: 'Un vrai spectacle : les enclos voisins sont bien plus heureux.',
    category: 'decor',
    size: 2,
    maxCount: [0, 0, 1, 2, 3],
    instant: true,
    happiness: 0.15,
    levels: [{ cost: 1500, time: 0, townHall: 3 }],
  },
};

/** Prix de la 1re, 2e et 3e cabane (la première est offerte au départ). */
export const CABANE_COSTS = [0, 2000, 10000];

/** Distance (en cases, autour de l'enclos) à laquelle une décoration rend les animaux heureux. */
export const DECOR_RANGE = 2;
/** Bonheur d'un enclos sans décoration, et maximum. */
export const BASE_HAPPINESS = 0.7;
export const MAX_HAPPINESS = 1;
/** Les animaux affamés attirent moitié moins de visiteurs. */
export const HUNGRY_FACTOR = 0.5;
/** Un petit attire et mange moitié moins qu'un adulte. */
export const BABY_FACTOR = 0.5;

export type Species = 'lapin' | 'mouton' | 'cochon' | 'renard' | 'cerf' | 'panda';

export interface CoatColors {
  body: string;
  belly: string;
  accent: string;
  label: string;
}

export interface SpeciesDef {
  name: string;
  plural: string;
  price: number;
  townHall: number;
  /** Nourriture mangée par heure (adulte). */
  food: number;
  /** Or rapporté par heure à la billetterie (adulte, pelage normal, heureux). */
  attraction: number;
  /** Secondes pour qu'un petit devienne adulte. */
  growTime: number;
  /** Durée de la reproduction, en secondes. */
  breedTime: number;
  /** Repos des parents après une naissance, en secondes. */
  cooldown: number;
  /** Nourriture dépensée pour lancer une reproduction. */
  breedCost: number;
  coats: Record<Coat, CoatColors>;
}

export const SPECIES: Record<Species, SpeciesDef> = {
  lapin: {
    name: 'Lapin',
    plural: 'Lapins',
    price: 100,
    townHall: 1,
    food: 40,
    attraction: 80,
    growTime: 120,
    breedTime: 60,
    cooldown: 180,
    breedCost: 100,
    coats: {
      normal: { body: '#b08a64', belly: '#e8d6bf', accent: '#f2a7a7', label: 'Agouti' },
      variante: { body: '#4a3f3a', belly: '#7b6d64', accent: '#f2a7a7', label: 'Noir' },
      albinos: { body: '#f7f4ee', belly: '#ffffff', accent: '#ff8fa0', label: 'Albinos' },
      dore: { body: '#f2c230', belly: '#ffe68a', accent: '#ff9f5a', label: 'Doré' },
    },
  },
  mouton: {
    name: 'Mouton',
    plural: 'Moutons',
    price: 250,
    townHall: 1,
    food: 80,
    attraction: 140,
    growTime: 240,
    breedTime: 120,
    cooldown: 300,
    breedCost: 200,
    coats: {
      normal: { body: '#f4f1e8', belly: '#ffffff', accent: '#3d3530', label: 'Blanc' },
      variante: { body: '#4b4440', belly: '#6b625c', accent: '#2a2420', label: 'Noir' },
      albinos: { body: '#fff6e0', belly: '#ffffff', accent: '#f0b8b0', label: 'Crème' },
      dore: { body: '#f6cf45', belly: '#ffe68a', accent: '#8a5a1c', label: 'Toison d’or' },
    },
  },
  cochon: {
    name: 'Cochon',
    plural: 'Cochons',
    price: 600,
    townHall: 2,
    food: 150,
    attraction: 250,
    growTime: 360,
    breedTime: 180,
    cooldown: 420,
    breedCost: 400,
    coats: {
      normal: { body: '#f5a9b2', belly: '#ffc9cf', accent: '#d97384', label: 'Rose' },
      variante: { body: '#5a4646', belly: '#7a6262', accent: '#3a2c2c', label: 'Noir' },
      albinos: { body: '#fff1f1', belly: '#ffffff', accent: '#f4a0b0', label: 'Albinos' },
      dore: { body: '#f3c13a', belly: '#ffe07a', accent: '#c98a1c', label: 'Doré' },
    },
  },
  renard: {
    name: 'Renard',
    plural: 'Renards',
    price: 1500,
    townHall: 3,
    food: 200,
    attraction: 450,
    growTime: 600,
    breedTime: 300,
    cooldown: 600,
    breedCost: 700,
    coats: {
      normal: { body: '#e8762c', belly: '#fbf1e4', accent: '#3a2a22', label: 'Roux' },
      variante: { body: '#8d96a0', belly: '#e9edf1', accent: '#3a3f46', label: 'Argenté' },
      albinos: { body: '#fbf8f2', belly: '#ffffff', accent: '#e8a0a8', label: 'Polaire' },
      dore: { body: '#f5c533', belly: '#fff3c4', accent: '#a86a12', label: 'Doré' },
    },
  },
  cerf: {
    name: 'Cerf',
    plural: 'Cerfs',
    price: 4000,
    townHall: 4,
    food: 300,
    attraction: 800,
    growTime: 900,
    breedTime: 420,
    cooldown: 900,
    breedCost: 1200,
    coats: {
      normal: { body: '#a0683a', belly: '#e6cfae', accent: '#6a4424', label: 'Fauve' },
      variante: { body: '#5c3d2a', belly: '#a88a6e', accent: '#3a2618', label: 'Sombre' },
      albinos: { body: '#f6f2ea', belly: '#ffffff', accent: '#d8c8b0', label: 'Blanc' },
      dore: { body: '#f0bf3a', belly: '#fff0b8', accent: '#b07c18', label: 'Doré' },
    },
  },
  panda: {
    name: 'Panda',
    plural: 'Pandas',
    price: 10000,
    townHall: 5,
    food: 500,
    attraction: 1500,
    growTime: 1200,
    breedTime: 600,
    cooldown: 1200,
    breedCost: 2000,
    coats: {
      normal: { body: '#f7f5f0', belly: '#ffffff', accent: '#2b2b2e', label: 'Classique' },
      variante: { body: '#e6d3b8', belly: '#f5ead8', accent: '#6b4a32', label: 'Brun' },
      albinos: { body: '#ffffff', belly: '#ffffff', accent: '#e8d8d8', label: 'Albinos' },
      dore: { body: '#fbe9a8', belly: '#fff6d6', accent: '#d39a1c', label: 'Doré' },
    },
  },
};

export const SPECIES_ORDER: readonly Species[] = ['lapin', 'mouton', 'cochon', 'renard', 'cerf', 'panda'];

/** Ressources au tout début d'une partie. */
export const START = { or: 1000, nourriture: 500, gemmes: 25 };

/** Gemmes pour finir un chantier tout de suite : une par minute restante. */
export function gemsToFinish(remainingSeconds: number): number {
  return Math.max(1, Math.ceil(remainingSeconds / 60));
}

/** Prix de revente : la moitié du prix d'achat pour un adulte, multiplié par la rareté. */
export const SELL_RATIO = 0.5;
