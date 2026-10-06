// Tests des règles d'accès de la base : chaque migration est jouée dans
// PGlite (Postgres en WebAssembly), puis on agit tour à tour comme Alice,
// Bob et Carole pour vérifier qui voit et modifie quoi.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { before, describe, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const root = join(import.meta.dirname, '..');
const ALICE = '00000000-0000-4000-8000-00000000000a';
const BOB = '00000000-0000-4000-8000-00000000000b';
const CAROLE = '00000000-0000-4000-8000-00000000000c';

let db: PGlite;

/** Exécute une requête en tant qu'utilisateur connecté (ou en administrateur de la base si `user` est null). */
async function as<T = Record<string, unknown>>(user: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
  return db.transaction(async (tx) => {
    if (user) {
      await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [user]);
      await tx.exec('set local role authenticated');
    }
    return (await tx.query<T>(sql, params)).rows;
  });
}

/** Première ligne d'un résultat (erreur s'il est vide). */
async function first<T>(rows: Promise<T[]>): Promise<T> {
  const [row] = await rows;
  if (row === undefined) throw new Error('Aucune ligne');
  return row;
}

before(async () => {
  db = new PGlite();
  await db.exec(readFileSync(join(root, 'tests', 'supabase-stub.sql'), 'utf8'));
  const migrations = readdirSync(join(root, 'supabase', 'migrations')).filter((f) => f.endsWith('.sql')).sort();
  for (const file of migrations) await db.exec(readFileSync(join(root, 'supabase', 'migrations', file), 'utf8'));
  // Supabase donne ces droits par défaut ; les règles RLS font le tri ensuite.
  await db.exec('grant select, insert, update, delete on all tables in schema public to anon, authenticated');
  for (const [id, email, name] of [[ALICE, 'alice@exemple.fr', 'Alice'], [BOB, 'bob@exemple.fr', ''], [CAROLE, 'carole@exemple.fr', 'Carole']]) {
    await db.query('insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)', [id, email, { display_name: name }]);
  }
});

describe('comptes', () => {
  test("l'inscription crée un profil (prénom choisi, sinon début de l'e-mail)", async () => {
    const rows = await as<{ id: string; display_name: string }>(null, 'select id, display_name from public.profiles order by id');
    assert.deepEqual(rows.map((r) => r.display_name), ['Alice', 'bob', 'Carole']);
  });

  test("sans groupe commun, on ne voit que son propre profil", async () => {
    const rows = await as(BOB, 'select display_name from public.profiles');
    assert.deepEqual(rows, [{ display_name: 'bob' }]);
  });
});

describe('recettes et groupes', () => {
  let recipe: string;
  let group: string;

  test('une nouvelle recette est privée', async () => {
    ({ id: recipe } = await first(as<{ id: string }>(ALICE, `insert into public.recipes (title, ingredients, steps) values ($1, $2, $3) returning id`, [
      'Les cookies de Bertrand',
      JSON.stringify([{ quantity: 200, unit: 'g', name: 'chocolat noir' }, { quantity: 1, unit: null, name: 'œuf' }]),
      JSON.stringify(['Préchauffer le four.', 'Mélanger.']),
    ])));
    assert.equal((await as(ALICE, 'select id from public.recipes')).length, 1);
    assert.equal((await as(BOB, 'select id from public.recipes')).length, 0);
  });

  test("on ne peut pas créer une recette au nom de quelqu'un d'autre", async () => {
    await assert.rejects(as(BOB, `insert into public.recipes (author_id, title) values ($1, 'Faux')`, [ALICE]), /row-level security/);
  });

  test('le créateur d\'un groupe en est administrateur', async () => {
    ({ id: group } = await first(as<{ id: string }>(ALICE, `insert into public.groups (name) values ('Famille Richard') returning id`)));
    const members = await as(ALICE, 'select user_id, role from public.group_members where group_id = $1', [group]);
    assert.deepEqual(members, [{ user_id: ALICE, role: 'admin' }]);
    assert.equal((await as(BOB, 'select id from public.groups')).length, 0);
  });

  test("seul un administrateur crée des invitations, et on rejoint avec le code", async () => {
    await as(ALICE, `insert into public.invitations (code, group_id) values ('K7P2QX', $1)`, [group]);
    await assert.rejects(as(BOB, `insert into public.invitations (code, group_id) values ('ABCDEF', $1)`, [group]), /row-level security/);
    assert.equal((await as(BOB, 'select code from public.invitations')).length, 0, "un non-administrateur ne voit pas les codes");

    const preview = await first(as<{ group_name: string; member_count: number }>(BOB, `select * from public.invitation_preview('k7p2qx')`));
    assert.equal(preview.group_name, 'Famille Richard');
    const { join_group } = await first(as<{ join_group: string }>(BOB, `select public.join_group(' k7p2qx ')`));
    assert.equal(join_group, group);
    assert.equal((await as(BOB, 'select id from public.groups')).length, 1);
    // Membres du même groupe : les profils deviennent visibles.
    assert.equal((await as(BOB, 'select display_name from public.profiles')).length, 2);
  });

  test('un code expiré ou inconnu est refusé', async () => {
    await as(null, `insert into public.invitations (code, group_id, created_by, expires_at) values ('ZZZZZZ', $1, $2, now() - interval '1 day')`, [group, ALICE]);
    await assert.rejects(as(CAROLE, `select public.join_group('ZZZZZZ')`), /Code invalide ou expiré/);
    await assert.rejects(as(CAROLE, `select public.join_group('NOPE22')`), /Code invalide ou expiré/);
  });

  test('partager une recette la rend visible au groupe, et seulement à lui', async () => {
    await as(ALICE, 'select public.set_recipe_groups($1, $2)', [recipe, [group]]);
    assert.equal((await as(BOB, 'select id from public.recipes')).length, 1);
    assert.equal((await as(CAROLE, 'select id from public.recipes')).length, 0);
  });

  test("seul l'auteur modifie, supprime ou partage sa recette", async () => {
    const updated = await as(BOB, `update public.recipes set title = 'Piraté' where id = $1 returning id`, [recipe]);
    assert.equal(updated.length, 0);
    const deleted = await as(BOB, 'delete from public.recipes where id = $1 returning id', [recipe]);
    assert.equal(deleted.length, 0);
    await assert.rejects(as(BOB, 'select public.set_recipe_groups($1, $2)', [recipe, [group]]), /Seul l'auteur/);
    const { title } = await first(as<{ title: string }>(ALICE, 'select title from public.recipes where id = $1', [recipe]));
    assert.equal(title, 'Les cookies de Bertrand');
  });

  test("on ne partage pas dans un groupe dont on ne fait pas partie", async () => {
    const { id: own } = await first(as<{ id: string }>(CAROLE, `insert into public.recipes (title) values ('Tarte de Carole') returning id`));
    await assert.rejects(as(CAROLE, 'select public.set_recipe_groups($1, $2)', [own, [group]]), /ne fais pas partie/);
  });

  test('avis : les membres du groupe seulement, sur une recette partagée dans ce groupe', async () => {
    await as(BOB, `insert into public.reviews (recipe_id, group_id, rating, comment) values ($1, $2, 5, 'Délicieux !')`, [recipe, group]);
    await assert.rejects(as(CAROLE, `insert into public.reviews (recipe_id, group_id, rating) values ($1, $2, 1)`, [recipe, group]), /row-level security/);
    assert.equal((await as(ALICE, 'select id from public.reviews')).length, 1);
    assert.equal((await as(CAROLE, 'select id from public.reviews')).length, 0);
  });

  test('favoris : seulement sur une recette visible', async () => {
    await as(BOB, 'insert into public.favorites (recipe_id) values ($1)', [recipe]);
    await assert.rejects(as(CAROLE, 'insert into public.favorites (recipe_id) values ($1)', [recipe]), /row-level security/);
  });

  test('photos : visibles avec la recette, déposées seulement dans son propre dossier', async () => {
    const path = `${ALICE}/${recipe}/plat.webp`;
    await as(ALICE, `insert into storage.objects (bucket_id, name) values ('photos', $1)`, [path]);
    assert.equal((await as(BOB, 'select name from storage.objects')).length, 1);
    assert.equal((await as(CAROLE, 'select name from storage.objects')).length, 0);
    await assert.rejects(as(BOB, `insert into storage.objects (bucket_id, name) values ('photos', $1)`, [`${ALICE}/${recipe}/faux.webp`]), /row-level security/);
  });

  test('recherche plein texte en français (titre et ingrédients)', async () => {
    const byIngredient = await as(BOB, `select title from public.recipes where search @@ websearch_to_tsquery('french', 'chocolat')`);
    assert.equal(byIngredient.length, 1);
    const byTitle = await as(BOB, `select title from public.recipes where search @@ websearch_to_tsquery('french', 'cookie')`);
    assert.equal(byTitle.length, 1, 'racinisation : « cookie » trouve « cookies »');
  });

  test('retirer le partage retire l\'accès', async () => {
    await as(ALICE, 'select public.set_recipe_groups($1, $2)', [recipe, []]);
    assert.equal((await as(BOB, 'select id from public.recipes')).length, 0);
    assert.equal((await as(BOB, 'select name from storage.objects')).length, 0);
  });

  test("supprimer son compte efface ses données en cascade", async () => {
    await as(ALICE, 'select public.delete_my_account()');
    assert.equal((await as(null, 'select id from public.recipes where author_id = $1', [ALICE])).length, 0);
    assert.equal((await as(null, 'select id from public.groups where created_by = $1', [ALICE])).length, 0);
    assert.equal((await as(null, 'select id from public.profiles where id = $1', [ALICE])).length, 0);
  });
});
