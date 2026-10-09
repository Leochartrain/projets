import { BUILDINGS, MAP_SIZE, START, type BuildingType, type Species } from './config.ts';
import type { Genotype } from './genetics.ts';
import { Rng } from './rng.ts';

export interface Work {
  /** Fin du chantier (ms, horloge du jeu). */
  endsAt: number;
  /** Durée totale, pour la barre de progression. */
  duration: number;
}

export interface Breeding {
  motherId: number;
  fatherId: number;
  endsAt: number;
  duration: number;
}

export interface Building {
  id: number;
  type: BuildingType;
  /** 0 pendant la toute première construction. */
  level: number;
  /** Case du coin nord de l'emprise. */
  x: number;
  y: number;
  work?: Work;
  /** Ferme, billetterie : production en attente de collecte. */
  stored: number;
  /** Enclos : reproduction en cours. */
  breeding?: Breeding;
}

export type ObstacleKind = 'sapin' | 'buisson' | 'rocher';

export interface Obstacle {
  id: number;
  kind: ObstacleKind;
  x: number;
  y: number;
  size: number;
}

export interface Animal {
  id: number;
  species: Species;
  sex: 'M' | 'F';
  genes: Genotype;
  penId: number;
  bornAt: number;
  /** Moment où le petit devient adulte (= bornAt pour un animal acheté adulte). */
  adultAt: number;
  /** Ne peut pas se reproduire avant ce moment. */
  restUntil: number;
}

export interface Resources {
  or: number;
  nourriture: number;
  gemmes: number;
}

export interface GameState {
  version: 1;
  /** Horloge du jeu (ms) : l'instant jusqu'où la simulation a avancé. */
  time: number;
  rng: number;
  nextId: number;
  resources: Resources;
  buildings: Building[];
  obstacles: Obstacle[];
  animals: Animal[];
  /** Clés du bestiaire déjà découvertes (voir phenotypeKey). */
  discovered: string[];
  births: number;
}

export const OBSTACLE_INFO: Record<ObstacleKind, { name: string; cost: number; size: number }> = {
  sapin: { name: 'Sapin', cost: 100, size: 1 },
  buisson: { name: 'Buisson', cost: 50, size: 1 },
  rocher: { name: 'Rocher', cost: 250, size: 2 },
};

/** Nouvelle partie : la mairie au centre, une cabane, et la nature tout autour. */
export function newGame(now: number, seed = (Math.random() * 2 ** 32) | 0): GameState {
  const rng = new Rng(seed);
  const state: GameState = {
    version: 1,
    time: now,
    rng: 0,
    nextId: 1,
    resources: { ...START },
    buildings: [],
    obstacles: [],
    animals: [],
    discovered: [],
    births: 0,
  };
  const center = MAP_SIZE / 2 - 2;
  addStarting(state, 'mairie', center, center);
  addStarting(state, 'cabane', center + 5, center + 1);

  // Obstacles éparpillés, plus denses vers les bords : il faudra faire de la place.
  for (let tries = 0; tries < 400 && state.obstacles.length < 70; tries++) {
    const kind = rng.pick<ObstacleKind>(['sapin', 'sapin', 'sapin', 'buisson', 'buisson', 'rocher']);
    const size = OBSTACLE_INFO[kind].size;
    const x = rng.int(0, MAP_SIZE - size);
    const y = rng.int(0, MAP_SIZE - size);
    const fromCenter = Math.max(Math.abs(x - MAP_SIZE / 2), Math.abs(y - MAP_SIZE / 2));
    if (fromCenter < 8 || rng.next() > fromCenter / (MAP_SIZE / 2)) continue;
    if (!isAreaFree(state, x, y, size)) continue;
    state.obstacles.push({ id: state.nextId++, kind, x, y, size });
  }
  state.rng = rng.state;
  return state;
}

function addStarting(state: GameState, type: BuildingType, x: number, y: number): void {
  state.buildings.push({ id: state.nextId++, type, level: 1, x, y, stored: 0 });
}

/** Vrai si un carré de côté `size` en (x, y) est dans la carte et ne touche rien. */
export function isAreaFree(state: GameState, x: number, y: number, size: number, ignoreId?: number): boolean {
  if (x < 0 || y < 0 || x + size > MAP_SIZE || y + size > MAP_SIZE) return false;
  const overlaps = (ox: number, oy: number, osize: number) =>
    x < ox + osize && ox < x + size && y < oy + osize && oy < y + size;
  for (const b of state.buildings) {
    if (b.id !== ignoreId && overlaps(b.x, b.y, BUILDINGS[b.type].size)) return false;
  }
  for (const o of state.obstacles) {
    if (overlaps(o.x, o.y, o.size)) return false;
  }
  return true;
}
