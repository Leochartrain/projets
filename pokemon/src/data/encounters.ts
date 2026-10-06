import type { SpeciesId } from './species.ts';

export interface EncounterSlot {
  species: SpeciesId;
  /** Poids relatif (en %). */
  weight: number;
  minLevel: number;
  maxLevel: number;
}

/**
 * Hautes herbes de la route, en deux zones : l'ouest (près de Bonneville, des
 * Pokémon de la Route 201) et l'est (plus loin, ceux des Routes 202 à 204, et Abra, rare).
 */
export const ENCOUNTERS: Record<'west' | 'east', EncounterSlot[]> = {
  west: [
    { species: 'starly', weight: 40, minLevel: 2, maxLevel: 4 },
    { species: 'bidoof', weight: 40, minLevel: 2, maxLevel: 4 },
    { species: 'wurmple', weight: 20, minLevel: 2, maxLevel: 3 },
  ],
  east: [
    { species: 'shinx', weight: 25, minLevel: 3, maxLevel: 5 },
    { species: 'kricketot', weight: 25, minLevel: 3, maxLevel: 5 },
    { species: 'budew', weight: 25, minLevel: 3, maxLevel: 6 },
    { species: 'starly', weight: 10, minLevel: 4, maxLevel: 6 },
    { species: 'bidoof', weight: 10, minLevel: 4, maxLevel: 6 },
    { species: 'abra', weight: 5, minLevel: 4, maxLevel: 6 },
  ],
};

/** Probabilité de rencontre à chaque pas dans les hautes herbes. */
export const ENCOUNTER_CHANCE = 0.12;
