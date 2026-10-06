import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seeded } from '../core/random.ts';
import { expForLevel } from '../data/species.ts';
import { effectiveness } from '../data/types.ts';
import { accuracyMultiplier, damage, expYield, rollCatch, rollEscape, stageMultiplier } from './formulas.ts';
import { createPokemon, gainExp, statsOf } from './pokemon.ts';

test("courbes d'expérience de la 4e génération", () => {
  // Valeurs des tables officielles (moyenne-lente et moyenne-rapide).
  assert.equal(expForLevel('medium-slow', 5), 135);
  assert.equal(expForLevel('medium-slow', 6), 179);
  assert.equal(expForLevel('medium-slow', 10), 560);
  assert.equal(expForLevel('medium-fast', 5), 125);
  assert.equal(expForLevel('medium-fast', 100), 1_000_000);
  assert.equal(expForLevel('medium-slow', 100), 1_059_860);
});

test('statistiques : formule de la 4e génération', () => {
  const piplup = createPokemon('piplup', 5, seeded(1));
  piplup.ivs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  piplup.nature = 0; // Hardi : neutre
  assert.deepEqual(statsOf(piplup), { hp: 20, atk: 10, def: 10, spa: 11, spd: 10, spe: 9 });
  piplup.ivs.hp = 31;
  piplup.level = 50;
  // PV = ⌊(2 × 53 + 31) × 50 / 100⌋ + 50 + 10 = 128.
  assert.equal(statsOf(piplup).hp, 128);
});

test('table des types', () => {
  assert.equal(effectiveness('electric', ['normal', 'flying']), 2);
  assert.equal(effectiveness('grass', ['grass', 'poison']), 0.25);
  assert.equal(effectiveness('normal', ['ghost']), 0);
  assert.equal(effectiveness('flying', ['bug']), 2);
  assert.equal(effectiveness('water', ['normal']), 1);
  assert.equal(effectiveness('psychic', ['poison']), 2);
});

test('dégâts : formule, STAB, critique, efficacité', () => {
  const base = { level: 5, power: 35, attack: 10, defense: 10, moveType: 'normal' as const, critical: false, random: 100 };
  // ⌊⌊4 × 35 × 10 / 10⌋ / 50⌋ + 2 = 4.
  assert.equal(damage({ ...base, attackerTypes: ['water'], defenderTypes: ['bug'] }).damage, 4);
  assert.equal(damage({ ...base, attackerTypes: ['normal'], defenderTypes: ['bug'] }).damage, 6); // STAB ×1,5
  assert.equal(damage({ ...base, attackerTypes: ['water'], defenderTypes: ['bug'], critical: true }).damage, 8);
  assert.equal(damage({ ...base, attackerTypes: ['water'], defenderTypes: ['bug'], random: 85 }).damage, 3);
  assert.deepEqual(damage({ ...base, attackerTypes: ['normal'], defenderTypes: ['ghost'] }), { damage: 0, effectiveness: 0 });
  assert.equal(damage({ ...base, moveType: 'water', attackerTypes: ['water'], defenderTypes: ['rock', 'ground'] }).effectiveness, 4);
});

test('crans de statistiques et de précision', () => {
  assert.equal(stageMultiplier(0), 1);
  assert.equal(stageMultiplier(1), 1.5);
  assert.equal(stageMultiplier(-1), 2 / 3);
  assert.equal(stageMultiplier(6), 4);
  assert.equal(accuracyMultiplier(1), 4 / 3);
  assert.equal(accuracyMultiplier(-6), 1 / 3);
});

test('capture : facile quand les PV sont bas, d\'office avec un statut sur un Pokémon commun', () => {
  const rng = seeded(7);
  const full: Parameters<typeof rollCatch>[1] = { maxHp: 15, hp: 15, catchRate: 255, ballBonus: 1, status: null };
  const low = { ...full, hp: 1 };
  const tries = 2000;
  const rate = (input: Parameters<typeof rollCatch>[1]) => {
    let caught = 0;
    for (let i = 0; i < tries; i++) if (rollCatch(rng, input).caught) caught++;
    return caught / tries;
  };
  const fullRate = rate(full);
  const lowRate = rate(low);
  assert.ok(fullRate > 0.25 && fullRate < 0.5, `PV pleins : ${fullRate}`);
  assert.ok(lowRate > 0.9, `1 PV : ${lowRate}`);
  // a = ⌊(45 − 2) × 255 / 45⌋ × 1,5 ≥ 255 : capture assurée.
  assert.deepEqual(rollCatch(rng, { ...low, status: 'paralysis' }), { shakes: 3, caught: true });
  // Taux bas (Tiplouf, 45) à PV pleins : rare.
  assert.ok(rate({ ...full, catchRate: 45 }) < 0.15);
});

test('fuite : toujours possible si on est plus rapide, de plus en plus probable sinon', () => {
  const rng = seeded(3);
  assert.equal(rollEscape(rng, 20, 10, 1), true);
  let first = 0;
  let third = 0;
  for (let i = 0; i < 2000; i++) {
    if (rollEscape(rng, 5, 20, 1)) first++;
    if (rollEscape(rng, 5, 20, 3)) third++;
  }
  assert.ok(third > first);
});

test("expérience : base × niveau / 7, partagée, et montées de niveau avec nouvelles attaques", () => {
  assert.equal(expYield('starly', 3, 1), 24); // ⌊56 × 3 / 7⌋
  assert.equal(expYield('starly', 3, 2), 12);
  const piplup = createPokemon('piplup', 7, seeded(2));
  assert.deepEqual(piplup.moves.map((m) => m.id), ['pound', 'growl']);
  const levels = gainExp(piplup, expForLevel('medium-slow', 8) - piplup.exp);
  assert.deepEqual(levels, [{ level: 8, newMoves: ['bubble'] }]);
});
