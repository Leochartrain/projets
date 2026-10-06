import type { Direction } from '../core/input.ts';

/**
 * La Route 201, de Bonneville (à l'ouest) à Littorella (à l'est), avec le
 * chemin du Lac Vérité au nord. Une lettre par case :
 *
 *   T arbres     . herbe       , touffe       f fleurs      " hautes herbes
 *   : chemin     ~ eau         # clôture      _ rebord (on saute vers le bas)
 *   r rocher     s souche      b buisson      S panneau     M maman
 */
const LAYOUT = [
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTT..,.....f.....TTTTTTT..::.....,......f...TTTTTTT',
  'TTT..""""""".....,TTTTT....::.."""""""""""....TTTTTT',
  'TTT..""""""""..f...TT....,.::..""""""""""""....TTTTT',
  'TT...""""""""".....r.......::..""""""""""""....TTTTT',
  'TT...,"""""""..............::.....""""""""...~~~~~TT',
  'TT......................f..::.............b..~~~~~TT',
  'TT..f.....r......#######...::......,.........~~~~~TT',
  'TT....,..........S.........::..f.................TTT',
  'TT.........................::.....................TT',
  '::::::::::::::::::::::::::::::::::::::::::::::::::::',
  '::::::::::::::::::::::::::::::::::::::::::::::::::::',
  'TT..M.......,..............................S......TT',
  'TT.......______________.........._________........TT',
  'TT...,..........f..........r......................TT',
  'TT.....""""""""".......""""""""""..........f......TT',
  'TTT...""""""""""".....""""""""""""....""""""....TTTT',
  'TTT....""""""""""....""""""""""""".....""""""...TTTT',
  'TTTT....""""""".......,"""""""""".....""""""....TTTT',
  'TTTT.......f............................,......TTTTT',
  'TTTTTT....TTTT.....s........TTTTT.........TTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
];

export const MAP_WIDTH = LAYOUT[0].length;
export const MAP_HEIGHT = LAYOUT.length;
for (const [y, row] of LAYOUT.entries()) {
  if (row.length !== MAP_WIDTH) throw new Error(`Ligne ${y} de la carte : ${row.length} cases au lieu de ${MAP_WIDTH}`);
}

/** Départ : sur le chemin, à l'entrée de Bonneville, à côté de maman. */
export const START = { x: 3, y: 12, facing: 'right' as Direction };
/** Là où l'on se réveille après avoir perdu tous ses Pokémon. */
export const RESPAWN = { x: 4, y: 14, facing: 'up' as Direction };

/** Abscisse à partir de laquelle on est dans la zone est (autres Pokémon). */
export const EAST_ZONE_X = 26;

export function tileAt(x: number, y: number): string {
  if (y < 0 || y >= MAP_HEIGHT) return 'T';
  // Le chemin continue hors de la carte, vers les villes voisines.
  if (x < 0 || x >= MAP_WIDTH) return LAYOUT[y][x < 0 ? 0 : MAP_WIDTH - 1] === ':' ? ':' : 'T';
  return LAYOUT[y][x];
}

const BLOCKING = new Set(['T', '~', '#', 'r', 's', 'b', 'S', 'M']);

/** Peut-on entrer dans cette case en venant dans la direction `moving` ? (Un rebord ne se franchit que vers le bas.) */
export function canEnter(x: number, y: number, moving: Direction): boolean {
  const tile = tileAt(x, y);
  if (tile === '_') return moving === 'down';
  return !BLOCKING.has(tile);
}

export function isTallGrass(x: number, y: number): boolean {
  return tileAt(x, y) === '"';
}

export function isLedge(x: number, y: number): boolean {
  return tileAt(x, y) === '_';
}

export function isOutside(x: number, y: number): boolean {
  return x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT;
}

/** Textes des panneaux, par position. */
export const SIGNS: Record<string, string> = {
  '17,9': 'ROUTE 201\nBonneville ← → Littorella',
  '43,13': 'Littorella, plus loin à l\'est.\nLa ville du Labo du Professeur Sorbier.',
};

/** Ce que dit maman (elle soigne l'équipe). */
export const MOM = {
  x: 4,
  y: 13,
  lines: ['MAMAN : Oh, ton Pokémon a l\'air fatigué !', 'Repose-toi un peu à la maison…', '…', 'Ton équipe est en pleine forme ! Fais bien attention à toi !'],
};

/** Messages quand on essaie de sortir de la carte. */
export function exitMessage(x: number): string {
  return x < 0
    ? 'Bonneville, ta ville natale. Maman t\'a dit de bien explorer la route avant de rentrer !'
    : 'Littorella est encore loin… La route n\'est pas finie pour l\'instant !';
}

/** Le chemin du nord mène au Lac Vérité (pas encore accessible). */
export const LAKE_PATH_END = { x1: 27, x2: 28, y: 2 };
export const LAKE_MESSAGE = 'Des arbres bloquent le passage vers le Lac Vérité… On y viendra plus tard !';
