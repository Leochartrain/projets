import type { Type } from './types.ts';

/** Statistiques qu'une attaque peut monter ou baisser en combat (précision et esquive comprises). */
export type StageStat = 'atk' | 'def' | 'spa' | 'spd' | 'spe' | 'acc' | 'eva';

export type MoveEffect =
  /** Change des statistiques (de la cible ou du lanceur), à coup sûr ou avec une probabilité en %. */
  | { kind: 'stages'; target: 'foe' | 'self'; changes: Partial<Record<StageStat, number>>; chance?: number }
  /** Empoisonne ou paralyse la cible (probabilité en %). */
  | { kind: 'status'; status: 'poison' | 'paralysis'; chance: number }
  /** Rend au lanceur une part des dégâts infligés. */
  | { kind: 'drain'; ratio: number }
  /** La cible, si elle n'a pas encore agi, est apeurée et passe son tour (probabilité en %). */
  | { kind: 'flinch'; chance: number }
  /** Effets particuliers, gérés un par un par le combat. */
  | { kind: 'bide' | 'rollout' | 'charge' | 'teleport' | 'waterSport' };

export interface MoveDef {
  id: MoveId;
  name: string;
  type: Type;
  /** Physique (Attaque/Défense), spéciale (Atq. Spé./Déf. Spé.) : en 4e génération, chaque attaque a sa catégorie. */
  category: 'physical' | 'special' | 'status';
  /** null : attaque de statut, ou dégâts calculés à part (Patience). */
  power: number | null;
  /** En % ; null : ne rate jamais. */
  accuracy: number | null;
  pp: number;
  priority: number;
  effects: MoveEffect[];
  description: string;
}

export type MoveId =
  | 'pound'
  | 'growl'
  | 'bubble'
  | 'water-sport'
  | 'peck'
  | 'tackle'
  | 'quick-attack'
  | 'wing-attack'
  | 'double-team'
  | 'defense-curl'
  | 'rollout'
  | 'leer'
  | 'charge'
  | 'bite'
  | 'absorb'
  | 'growth'
  | 'stun-spore'
  | 'mega-drain'
  | 'string-shot'
  | 'poison-sting'
  | 'teleport'
  | 'bide';

/** Valeurs de Diamant et Perle (données PokeAPI, avec les valeurs d'époque quand elles ont changé depuis). */
export const MOVES: Record<MoveId, MoveDef> = {
  pound: {
    id: 'pound', name: "Écras'Face", type: 'normal', category: 'physical', power: 40, accuracy: 100, pp: 35, priority: 0,
    effects: [], description: "Écrase l'ennemi avec les pattes avant ou la queue.",
  },
  growl: {
    id: 'growl', name: 'Rugissement', type: 'normal', category: 'status', power: null, accuracy: 100, pp: 40, priority: 0,
    effects: [{ kind: 'stages', target: 'foe', changes: { atk: -1 } }], description: "Un cri mignon qui baisse l'Attaque de l'ennemi.",
  },
  bubble: {
    id: 'bubble', name: 'Écume', type: 'water', category: 'special', power: 20, accuracy: 100, pp: 30, priority: 0,
    effects: [{ kind: 'stages', target: 'foe', changes: { spe: -1 }, chance: 10 }], description: 'Une pluie de bulles. Peut baisser la Vitesse.',
  },
  'water-sport': {
    id: 'water-sport', name: 'Tourniquet', type: 'water', category: 'status', power: null, accuracy: null, pp: 15, priority: 0,
    effects: [{ kind: 'waterSport' }], description: 'Le lanceur se trempe : les attaques Feu sont affaiblies.',
  },
  peck: {
    id: 'peck', name: 'Picpic', type: 'flying', category: 'physical', power: 35, accuracy: 100, pp: 35, priority: 0,
    effects: [], description: "Frappe l'ennemi avec un bec pointu ou une corne.",
  },
  tackle: {
    id: 'tackle', name: 'Charge', type: 'normal', category: 'physical', power: 35, accuracy: 95, pp: 35, priority: 0,
    effects: [], description: "Le lanceur charge l'ennemi de tout son corps.",
  },
  'quick-attack': {
    id: 'quick-attack', name: 'Vive-Attaque', type: 'normal', category: 'physical', power: 40, accuracy: 100, pp: 30, priority: 1,
    effects: [], description: 'Une charge éclair qui frappe toujours en premier.',
  },
  'wing-attack': {
    id: 'wing-attack', name: 'Cru-Ailes', type: 'flying', category: 'physical', power: 60, accuracy: 100, pp: 35, priority: 0,
    effects: [], description: "Frappe l'ennemi avec de grandes ailes déployées.",
  },
  'double-team': {
    id: 'double-team', name: 'Reflet', type: 'normal', category: 'status', power: null, accuracy: null, pp: 15, priority: 0,
    effects: [{ kind: 'stages', target: 'self', changes: { eva: 1 } }], description: "Crée des copies illusoires qui augmentent l'esquive.",
  },
  'defense-curl': {
    id: 'defense-curl', name: "Boul'Armure", type: 'normal', category: 'status', power: null, accuracy: null, pp: 40, priority: 0,
    effects: [{ kind: 'stages', target: 'self', changes: { def: 1 } }], description: 'Le lanceur se roule en boule et augmente sa Défense.',
  },
  rollout: {
    id: 'rollout', name: 'Roulade', type: 'rock', category: 'physical', power: 30, accuracy: 90, pp: 20, priority: 0,
    effects: [{ kind: 'rollout' }], description: 'Roule pendant 5 tours, de plus en plus fort à chaque coup.',
  },
  leer: {
    id: 'leer', name: "Groz'Yeux", type: 'normal', category: 'status', power: null, accuracy: 100, pp: 30, priority: 0,
    effects: [{ kind: 'stages', target: 'foe', changes: { def: -1 } }], description: "Un regard intimidant qui baisse la Défense de l'ennemi.",
  },
  charge: {
    id: 'charge', name: 'Chargeur', type: 'electric', category: 'status', power: null, accuracy: null, pp: 20, priority: 0,
    effects: [{ kind: 'charge' }, { kind: 'stages', target: 'self', changes: { spd: 1 } }],
    description: "Double la puissance de la prochaine attaque Électrik et augmente la Déf. Spé.",
  },
  bite: {
    id: 'bite', name: 'Morsure', type: 'dark', category: 'physical', power: 60, accuracy: 100, pp: 25, priority: 0,
    effects: [{ kind: 'flinch', chance: 30 }], description: "Mord l'ennemi avec des crocs acérés. Peut l'apeurer.",
  },
  absorb: {
    id: 'absorb', name: 'Vole-Vie', type: 'grass', category: 'special', power: 20, accuracy: 100, pp: 25, priority: 0,
    effects: [{ kind: 'drain', ratio: 0.5 }], description: 'Draine la moitié des dégâts infligés pour se soigner.',
  },
  growth: {
    id: 'growth', name: 'Croissance', type: 'normal', category: 'status', power: null, accuracy: null, pp: 40, priority: 0,
    effects: [{ kind: 'stages', target: 'self', changes: { spa: 1 } }], description: "Le corps grandit d'un coup : l'Atq. Spé. augmente.",
  },
  'stun-spore': {
    id: 'stun-spore', name: 'Para-Spore', type: 'grass', category: 'status', power: null, accuracy: 75, pp: 30, priority: 0,
    effects: [{ kind: 'status', status: 'paralysis', chance: 100 }], description: 'Une poudre qui paralyse la cible.',
  },
  'mega-drain': {
    id: 'mega-drain', name: 'Méga-Sangsue', type: 'grass', category: 'special', power: 40, accuracy: 100, pp: 15, priority: 0,
    effects: [{ kind: 'drain', ratio: 0.5 }], description: 'Draine la moitié des dégâts infligés pour se soigner.',
  },
  'string-shot': {
    id: 'string-shot', name: 'Sécrétion', type: 'bug', category: 'status', power: null, accuracy: 95, pp: 40, priority: 0,
    effects: [{ kind: 'stages', target: 'foe', changes: { spe: -1 } }], description: "Ligote l'ennemi de soie : sa Vitesse baisse.",
  },
  'poison-sting': {
    id: 'poison-sting', name: 'Dard-Venin', type: 'poison', category: 'physical', power: 15, accuracy: 100, pp: 35, priority: 0,
    effects: [{ kind: 'status', status: 'poison', chance: 30 }], description: 'Un dard empoisonné. Peut empoisonner la cible.',
  },
  teleport: {
    id: 'teleport', name: 'Téléport', type: 'psychic', category: 'status', power: null, accuracy: null, pp: 20, priority: 0,
    effects: [{ kind: 'teleport' }], description: "Permet de fuir un Pokémon sauvage.",
  },
  bide: {
    id: 'bide', name: 'Patience', type: 'normal', category: 'physical', power: null, accuracy: null, pp: 10, priority: 1,
    effects: [{ kind: 'bide' }], description: 'Encaisse les coups pendant 2 tours, puis les renvoie au double.',
  },
};
