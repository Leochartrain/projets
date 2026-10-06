import { randInt, type Rng } from '../core/random.ts';
import { MOVES, type MoveId } from '../data/moves.ts';
import { expForLevel, NATURES, SPECIES, type SpeciesId, type StatId, type Stats } from '../data/species.ts';

export const MAX_LEVEL = 100;
export const MAX_MOVES = 4;

export type Status = 'poison' | 'paralysis' | null;

export interface MoveSlot {
  id: MoveId;
  pp: number;
}

/** Un Pokémon de l'équipe ou sauvage : tout ce qui se sauvegarde (le reste se recalcule). */
export interface Pokemon {
  species: SpeciesId;
  level: number;
  /** Expérience totale. */
  exp: number;
  /** Valeurs individuelles (0 à 31), tirées à la rencontre. */
  ivs: Stats;
  /** Indice dans NATURES. */
  nature: number;
  hp: number;
  status: Status;
  moves: MoveSlot[];
  /** Pour les Pokémon capturés : le niveau et l'endroit de la rencontre (écran Résumé). */
  metLevel: number;
}

/** Crée un Pokémon au niveau donné, avec les 4 dernières attaques apprises à ce niveau (comme un Pokémon sauvage). */
export function createPokemon(species: SpeciesId, level: number, rng: Rng): Pokemon {
  const ivs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  for (const stat of Object.keys(ivs) as StatId[]) ivs[stat] = randInt(rng, 0, 31);
  const learned = SPECIES[species].learnset.filter(([at]) => at <= level).map(([, move]) => move);
  const moves = learned.slice(-MAX_MOVES).map((id) => ({ id, pp: MOVES[id].pp }));
  const pokemon: Pokemon = {
    species,
    level,
    exp: expForLevel(SPECIES[species].growth, level),
    ivs,
    nature: randInt(rng, 0, NATURES.length - 1),
    hp: 0,
    status: null,
    moves,
    metLevel: level,
  };
  pokemon.hp = statsOf(pokemon).hp;
  return pokemon;
}

/** Statistiques au niveau actuel (formules de la 4e génération, sans EV). */
export function statsOf(pokemon: Pokemon): Stats {
  const { base } = SPECIES[pokemon.species];
  const nature = NATURES[pokemon.nature];
  const { level, ivs } = pokemon;
  const stat = (id: StatId) => {
    const raw = Math.floor(((2 * base[id] + ivs[id]) * level) / 100);
    if (id === 'hp') return raw + level + 10;
    const multiplier = nature.up === id ? 1.1 : nature.down === id ? 0.9 : 1;
    return Math.floor((raw + 5) * multiplier);
  };
  return { hp: stat('hp'), atk: stat('atk'), def: stat('def'), spa: stat('spa'), spd: stat('spd'), spe: stat('spe') };
}

export function maxHp(pokemon: Pokemon): number {
  return statsOf(pokemon).hp;
}

export function nameOf(pokemon: Pokemon): string {
  return SPECIES[pokemon.species].name;
}

export function isFainted(pokemon: Pokemon): boolean {
  return pokemon.hp <= 0;
}

/** Soin complet : PV, statut et PP (chez soi). */
export function heal(pokemon: Pokemon): void {
  pokemon.hp = maxHp(pokemon);
  pokemon.status = null;
  for (const slot of pokemon.moves) slot.pp = MOVES[slot.id].pp;
}

/** Progression dans le niveau actuel (0 à 1), pour la barre d'expérience. */
export function levelProgress(pokemon: Pokemon): number {
  if (pokemon.level >= MAX_LEVEL) return 1;
  const { growth } = SPECIES[pokemon.species];
  const start = expForLevel(growth, pokemon.level);
  const next = expForLevel(growth, pokemon.level + 1);
  return Math.min(1, Math.max(0, (pokemon.exp - start) / (next - start)));
}

export function expToNextLevel(pokemon: Pokemon): number {
  if (pokemon.level >= MAX_LEVEL) return 0;
  return expForLevel(SPECIES[pokemon.species].growth, pokemon.level + 1) - pokemon.exp;
}

/**
 * Ajoute de l'expérience ; renvoie les niveaux franchis, avec les attaques
 * apprises à chacun. Les PV montent d'autant que les PV max.
 */
export function gainExp(pokemon: Pokemon, amount: number): { level: number; newMoves: MoveId[] }[] {
  const gained: { level: number; newMoves: MoveId[] }[] = [];
  pokemon.exp += amount;
  const { growth, learnset } = SPECIES[pokemon.species];
  while (pokemon.level < MAX_LEVEL && pokemon.exp >= expForLevel(growth, pokemon.level + 1)) {
    const before = maxHp(pokemon);
    pokemon.level++;
    pokemon.hp += maxHp(pokemon) - before;
    const newMoves = learnset.filter(([at, move]) => at === pokemon.level && !pokemon.moves.some((slot) => slot.id === move)).map(([, move]) => move);
    gained.push({ level: pokemon.level, newMoves });
  }
  return gained;
}

/** Apprend une attaque s'il reste une place ; renvoie faux s'il faut en oublier une. */
export function learnMove(pokemon: Pokemon, move: MoveId, replace?: number): boolean {
  const slot = { id: move, pp: MOVES[move].pp };
  if (replace !== undefined) {
    pokemon.moves[replace] = slot;
    return true;
  }
  if (pokemon.moves.length >= MAX_MOVES) return false;
  pokemon.moves.push(slot);
  return true;
}
