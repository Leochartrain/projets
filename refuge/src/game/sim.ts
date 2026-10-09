import {
  BABY_FACTOR,
  BASE_HAPPINESS,
  BUILDINGS,
  CABANE_COSTS,
  DECOR_RANGE,
  HUNGRY_FACTOR,
  MAX_HAPPINESS,
  SELL_RATIO,
  SPECIES,
  gemsToFinish,
  type BuildingType,
  type LevelDef,
  type Resource,
  type Species,
} from './config.ts';
import { cross, phenotype, phenotypeKey, randomGenotype, rarity } from './genetics.ts';
import { Rng } from './rng.ts';
import { OBSTACLE_INFO, isAreaFree, type Animal, type Building, type GameState } from './state.ts';

/**
 * Règles du jeu. Les fonctions de lecture ne modifient rien ; les actions modifient l'état
 * et renvoient un résultat que l'interface affiche (« Pas assez d'or », etc.).
 * Le temps est toujours passé en paramètre : aucune fonction ne lit l'horloge elle-même.
 */

export type Result = { ok: true } | { ok: false; reason: string };
const OK: Result = { ok: true };
const fail = (reason: string): Result => ({ ok: false, reason });

const HOUR = 3600_000;

// ─── Lecture ────────────────────────────────────────────────────────────────

export function townHallLevel(state: GameState): number {
  return state.buildings.find((b) => b.type === 'mairie')?.level ?? 1;
}

export function storageCap(state: GameState, resource: Resource): number {
  const def = BUILDINGS.mairie.levels[townHallLevel(state) - 1];
  return def.storage![resource];
}

/** Caractéristiques du niveau actuel (niveau 1 pendant la première construction). */
export function levelDef(b: Building): LevelDef {
  return BUILDINGS[b.type].levels[Math.max(0, b.level - 1)];
}

/** Un bâtiment fonctionne s'il est construit et pas en cours d'amélioration. */
export function isActive(b: Building): boolean {
  return b.level >= 1 && !b.work;
}

export function builders(state: GameState): { total: number; busy: number } {
  const total = state.buildings.filter((b) => b.type === 'cabane' && b.level >= 1).length;
  const busy = state.buildings.filter((b) => b.work).length;
  return { total, busy };
}

export function countOf(state: GameState, type: BuildingType): number {
  return state.buildings.filter((b) => b.type === type).length;
}

export function maxCountOf(state: GameState, type: BuildingType): number {
  return BUILDINGS[type].maxCount[townHallLevel(state) - 1];
}

/** Prix de construction d'un nouveau bâtiment de ce type. */
export function buildCost(state: GameState, type: BuildingType): number {
  if (type === 'cabane') return CABANE_COSTS[Math.min(countOf(state, 'cabane'), CABANE_COSTS.length - 1)];
  return BUILDINGS[type].levels[0].cost;
}

export function isAdult(a: Animal, now: number): boolean {
  return now >= a.adultAt;
}

export function animalsIn(state: GameState, penId: number): Animal[] {
  return state.animals.filter((a) => a.penId === penId);
}

/** Espèce d'un enclos : celle de ses animaux, ou aucune s'il est vide. */
export function penSpecies(state: GameState, penId: number): Species | undefined {
  return state.animals.find((a) => a.penId === penId)?.species;
}

export function penCapacity(pen: Building): number {
  return levelDef(pen).capacity!;
}

/** Places prises : les animaux, plus le petit à naître. */
export function penOccupancy(state: GameState, pen: Building): number {
  return animalsIn(state, pen.id).length + (pen.breeding ? 1 : 0);
}

/** Bonheur d'un enclos : de 70 % à 100 % selon les décorations autour. */
export function penHappiness(state: GameState, pen: Building): number {
  const size = BUILDINGS.enclos.size;
  let bonus = 0;
  for (const b of state.buildings) {
    const def = BUILDINGS[b.type];
    if (!def.happiness) continue;
    const gapX = Math.max(pen.x - (b.x + def.size), b.x - (pen.x + size), -1) + 1;
    const gapY = Math.max(pen.y - (b.y + def.size), b.y - (pen.y + size), -1) + 1;
    if (Math.max(gapX, gapY) <= DECOR_RANGE) bonus += def.happiness;
  }
  return Math.min(MAX_HAPPINESS, BASE_HAPPINESS + bonus);
}

/** Nourriture mangée par heure par tous les animaux. */
export function foodPerHour(state: GameState, now: number): number {
  return state.animals.reduce(
    (sum, a) => sum + SPECIES[a.species].food * (isAdult(a, now) ? 1 : BABY_FACTOR),
    0,
  );
}

/** Or par heure qu'un animal rapporte, nourri. */
export function animalAttraction(state: GameState, a: Animal, now: number): number {
  const pen = state.buildings.find((b) => b.id === a.penId);
  const happiness = pen ? penHappiness(state, pen) : BASE_HAPPINESS;
  return (
    SPECIES[a.species].attraction *
    rarity(phenotype(a.genes)) *
    happiness *
    (isAdult(a, now) ? 1 : BABY_FACTOR)
  );
}

/** Or par heure apporté par les animaux, partagé entre les billetteries (nourris). */
export function visitorsPerHour(state: GameState, now: number): number {
  return state.animals.reduce((sum, a) => sum + animalAttraction(state, a, now), 0);
}

export function sellPrice(a: Animal, now: number): number {
  const base = SPECIES[a.species].price * SELL_RATIO * rarity(phenotype(a.genes));
  return Math.round(isAdult(a, now) ? base : base / 2);
}

// ─── Temps ──────────────────────────────────────────────────────────────────

/**
 * Fait avancer la partie jusqu'à `now`. Le trajet est découpé aux événements
 * (fin de chantier, petit qui grandit, naissance) pour que la production reste exacte,
 * même après des heures hors ligne.
 */
export function tick(state: GameState, now: number): void {
  // Garde-fou : une sauvegarde venue du futur (horloge changée) ne fait rien reculer.
  if (now <= state.time) return;
  for (let guard = 0; guard < 10_000; guard++) {
    const next = Math.min(now, nextEventTime(state));
    produce(state, next - state.time);
    state.time = next;
    resolveEvents(state);
    if (next >= now) return;
  }
}

function nextEventTime(state: GameState): number {
  let next = Infinity;
  for (const b of state.buildings) {
    if (b.work) next = Math.min(next, b.work.endsAt);
    if (b.breeding) next = Math.min(next, b.breeding.endsAt);
  }
  for (const a of state.animals) {
    if (a.adultAt > state.time) next = Math.min(next, a.adultAt);
  }
  return next;
}

function produce(state: GameState, ms: number): void {
  if (ms <= 0) return;
  const hours = ms / HOUR;
  const now = state.time;

  // Les animaux mangent ; s'il n'y a pas assez, ils attirent moins de monde.
  const needed = foodPerHour(state, now) * hours;
  const eaten = Math.min(needed, state.resources.nourriture);
  state.resources.nourriture -= eaten;
  const fed = needed > 0 ? eaten / needed : 1;
  const visitorFactor = HUNGRY_FACTOR + (1 - HUNGRY_FACTOR) * fed;

  const tickets = state.buildings.filter((b) => b.type === 'billetterie' && isActive(b));
  const visitors = tickets.length ? (visitorsPerHour(state, now) * visitorFactor) / tickets.length : 0;

  for (const b of state.buildings) {
    if (!isActive(b)) continue;
    const def = levelDef(b);
    if (b.type === 'ferme') b.stored = Math.min(def.capacity!, b.stored + def.rate! * hours);
    if (b.type === 'billetterie') b.stored = Math.min(def.capacity!, b.stored + (def.rate! + visitors) * hours);
  }
}

function resolveEvents(state: GameState): void {
  const now = state.time;
  for (const b of state.buildings) {
    if (b.work && b.work.endsAt <= now) {
      b.level++;
      b.work = undefined;
    }
    if (b.breeding && b.breeding.endsAt <= now) giveBirth(state, b);
  }
}

function giveBirth(state: GameState, pen: Building): void {
  const { motherId, fatherId } = pen.breeding!;
  pen.breeding = undefined;
  const mother = state.animals.find((a) => a.id === motherId);
  const father = state.animals.find((a) => a.id === fatherId);
  // Un parent vendu pendant la gestation : pas de naissance.
  if (!mother || !father) return;
  const rng = new Rng(state.rng);
  const genes = cross(mother.genes, father.genes, rng);
  const species = mother.species;
  const now = state.time;
  addAnimal(state, {
    species,
    sex: rng.chance(0.5) ? 'M' : 'F',
    genes,
    penId: pen.id,
    bornAt: now,
    adultAt: now + SPECIES[species].growTime * 1000,
    restUntil: now + SPECIES[species].growTime * 1000,
  });
  state.rng = rng.state;
  state.births++;
}

function addAnimal(state: GameState, a: Omit<Animal, 'id'>): Animal {
  const animal = { id: state.nextId++, ...a };
  state.animals.push(animal);
  const key = phenotypeKey(a.species, phenotype(a.genes));
  if (!state.discovered.includes(key)) state.discovered.push(key);
  return animal;
}

// ─── Actions ────────────────────────────────────────────────────────────────

function spend(state: GameState, resource: Resource | 'gemmes', amount: number): Result {
  if (state.resources[resource] < amount) {
    const label = { or: 'd’or', nourriture: 'de nourriture', gemmes: 'de gemmes' }[resource];
    return fail(`Pas assez ${label}`);
  }
  state.resources[resource] -= amount;
  return OK;
}

export function canPlace(state: GameState, type: BuildingType, x: number, y: number, ignoreId?: number): boolean {
  return isAreaFree(state, x, y, BUILDINGS[type].size, ignoreId);
}

/** Vérifie qu'on peut construire ce type maintenant (sans regarder l'emplacement). */
export function checkBuild(state: GameState, type: BuildingType): Result {
  const def = BUILDINGS[type];
  if (def.levels[0].townHall > townHallLevel(state)) return fail(`Mairie niveau ${def.levels[0].townHall} requise`);
  if (countOf(state, type) >= maxCountOf(state, type)) return fail('Nombre maximal atteint : améliore la mairie');
  if (state.resources.or < buildCost(state, type)) return fail('Pas assez d’or');
  if (!def.instant && def.levels[0].time > 0) {
    const { total, busy } = builders(state);
    if (busy >= total) return fail('Tous les bâtisseurs sont occupés');
  }
  return OK;
}

export function build(state: GameState, type: BuildingType, x: number, y: number): Result & { id?: number } {
  const check = checkBuild(state, type);
  if (!check.ok) return check;
  if (!canPlace(state, type, x, y)) return fail('Emplacement occupé');
  spend(state, 'or', buildCost(state, type));
  const time = BUILDINGS[type].levels[0].time * 1000;
  const b: Building = { id: state.nextId++, type, level: time > 0 ? 0 : 1, x, y, stored: 0 };
  if (time > 0) b.work = { endsAt: state.time + time, duration: time };
  state.buildings.push(b);
  return { ok: true, id: b.id };
}

export function move(state: GameState, id: number, x: number, y: number): Result {
  const b = state.buildings.find((it) => it.id === id);
  if (!b) return fail('Bâtiment introuvable');
  if (!canPlace(state, b.type, x, y, id)) return fail('Emplacement occupé');
  b.x = x;
  b.y = y;
  return OK;
}

export function checkUpgrade(state: GameState, b: Building): Result {
  const levels = BUILDINGS[b.type].levels;
  if (b.work) return fail('Chantier déjà en cours');
  if (b.level >= levels.length) return fail('Niveau maximal');
  const next = levels[b.level];
  if (next.townHall > townHallLevel(state)) return fail(`Mairie niveau ${next.townHall} requise`);
  if (state.resources.or < next.cost) return fail('Pas assez d’or');
  const { total, busy } = builders(state);
  if (busy >= total) return fail('Tous les bâtisseurs sont occupés');
  return OK;
}

export function upgrade(state: GameState, id: number): Result {
  const b = state.buildings.find((it) => it.id === id);
  if (!b) return fail('Bâtiment introuvable');
  const check = checkUpgrade(state, b);
  if (!check.ok) return check;
  const next = BUILDINGS[b.type].levels[b.level];
  spend(state, 'or', next.cost);
  if (next.time > 0) b.work = { endsAt: state.time + next.time * 1000, duration: next.time * 1000 };
  else b.level++;
  return OK;
}

export function finishCost(state: GameState, b: Building): number {
  return b.work ? gemsToFinish((b.work.endsAt - state.time) / 1000) : 0;
}

export function finishNow(state: GameState, id: number): Result {
  const b = state.buildings.find((it) => it.id === id);
  if (!b?.work) return fail('Aucun chantier');
  const paid = spend(state, 'gemmes', finishCost(state, b));
  if (!paid.ok) return paid;
  b.work.endsAt = state.time;
  resolveEvents(state);
  return OK;
}

/** Récolte : renvoie la quantité réellement rangée (les réserves ont une limite). */
export function collect(state: GameState, id: number): Result & { amount?: number; resource?: Resource } {
  const b = state.buildings.find((it) => it.id === id);
  if (!b || (b.type !== 'ferme' && b.type !== 'billetterie')) return fail('Rien à récolter');
  const resource: Resource = b.type === 'ferme' ? 'nourriture' : 'or';
  const room = storageCap(state, resource) - state.resources[resource];
  const amount = Math.floor(Math.min(b.stored, room));
  if (amount <= 0) return fail(b.stored >= 1 ? 'Réserves pleines : améliore la mairie' : 'Rien à récolter');
  state.resources[resource] += amount;
  b.stored -= amount;
  return { ok: true, amount, resource };
}

export function checkBuyAnimal(state: GameState, species: Species, pen: Building): Result {
  const def = SPECIES[species];
  if (def.townHall > townHallLevel(state)) return fail(`Mairie niveau ${def.townHall} requise`);
  if (pen.type !== 'enclos' || pen.level < 1) return fail('Il faut un enclos terminé');
  const current = penSpecies(state, pen.id);
  if (current && current !== species) return fail(`Cet enclos accueille des ${SPECIES[current].plural.toLowerCase()}`);
  if (penOccupancy(state, pen) >= penCapacity(pen)) return fail('Enclos plein');
  if (state.resources.or < def.price) return fail('Pas assez d’or');
  return OK;
}

/** Achète un adulte, du sexe demandé ou de celui qui manque dans l'enclos. */
export function buyAnimal(state: GameState, species: Species, penId: number): Result & { animal?: Animal } {
  const pen = state.buildings.find((b) => b.id === penId);
  if (!pen) return fail('Enclos introuvable');
  const check = checkBuyAnimal(state, species, pen);
  if (!check.ok) return check;
  spend(state, 'or', SPECIES[species].price);
  const rng = new Rng(state.rng);
  const present = animalsIn(state, penId);
  const males = present.filter((a) => a.sex === 'M').length;
  const sex = males * 2 < present.length ? 'M' : males * 2 > present.length ? 'F' : rng.chance(0.5) ? 'M' : 'F';
  const now = state.time;
  const animal = addAnimal(state, {
    species,
    sex,
    genes: randomGenotype(rng),
    penId,
    bornAt: now,
    adultAt: now,
    restUntil: now,
  });
  state.rng = rng.state;
  return { ok: true, animal };
}

export function sellAnimal(state: GameState, id: number): Result & { amount?: number } {
  const a = state.animals.find((it) => it.id === id);
  if (!a) return fail('Animal introuvable');
  const amount = sellPrice(a, state.time);
  state.resources.or = Math.min(storageCap(state, 'or'), state.resources.or + amount);
  state.animals = state.animals.filter((it) => it !== a);
  return { ok: true, amount };
}

export function canBreed(a: Animal, now: number): boolean {
  return isAdult(a, now) && now >= a.restUntil;
}

export function checkBreed(state: GameState, pen: Building, mother: Animal, father: Animal): Result {
  const now = state.time;
  if (pen.breeding) return fail('Une naissance est déjà en route');
  if (mother.penId !== pen.id || father.penId !== pen.id) return fail('Les parents doivent être dans cet enclos');
  if (mother.sex !== 'F' || father.sex !== 'M') return fail('Il faut une femelle et un mâle');
  if (!canBreed(mother, now) || !canBreed(father, now)) return fail('Les parents doivent être adultes et reposés');
  if (penOccupancy(state, pen) >= penCapacity(pen)) return fail('Plus de place pour un petit : agrandis l’enclos');
  if (state.resources.nourriture < SPECIES[mother.species].breedCost) return fail('Pas assez de nourriture');
  return OK;
}

export function breed(state: GameState, penId: number, motherId: number, fatherId: number): Result {
  const pen = state.buildings.find((b) => b.id === penId);
  const mother = state.animals.find((a) => a.id === motherId);
  const father = state.animals.find((a) => a.id === fatherId);
  if (!pen || !mother || !father) return fail('Animal introuvable');
  const check = checkBreed(state, pen, mother, father);
  if (!check.ok) return check;
  const def = SPECIES[mother.species];
  spend(state, 'nourriture', def.breedCost);
  const now = state.time;
  pen.breeding = { motherId, fatherId, endsAt: now + def.breedTime * 1000, duration: def.breedTime * 1000 };
  const rest = now + (def.breedTime + def.cooldown) * 1000;
  mother.restUntil = rest;
  father.restUntil = rest;
  return OK;
}

/** Retire un obstacle (immédiat) ; on y trouve parfois des gemmes. */
export function clearObstacle(state: GameState, id: number): Result & { gems?: number } {
  const o = state.obstacles.find((it) => it.id === id);
  if (!o) return fail('Introuvable');
  const paid = spend(state, 'or', OBSTACLE_INFO[o.kind].cost);
  if (!paid.ok) return paid;
  const rng = new Rng(state.rng);
  const gems = rng.pick([0, 0, 1, 1, 2, 3]);
  state.rng = rng.state;
  state.resources.gemmes += gems;
  state.obstacles = state.obstacles.filter((it) => it !== o);
  return { ok: true, gems };
}

/** Démolit une décoration (remboursée à moitié). Les autres bâtiments restent. */
export function demolish(state: GameState, id: number): Result {
  const b = state.buildings.find((it) => it.id === id);
  if (!b || BUILDINGS[b.type].category !== 'decor') return fail('Seules les décorations se retirent');
  state.resources.or = Math.min(storageCap(state, 'or'), state.resources.or + Math.floor(buildCost(state, b.type) / 2));
  state.buildings = state.buildings.filter((it) => it !== b);
  return OK;
}
