import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatIngredient, formatQuantity, ingredientToLine, parseIngredient, readIngredients } from '../src/lib/ingredients.ts';

test('lecture des lignes d\'ingrédients courantes', () => {
  const cases: [string, ReturnType<typeof parseIngredient>][] = [
    ['200 g de chocolat noir', { quantity: 200, unit: 'g', name: 'chocolat noir' }],
    ['200g beurre demi-sel', { quantity: 200, unit: 'g', name: 'beurre demi-sel' }],
    ['1,5 l lait', { quantity: 1.5, unit: 'l', name: 'lait' }],
    ['1/2 c. à soupe de sucre', { quantity: 0.5, unit: 'c. à soupe', name: 'sucre' }],
    ['2 cuillères à café d\'huile', { quantity: 2, unit: 'c. à café', name: 'huile' }],
    ['1 1/2 verre de vin blanc', { quantity: 1.5, unit: 'verre', name: 'vin blanc' }],
    ['½ citron', { quantity: 0.5, unit: null, name: 'citron' }],
    ['3 œufs', { quantity: 3, unit: null, name: 'œufs' }],
    ['1 pincée de sel', { quantity: 1, unit: 'pincée', name: 'sel' }],
    ['Sel, poivre', { quantity: null, unit: null, name: 'Sel, poivre' }],
    ['2 gousses d’ail', { quantity: 2, unit: 'gousse', name: 'ail' }],
    // « g » ne doit pas avaler le début d'un mot.
    ['2 gros oignons', { quantity: 2, unit: null, name: 'gros oignons' }],
    ['  4   pommes  ', { quantity: 4, unit: null, name: 'pommes' }],
  ];
  for (const [line, expected] of cases) assert.deepEqual(parseIngredient(line), expected, line);
});

test('affichage des quantités en fractions de cuisine', () => {
  assert.equal(formatQuantity(0.5), '½');
  assert.equal(formatQuantity(1.25), '1 ¼');
  assert.equal(formatQuantity(1.3), '1,3');
  assert.equal(formatQuantity(200), '200');
  assert.deepEqual(formatIngredient({ quantity: 200, unit: 'g', name: 'farine' }), { amount: '200 g', name: 'farine' });
  assert.deepEqual(formatIngredient({ quantity: null, unit: null, name: 'sel' }), { amount: '', name: 'sel' });
});

test('aller-retour ligne → ingrédient → ligne', () => {
  for (const line of ['200 g chocolat noir', '½ c. à soupe sucre', '3 œufs', 'sel']) {
    assert.equal(ingredientToLine(parseIngredient(line)), line);
  }
});

test('lecture prudente de la colonne JSON', () => {
  assert.deepEqual(readIngredients([{ quantity: 2, unit: 'g', name: 'sel' }, { name: '' }, 'texte', null, { quantity: 'x', name: 'poivre' }]), [
    { quantity: 2, unit: 'g', name: 'sel' },
    { quantity: null, unit: null, name: 'poivre' },
  ]);
  assert.deepEqual(readIngredients('pas un tableau'), []);
});
