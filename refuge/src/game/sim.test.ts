import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDINGS, SPECIES } from './config.ts';
import {
  breed,
  build,
  buyAnimal,
  builders,
  clearObstacle,
  collect,
  finishNow,
  penHappiness,
  sellAnimal,
  tick,
  upgrade,
} from './sim.ts';
import { isAreaFree, newGame, type GameState } from './state.ts';

const T0 = 1_000_000;
const SEC = 1000;
const HOUR = 3600 * SEC;

/** Une partie sans obstacles, avec de quoi construire. */
function game(): GameState {
  const state = newGame(T0, 1);
  state.obstacles = [];
  state.resources = { or: 6_000, nourriture: 3_000, gemmes: 100 };
  // Mairie niveau 2 : de quoi tester les réserves plus grandes et plusieurs bâtiments.
  state.buildings.find((b) => b.type === 'mairie')!.level = 2;
  return state;
}

function finished(state: GameState, id: number): void {
  tick(state, state.buildings.find((b) => b.id === id)!.work!.endsAt);
}

test('construire occupe un bâtisseur jusqu’à la fin du chantier', () => {
  const state = game();
  const r = build(state, 'ferme', 0, 0);
  assert.ok(r.ok);
  assert.deepEqual(builders(state), { total: 1, busy: 1 });
  const second = build(state, 'billetterie', 10, 0);
  assert.equal(second.ok, false);
  finished(state, r.id!);
  assert.equal(state.buildings.find((b) => b.id === r.id)!.level, 1);
  assert.deepEqual(builders(state), { total: 1, busy: 0 });
});

test('on ne construit pas sur un autre bâtiment', () => {
  const state = game();
  const mairie = state.buildings.find((b) => b.type === 'mairie')!;
  assert.equal(build(state, 'ferme', mairie.x + 1, mairie.y + 1).ok, false);
  assert.equal(isAreaFree(state, 38, 38, 3), false, 'déborde de la carte');
});

test('la ferme produit et s’arrête à sa capacité', () => {
  const state = game();
  const { id } = build(state, 'ferme', 0, 0);
  finished(state, id!);
  const ferme = state.buildings.find((b) => b.id === id)!;
  const rate = BUILDINGS.ferme.levels[0].rate!;
  tick(state, state.time + HOUR / 4);
  assert.ok(Math.abs(ferme.stored - rate / 4) < 1e-6);
  tick(state, state.time + 10 * HOUR);
  assert.equal(ferme.stored, BUILDINGS.ferme.levels[0].capacity);
  const before = state.resources.nourriture;
  const c = collect(state, id!);
  assert.ok(c.ok);
  assert.equal(state.resources.nourriture, before + c.amount!);
});

test('la récolte s’arrête quand les réserves sont pleines', () => {
  const state = game();
  const { id } = build(state, 'billetterie', 0, 0);
  finished(state, id!);
  state.resources.or = 5990; // réserve de la mairie niveau 2 : 6000
  tick(state, state.time + HOUR);
  const c = collect(state, id!);
  assert.equal(c.amount, 10);
  assert.ok(state.buildings.find((b) => b.id === id)!.stored > 0, 'le reste attend dans la billetterie');
});

test('une amélioration arrête la production pendant le chantier', () => {
  const state = game();
  const { id } = build(state, 'ferme', 0, 0);
  finished(state, id!);
  assert.ok(upgrade(state, id!).ok);
  tick(state, state.time + 30 * SEC);
  assert.equal(state.buildings.find((b) => b.id === id)!.stored, 0);
});

test('les gemmes finissent un chantier tout de suite', () => {
  const state = game();
  const { id } = build(state, 'enclos', 0, 0);
  assert.ok(finishNow(state, id!).ok);
  assert.equal(state.buildings.find((b) => b.id === id)!.level, 1);
  assert.ok(state.resources.gemmes < 100);
});

/** Un enclos terminé avec un mâle et une femelle adultes. */
function pen(state: GameState) {
  const { id } = build(state, 'enclos', 0, 0);
  finished(state, id!);
  const a = buyAnimal(state, 'lapin', id!).animal!;
  const b = buyAnimal(state, 'lapin', id!).animal!;
  const mother = a.sex === 'F' ? a : b;
  const father = a.sex === 'M' ? a : b;
  return { penId: id!, mother, father };
}

test('les achats équilibrent les sexes et une espèce par enclos', () => {
  const state = game();
  const { penId, mother, father } = pen(state);
  assert.equal(mother.sex, 'F');
  assert.equal(father.sex, 'M');
  assert.equal(buyAnimal(state, 'mouton', penId).ok, false);
});

test('reproduction : un petit naît, grandit, et les parents se reposent', () => {
  const state = game();
  const { penId, mother, father } = pen(state);
  const food = state.resources.nourriture;
  assert.ok(breed(state, penId, mother.id, father.id).ok);
  assert.equal(state.resources.nourriture, food - SPECIES.lapin.breedCost);
  assert.equal(breed(state, penId, mother.id, father.id).ok, false, 'une seule naissance à la fois');

  tick(state, state.time + SPECIES.lapin.breedTime * SEC);
  assert.equal(state.animals.length, 3);
  assert.equal(state.births, 1);
  const baby = state.animals[2];
  assert.ok(baby.adultAt > state.time);
  assert.ok(state.discovered.length >= 1);

  // Les parents sont encore au repos juste après la naissance.
  assert.equal(breed(state, penId, mother.id, father.id).ok, false);
  tick(state, state.time + SPECIES.lapin.cooldown * SEC);
  assert.ok(breed(state, penId, mother.id, father.id).ok);
});

test('vendre un parent annule la naissance en cours', () => {
  const state = game();
  const { penId, mother, father } = pen(state);
  breed(state, penId, mother.id, father.id);
  assert.ok(sellAnimal(state, father.id).ok);
  tick(state, state.time + HOUR);
  assert.equal(state.animals.length, 1);
});

test('les animaux mangent, et affamés ils rapportent moitié moins', () => {
  const fedGame = game();
  const hungryGame = game();
  for (const state of [fedGame, hungryGame]) {
    const { id } = build(state, 'billetterie', 10, 10);
    finished(state, id!);
  }
  pen(fedGame);
  pen(hungryGame);
  hungryGame.resources.nourriture = 0;
  const ticket = (s: GameState) => s.buildings.find((b) => b.type === 'billetterie')!;
  const t1 = fedGame.time;
  ticket(fedGame).stored = 0;
  ticket(hungryGame).stored = 0;
  tick(fedGame, t1 + HOUR / 10);
  tick(hungryGame, t1 + HOUR / 10);
  assert.ok(fedGame.resources.nourriture < 3_000);
  const base = BUILDINGS.billetterie.levels[0].rate! / 10;
  const fedVisitors = ticket(fedGame).stored - base;
  const hungryVisitors = ticket(hungryGame).stored - base;
  assert.ok(fedVisitors > 0);
  assert.ok(Math.abs(hungryVisitors - fedVisitors / 2) < 1e-6);
});

test('les décorations proches rendent un enclos plus heureux', () => {
  const state = game();
  const { id } = build(state, 'enclos', 0, 0);
  finished(state, id!);
  const enclos = state.buildings.find((b) => b.id === id)!;
  const before = penHappiness(state, enclos);
  build(state, 'fleurs', 5, 0); // une case d'écart
  assert.ok(penHappiness(state, enclos) > before);
  build(state, 'fleurs', 20, 20); // trop loin
  assert.equal(penHappiness(state, enclos), before + BUILDINGS.fleurs.happiness!);
});

test('progression hors ligne : un chantier fini pendant l’absence lance la production', () => {
  const state = game();
  const { id } = build(state, 'ferme', 0, 0);
  const end = state.buildings.find((b) => b.id === id)!.work!.endsAt;
  tick(state, end + HOUR / 2);
  const rate = BUILDINGS.ferme.levels[0].rate!;
  assert.ok(Math.abs(state.buildings.find((b) => b.id === id)!.stored - rate / 2) < 1e-6);
});

test('retirer un obstacle coûte de l’or', () => {
  const state = newGame(T0, 5);
  const o = state.obstacles[0];
  const gold = state.resources.or;
  assert.ok(clearObstacle(state, o.id).ok);
  assert.ok(state.resources.or < gold);
  assert.ok(!state.obstacles.includes(o));
});

test('une nouvelle partie a des obstacles, mais pas au centre', () => {
  const state = newGame(T0, 9);
  assert.ok(state.obstacles.length > 20);
  for (const o of state.obstacles) {
    assert.ok(Math.max(Math.abs(o.x - 20), Math.abs(o.y - 20)) >= 8);
  }
});
