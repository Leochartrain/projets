import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cross, phenotype, rarity, type Genotype } from './genetics.ts';
import { Rng } from './rng.ts';

const g = (color: string, pattern: string): Genotype => ({
  color: [color[0], color[1]] as Genotype['color'],
  pattern: [pattern[0], pattern[1]] as Genotype['pattern'],
});

test('dominance des couleurs : G > N > v > a', () => {
  assert.equal(phenotype(g('Na', 'tt')).coat, 'normal');
  assert.equal(phenotype(g('va', 'tt')).coat, 'variante');
  assert.equal(phenotype(g('aa', 'tt')).coat, 'albinos');
  assert.equal(phenotype(g('aG', 'tt')).coat, 'dore');
});

test('le motif tacheté est dominant', () => {
  assert.equal(phenotype(g('NN', 'Tt')).spotted, true);
  assert.equal(phenotype(g('NN', 'tt')).spotted, false);
});

test('deux porteurs normaux (Na × Na) donnent environ un quart d’albinos', () => {
  const rng = new Rng(42);
  let albinos = 0;
  const n = 20_000;
  for (let i = 0; i < n; i++) {
    if (phenotype(cross(g('Na', 'tt'), g('Na', 'tt'), rng)).coat === 'albinos') albinos++;
  }
  // 25 % moins les mutations en doré (~2 % par allèle).
  assert.ok(albinos / n > 0.21 && albinos / n < 0.26, `albinos : ${albinos / n}`);
});

test('la mutation dorée reste rare', () => {
  const rng = new Rng(7);
  let dore = 0;
  const n = 20_000;
  for (let i = 0; i < n; i++) {
    if (phenotype(cross(g('NN', 'tt'), g('NN', 'tt'), rng)).coat === 'dore') dore++;
  }
  assert.ok(dore / n > 0.02 && dore / n < 0.06, `doré : ${dore / n}`);
});

test('la rareté augmente l’attraction', () => {
  assert.equal(rarity({ coat: 'normal', spotted: false }), 1);
  assert.ok(rarity({ coat: 'dore', spotted: true }) > rarity({ coat: 'albinos', spotted: false }));
});

test('le générateur est reproductible', () => {
  const a = new Rng(123);
  const b = new Rng(123);
  for (let i = 0; i < 10; i++) assert.equal(a.next(), b.next());
});
