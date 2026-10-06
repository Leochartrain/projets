import type { Assets } from '../core/assets.ts';
import { TILE } from '../core/constants.ts';
import { seeded } from '../core/random.ts';
import { MAP_HEIGHT, MAP_WIDTH, tileAt } from './map.ts';

/** Un décor dessiné dans l'ordre de profondeur (le bas du sprite décide qui passe devant). */
export interface Prop {
  /** Bas du sprite en pixels du monde (clé de tri). */
  bottom: number;
  draw(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number): void;
}

/** Décors de objects.png (Mystic Woods) : position dans la planche, taille, et point posé au sol. */
const SPRITES = {
  tree: { sx: 1, sy: 80, sw: 45, sh: 64, footY: 58 },
  appleTree: { sx: 49, sy: 80, sw: 45, sh: 64, footY: 58 },
  pine: { sx: 3, sy: 147, sw: 43, sh: 61, footY: 56 },
  pine2: { sx: 51, sy: 147, sw: 43, sh: 61, footY: 56 },
  bush: { sx: 96, sy: 112, sw: 32, sh: 32, footY: 28 },
  stump: { sx: 166, sy: 93, sw: 20, sh: 17, footY: 14 },
  sign: { sx: 0, sy: 0, sw: 16, sh: 16, footY: 15 },
} as const;

const TREE_KINDS = ['tree', 'tree', 'pine', 'pine2', 'appleTree'] as const;

/** Rendu de la route : le sol est pré-dessiné une fois, les décors hauts sont triés avec les personnages. */
export class WorldRenderer {
  readonly ground: HTMLCanvasElement;
  readonly props: Prop[] = [];
  /** Hautes herbes, deux images (la seconde quand on vient de marcher dedans). */
  readonly tallGrass: HTMLCanvasElement[];
  private readonly assets: Assets;

  constructor(assets: Assets) {
    this.assets = assets;
    this.tallGrass = [tallGrassTile(0), tallGrassTile(1)];
    this.ground = document.createElement('canvas');
    this.ground.width = MAP_WIDTH * TILE;
    this.ground.height = MAP_HEIGHT * TILE;
    this.drawGround(this.ground.getContext('2d')!);
    this.placeProps();
  }

  private drawGround(g: CanvasRenderingContext2D): void {
    const { sheets } = this.assets;
    const rng = seeded(201);
    const tile = (image: CanvasImageSource, col: number, row: number, x: number, y: number) =>
      g.drawImage(image, col * TILE, row * TILE, TILE, TILE, x * TILE, y * TILE, TILE, TILE);

    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const kind = tileAt(x, y);
        g.drawImage(sheets.grass, x * TILE, y * TILE);
        switch (kind) {
          case '.':
            if (rng() < 0.07) tile(sheets.decor, Math.floor(rng() * 4), 0, x, y);
            break;
          case ',':
            tile(sheets.decor, Math.floor(rng() * 4), 0, x, y);
            break;
          case 'f':
            tile(sheets.decor, Math.floor(rng() * 3), 2, x, y);
            break;
          case 'r':
            tile(sheets.decor, 2, 1, x, y);
            break;
          case ':':
            this.drawPath(g, x, y);
            break;
          case '~':
            this.drawWater(g, x, y);
            break;
          case '_':
            // Rebord : la bordure de falaise des plateaux d'herbe.
            tile(sheets.plains, tileAt(x - 1, y) === '_' ? (tileAt(x + 1, y) === '_' ? 2 : 3) : 1, 6, x, y);
            break;
          case '#':
            tile(sheets.fences, tileAt(x - 1, y) === '#' ? (tileAt(x + 1, y) === '#' ? 2 : 3) : 1, 3, x, y);
            break;
          case '"':
            g.drawImage(this.tallGrass[0], x * TILE, y * TILE);
            break;
          case 'T':
            // Sous-bois un peu plus sombre entre les arbres (léger, pour ne pas dessiner de carrés sur la lisière).
            g.fillStyle = 'rgba(16, 48, 24, 0.15)';
            g.fillRect(x * TILE, y * TILE, TILE, TILE);
            break;
        }
      }
    }
  }

  /**
   * Chemin de terre : bords et coins extérieurs selon les cases voisines (les
   * 9 pièces de plains.png), et coins intérieurs quand seule une diagonale est de l'herbe.
   */
  private drawPath(g: CanvasRenderingContext2D, x: number, y: number): void {
    const path = (dx: number, dy: number) => tileAt(x + dx, y + dy) === ':';
    const n = path(0, -1);
    const s = path(0, 1);
    const w = path(-1, 0);
    const e = path(1, 0);
    let col = 2;
    let row = 1;
    if (n && s && w && e) {
      if (!path(-1, -1)) [col, row] = [5, 1];
      else if (!path(1, -1)) [col, row] = [4, 1];
      else if (!path(-1, 1)) [col, row] = [5, 0];
      else if (!path(1, 1)) [col, row] = [4, 0];
    } else {
      col = !w ? 1 : !e ? 3 : 2;
      row = !n ? 0 : !s ? 2 : 1;
    }
    g.drawImage(this.assets.sheets.plains, col * TILE, row * TILE, TILE, TILE, x * TILE, y * TILE, TILE, TILE);
  }

  /** Mare : les 9 pièces de water1.png (berges comprises) selon la place dans le rectangle d'eau. */
  private drawWater(g: CanvasRenderingContext2D, x: number, y: number): void {
    const water = (dx: number, dy: number) => tileAt(x + dx, y + dy) === '~';
    const col = !water(-1, 0) ? 1 : !water(1, 0) ? 3 : 2;
    const row = !water(0, -1) ? 0 : !water(0, 1) ? 2 : 1;
    g.drawImage(this.assets.sheets.water, col * TILE, row * TILE, TILE, TILE, x * TILE, y * TILE, TILE, TILE);
  }

  /** Arbres serrés sur les cases de forêt, et décors hauts. */
  private placeProps(): void {
    const rng = seeded(4);
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const kind = tileAt(x, y);
        // Un arbre toutes les 2 cases, en quinconce d'une rangée sur l'autre : une forêt dense.
        // Sur la lisière (une case d'herbe à côté), un de plus pour ne pas laisser de trou.
        const inGrid = y % 2 === 0 && (x + (y % 4 === 0 ? 0 : 1)) % 2 === 0;
        const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => tileAt(x + dx, y + dy) !== 'T') && (x + y) % 2 === 0;
        if (kind === 'T' && (inGrid || edge)) {
          this.addSprite(TREE_KINDS[Math.floor(rng() * TREE_KINDS.length)], x, y, (rng() - 0.5) * 6);
        }
        if (kind === 'T' && y === MAP_HEIGHT - 1 && x % 2 === 1) this.addSprite('tree', x, y + 1, 0);
        if (kind === 'b') this.addSprite('bush', x, y, 0);
        if (kind === 's') this.addSprite('stump', x, y, 0);
        if (kind === 'S') this.addSprite('sign', x, y, 0);
      }
    }
  }

  /** Pose un décor centré sur la case (x, y), le pied au bas de la case. */
  private addSprite(kind: keyof typeof SPRITES, x: number, y: number, jitter: number): void {
    const sprite = SPRITES[kind];
    const left = Math.round(x * TILE + TILE / 2 - sprite.sw / 2 + jitter);
    const top = (y + 1) * TILE - sprite.footY;
    const image = this.assets.sheets.objects;
    this.props.push({
      bottom: (y + 1) * TILE,
      draw: (ctx, cameraX, cameraY) => ctx.drawImage(image, sprite.sx, sprite.sy, sprite.sw, sprite.sh, left - cameraX, top - cameraY, sprite.sw, sprite.sh),
    });
  }
}

/**
 * Case de hautes herbes en pixel art (pixel par pixel, sans flou), façon Diamant
 * et Perle : deux rangées de pointes serrées qui recouvrent toute la case, la
 * rangée de devant décalée. `frame` 1 : les pointes penchent (on vient d'y marcher).
 */
function tallGrassTile(frame: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TILE;
  const ctx = canvas.getContext('2d')!;
  const OUTLINE = '#1c4a2a';
  const BODY = '#2f8040';
  const LIGHT = '#5cb854';
  const BASE = '#2a6e38';
  const put = (x: number, y: number, color: string) => {
    if (x < 0 || x >= TILE || y < 0 || y >= TILE) return;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  };
  /** Une feuille pointue : sommet en (ax, ay), elle s'élargit vers le bas, avec une nervure claire. */
  const leaf = (ax: number, ay: number, height: number, lean: number) => {
    for (let r = 0; r < height; r++) {
      const half = Math.min(4, Math.floor(r * 0.7));
      const cx = ax + (r < 4 ? lean : 0);
      for (let dx = -half; dx <= half; dx++) {
        const edge = r === 0 || dx === -half || dx === half;
        put(cx + dx, ay + r, edge ? OUTLINE : dx === -1 && r > 1 && r < height - 2 ? LIGHT : BODY);
      }
    }
  };
  // Fond plus sombre que l'herbe rase : la zone se repère de loin.
  ctx.fillStyle = BASE;
  ctx.fillRect(0, 6, TILE, TILE - 6);
  const lean = frame === 1 ? 1 : 0;
  for (const x of [3, 11]) leaf(x, 0, 9, lean);
  for (const x of [-1, 7, 15]) leaf(x, 6, 10, -lean);
  return canvas;
}
