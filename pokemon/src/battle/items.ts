import { ITEMS, type ItemId } from '../data/items.ts';
import { maxHp, type Pokemon } from './pokemon.ts';

/** Un objet de soin aurait-il un effet sur ce Pokémon ? (Pas de Potion sur un Pokémon K.O. ou en pleine forme.) */
export function itemUsable(item: ItemId, pokemon: Pokemon): boolean {
  const def = ITEMS[item];
  if (pokemon.hp <= 0) return false;
  if (def.kind === 'heal') return pokemon.hp < maxHp(pokemon);
  if (def.kind === 'cure') return pokemon.status === def.cures;
  return false;
}
