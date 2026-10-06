import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seeded } from '../core/random.ts';
import { Battle, type BattleEvent } from './battle.ts';
import { createPokemon, maxHp } from './pokemon.ts';

const texts = (events: BattleEvent[]) => events.flatMap((e) => (e.type === 'text' ? [e.text] : []));

/** Joue des tours avec la première attaque jusqu'à la fin du combat (ou une limite). */
function fight(battle: Battle, limit = 60): BattleEvent[] {
  const all: BattleEvent[] = [];
  for (let i = 0; i < limit && !battle.outcome; i++) {
    const events = battle.locked ? battle.continueLocked() : battle.turn({ kind: 'move', slot: 0 });
    all.push(...events);
    if (events.some((e) => e.type === 'needSwitch')) {
      const next = battle.party.findIndex((_, index) => battle.canSwitchTo(index));
      all.push(...battle.sendReplacement(next));
    }
  }
  return all;
}

test('un combat se termine, et les PV restent cohérents', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const rng = seeded(seed);
    const piplup = createPokemon('piplup', 5, rng);
    const wild = createPokemon('starly', 3, rng);
    const battle = new Battle([piplup], wild, rng);
    const start = texts(battle.start());
    assert.equal(start[0], 'Un Étourmi sauvage apparaît !');
    assert.equal(start[1], 'Go ! Tiplouf !');
    const events = fight(battle);
    assert.ok(battle.outcome === 'win' || battle.outcome === 'lose', `graine ${seed} : ${battle.outcome}`);
    assert.equal(events.filter((e) => e.type === 'end').length, 1);
    for (const pokemon of [piplup, wild]) assert.ok(pokemon.hp >= 0 && pokemon.hp <= maxHp(pokemon));
    if (battle.outcome === 'win') assert.ok(texts(events).some((t) => t.includes("points d'expérience")));
  }
});

test('Tiplouf au niveau 5 bat presque toujours un Étourmi de niveau 2 à 4', () => {
  let wins = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const rng = seeded(seed);
    const battle = new Battle([createPokemon('piplup', 5, rng)], createPokemon('starly', 2 + (seed % 3), rng), rng);
    battle.start();
    fight(battle);
    if (battle.outcome === 'win') wins++;
  }
  assert.ok(wins >= 85, `${wins} victoires sur 100`);
});

test('capture : avec assez de Poké Balls, le Pokémon finit attrapé', () => {
  const rng = seeded(11);
  const battle = new Battle([createPokemon('piplup', 5, rng)], createPokemon('bidoof', 3, rng), rng);
  battle.start();
  let balls = 0;
  while (!battle.outcome && balls < 50) {
    battle.turn({ kind: 'item', item: 'poke-ball', target: 0 });
    balls++;
  }
  assert.equal(battle.outcome, 'caught');
});

test('Abra se téléporte et le combat s\'arrête', () => {
  const rng = seeded(5);
  const battle = new Battle([createPokemon('piplup', 5, rng)], createPokemon('abra', 4, rng), rng);
  battle.start();
  const events = battle.turn({ kind: 'move', slot: 1 }); // Rugissement : Abra agit quoi qu'il arrive
  assert.equal(battle.outcome, 'fled');
  assert.ok(texts(events).includes("Abra sauvage s'enfuit !"));
});

test('Rugissement baisse l\'Attaque, avec un message bien accordé', () => {
  const rng = seeded(9);
  const battle = new Battle([createPokemon('piplup', 5, rng)], createPokemon('bidoof', 3, rng), rng);
  battle.start();
  const events = texts(battle.turn({ kind: 'move', slot: 1 }));
  assert.ok(events.includes("L'Attaque de Keunotor sauvage baisse !"), events.join(' | '));
});

test('Patience : 2 tours à encaisser, puis le double des dégâts subis', () => {
  const rng = seeded(4);
  const kricketot = createPokemon('kricketot', 6, rng);
  kricketot.moves = [{ id: 'bide', pp: 10 }];
  const wild = createPokemon('bidoof', 3, rng);
  wild.moves = [{ id: 'tackle', pp: 35 }];
  const battle = new Battle([kricketot], wild, rng);
  battle.start();
  battle.turn({ kind: 'move', slot: 0 });
  assert.ok(battle.locked);
  const all = [...battle.continueLocked()];
  if (!battle.outcome) all.push(...battle.continueLocked());
  assert.ok(texts(all).includes('Crikzik libère son énergie !'));
  assert.equal(battle.locked, false);
});

test('changement forcé après un K.O., puis défaite quand toute l\'équipe est K.O.', () => {
  const rng = seeded(21);
  const weak = createPokemon('kricketot', 2, rng);
  const weak2 = createPokemon('kricketot', 2, rng);
  weak.hp = weak2.hp = 1;
  const wild = createPokemon('shinx', 6, rng);
  const battle = new Battle([weak, weak2], wild, rng);
  battle.start();
  const events = fight(battle);
  assert.ok(events.some((e) => e.type === 'needSwitch'));
  assert.equal(battle.outcome, 'lose');
});

test('Potion : rend 20 PV sans dépasser le maximum', () => {
  const rng = seeded(8);
  const piplup = createPokemon('piplup', 10, rng);
  piplup.hp = 5;
  const battle = new Battle([piplup], createPokemon('kricketot', 2, rng), rng);
  battle.start();
  const events = texts(battle.turn({ kind: 'item', item: 'potion', target: 0 }));
  assert.ok(events.includes('Tiplouf récupère 20 PV !'), events.join(' | '));
});
