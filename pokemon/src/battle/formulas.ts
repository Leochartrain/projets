import { chance, randInt, type Rng } from '../core/random.ts';
import type { MoveDef } from '../data/moves.ts';
import { SPECIES } from '../data/species.ts';
import { effectiveness, type Type } from '../data/types.ts';
import type { Status } from './pokemon.ts';

/** Multiplicateur d'un cran de statistique (−6 à +6) : 2/8 à 8/2. */
export function stageMultiplier(stage: number): number {
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
}

/** Multiplicateur de précision et d'esquive (−6 à +6) : 3/9 à 9/3. */
export function accuracyMultiplier(stage: number): number {
  const clamped = Math.max(-6, Math.min(6, stage));
  return clamped >= 0 ? (3 + clamped) / 3 : 3 / (3 - clamped);
}

export interface DamageInput {
  level: number;
  power: number;
  /** Attaque (ou Atq. Spé.) du lanceur, crans compris. */
  attack: number;
  /** Défense (ou Déf. Spé.) de la cible, crans compris. */
  defense: number;
  moveType: Type;
  attackerTypes: readonly Type[];
  defenderTypes: readonly Type[];
  critical: boolean;
  /** Tirage aléatoire de 85 à 100. */
  random: number;
}

/**
 * Formule de dégâts de la 4e génération :
 * ((⌊⌊2 × N / 5 + 2⌋ × Puissance × A / D⌋ / 50) + 2) × Critique × Aléatoire × STAB × Type,
 * avec un arrondi inférieur après chaque multiplication.
 */
export function damage(input: DamageInput): { damage: number; effectiveness: number } {
  const multiplier = effectiveness(input.moveType, input.defenderTypes);
  if (multiplier === 0) return { damage: 0, effectiveness: 0 };
  let value = Math.floor(Math.floor((Math.floor((2 * input.level) / 5 + 2) * input.power * input.attack) / input.defense) / 50) + 2;
  if (input.critical) value *= 2;
  value = Math.floor((value * input.random) / 100);
  if (input.attackerTypes.includes(input.moveType)) value = Math.floor(value * 1.5);
  for (const type of input.defenderTypes) value = Math.floor(value * effectiveness(input.moveType, [type]));
  return { damage: Math.max(1, value), effectiveness: multiplier };
}

/** Coup critique : 1 chance sur 16 en 4e génération (sans objet ni talent). */
export function rollCritical(rng: Rng): boolean {
  return rng() < 1 / 16;
}

export function rollDamageRandom(rng: Rng): number {
  return randInt(rng, 85, 100);
}

/** L'attaque touche-t-elle ? Précision de l'attaque × crans de précision du lanceur et d'esquive de la cible. */
export function hits(rng: Rng, move: MoveDef, accuracyStage: number, evasionStage: number): boolean {
  if (move.accuracy === null) return true;
  return chance(rng, move.accuracy * accuracyMultiplier(accuracyStage - evasionStage));
}

/**
 * Capture (4e génération) : a = (3 PVmax − 2 PV) × taux × bonus de Ball / (3 PVmax) × bonus de statut.
 * Capturé d'office si a ≥ 255 ; sinon 4 tirages b = 1048560 / √√(16711680 / a) doivent réussir.
 * Renvoie le nombre de secousses (0 à 3) et si le Pokémon est capturé.
 */
export function rollCatch(
  rng: Rng,
  input: { maxHp: number; hp: number; catchRate: number; ballBonus: number; status: Status },
): { shakes: number; caught: boolean } {
  const statusBonus = input.status ? 1.5 : 1;
  const a = Math.floor(((3 * input.maxHp - 2 * input.hp) * input.catchRate * input.ballBonus) / (3 * input.maxHp)) * statusBonus;
  if (a >= 255) return { shakes: 3, caught: true };
  if (a <= 0) return { shakes: 0, caught: false };
  const b = Math.floor(1048560 / Math.floor(Math.sqrt(Math.floor(Math.sqrt(Math.floor(16711680 / a))))));
  for (let check = 0; check < 4; check++) {
    if (randInt(rng, 0, 65535) >= b) return { shakes: Math.min(check, 3), caught: false };
  }
  return { shakes: 3, caught: true };
}

/**
 * Fuite (4e génération) : réussie d'office si on est plus rapide ; sinon
 * F = Vitesse × 128 / Vitesse ennemie + 30 × tentatives, et réussite si un tirage de 0 à 255 est sous F.
 */
export function rollEscape(rng: Rng, playerSpeed: number, wildSpeed: number, attempts: number): boolean {
  if (playerSpeed >= wildSpeed) return true;
  const f = (Math.floor((playerSpeed * 128) / wildSpeed) + 30 * attempts) % 256;
  return randInt(rng, 0, 255) < f;
}

/** Expérience gagnée contre un Pokémon sauvage (4e génération) : base × niveau / 7, partagée entre les participants. */
export function expYield(species: keyof typeof SPECIES, level: number, participants: number): number {
  return Math.max(1, Math.floor(Math.floor((SPECIES[species].baseExp * level) / 7) / Math.max(1, participants)));
}
