import assert from 'node:assert/strict';
import { test } from 'node:test';
import { recipeFormSchema } from '../src/features/recipes/form.ts';

test('formulaire de recette : nombres facultatifs, virgule française, titre obligatoire', () => {
  const ok = recipeFormSchema.safeParse({ title: '  Cookies  ', servings: '1,5', prepMinutes: '', cookMinutes: '10' });
  assert.ok(ok.success);
  assert.deepEqual(ok.data, { title: 'Cookies', servings: 1.5, prepMinutes: null, cookMinutes: 10 });

  const bad = recipeFormSchema.safeParse({ title: '   ', servings: 'beaucoup', prepMinutes: '-5', cookMinutes: '' });
  assert.equal(bad.success, false);
  const fields = bad.error?.issues.map((issue) => issue.path[0]).sort();
  assert.deepEqual(fields, ['prepMinutes', 'servings', 'title']);
});
