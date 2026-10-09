import { animal } from '../art/animals.ts';
import { thumbnail } from '../art/buildings.ts';
import { SPECIES, type BuildingType, type Species } from '../game/config.ts';
import type { Coat } from '../game/genetics.ts';

/** Vignettes des bâtiments et des animaux pour l'interface (mises en cache). */
const cache = new Map<string, string>();

function cached(key: string, draw: () => HTMLCanvasElement): string {
  if (!cache.has(key)) cache.set(key, draw().toDataURL());
  return cache.get(key)!;
}

export function buildingThumb(type: BuildingType, level: number): string {
  return cached(`b:${type}:${level}`, () => thumbnail(type, level));
}

export function animalThumb(species: Species, coat: Coat, spotted: boolean): string {
  return cached(`a:${species}:${coat}:${spotted}`, () => animal(species, SPECIES[species].coats[coat], coat, spotted));
}
