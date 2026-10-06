import { createPokemon, heal, type Pokemon } from './battle/pokemon.ts';
import type { Direction } from './core/input.ts';
import type { Rng } from './core/random.ts';
import { ITEMS, type ItemId } from './data/items.ts';
import { SPECIES, type SpeciesId } from './data/species.ts';

/** Le Pokémon de départ (n'importe quelle espèce de data/species.ts). */
export const STARTER: SpeciesId = 'piplup';
export const STARTER_LEVEL = 5;
export const PARTY_SIZE = 6;
const SAVE_KEY = 'pokemon-route.save';
const SAVE_VERSION = 1;

export interface Position {
  x: number;
  y: number;
  facing: Direction;
}

/** Tout ce qui se sauvegarde. */
export interface GameState {
  party: Pokemon[];
  /** Pokémon capturés quand l'équipe est pleine (« envoyés au PC »). */
  box: Pokemon[];
  bag: Record<ItemId, number>;
  seen: SpeciesId[];
  caught: SpeciesId[];
  position: Position;
  /** Temps de jeu en secondes. */
  playTime: number;
}

export function newGame(start: Position, rng: Rng): GameState {
  const starter = createPokemon(STARTER, STARTER_LEVEL, rng);
  return {
    party: [starter],
    box: [],
    bag: { potion: 5, antidote: 2, 'paralyze-heal': 2, 'poke-ball': 10 },
    seen: [STARTER],
    caught: [STARTER],
    position: { ...start },
    playTime: 0,
  };
}

export function markSeen(state: GameState, species: SpeciesId): void {
  if (!state.seen.includes(species)) state.seen.push(species);
}

/** Ajoute un Pokémon capturé à l'équipe, ou au PC si elle est pleine ; renvoie vrai s'il va au PC. */
export function addCaught(state: GameState, pokemon: Pokemon): boolean {
  markSeen(state, pokemon.species);
  if (!state.caught.includes(pokemon.species)) state.caught.push(pokemon.species);
  if (state.party.length < PARTY_SIZE) {
    state.party.push(pokemon);
    return false;
  }
  state.box.push(pokemon);
  return true;
}

export function healParty(state: GameState): void {
  for (const pokemon of state.party) heal(pokemon);
}

export function hasSave(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

export function save(state: GameState): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state }));
    return true;
  } catch {
    return false;
  }
}

/** Charge la sauvegarde ; null si elle est absente ou illisible (une autre version du jeu, par exemple). */
export function load(): GameState | null {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null') as { version?: number; state?: GameState } | null;
    const state = raw?.version === SAVE_VERSION ? raw.state : null;
    if (!state || !Array.isArray(state.party) || state.party.length === 0) return null;
    if (!state.party.every((p) => p.species in SPECIES)) return null;
    for (const id of Object.keys(ITEMS) as ItemId[]) state.bag[id] = Math.max(0, Number(state.bag?.[id]) || 0);
    return state;
  } catch {
    return null;
  }
}
