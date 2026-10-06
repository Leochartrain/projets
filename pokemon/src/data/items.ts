export type ItemId = 'potion' | 'antidote' | 'paralyze-heal' | 'poke-ball';

export interface ItemDef {
  id: ItemId;
  name: string;
  kind: 'heal' | 'cure' | 'ball';
  /** PV rendus (Potion). */
  heal?: number;
  /** Statut soigné (Antidote, Anti-Para). */
  cures?: 'poison' | 'paralysis';
  /** Bonus de capture (Poké Ball : ×1). */
  ballBonus?: number;
  description: string;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  potion: { id: 'potion', name: 'Potion', kind: 'heal', heal: 20, description: "Restaure 20 PV d'un Pokémon." },
  antidote: { id: 'antidote', name: 'Antidote', kind: 'cure', cures: 'poison', description: "Soigne un Pokémon de l'empoisonnement." },
  'paralyze-heal': { id: 'paralyze-heal', name: 'Anti-Para', kind: 'cure', cures: 'paralysis', description: "Soigne un Pokémon de la paralysie." },
  'poke-ball': { id: 'poke-ball', name: 'Poké Ball', kind: 'ball', ballBonus: 1, description: 'Un objet pour attraper les Pokémon sauvages.' },
};

/** Ordre d'affichage dans le Sac. */
export const ITEM_ORDER: ItemId[] = ['potion', 'antidote', 'paralyze-heal', 'poke-ball'];
