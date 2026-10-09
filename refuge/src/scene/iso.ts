import { TILE_H, TILE_W } from '../art/canvas.ts';

/** Case de la carte → point du monde (la case (0, 0) a son coin nord en (0, 0)). */
export function toWorld(gx: number, gy: number): { x: number; y: number } {
  return { x: ((gx - gy) * TILE_W) / 2, y: ((gx + gy) * TILE_H) / 2 };
}

/** Point du monde → coordonnées de case (non arrondies). */
export function toGrid(x: number, y: number): { gx: number; gy: number } {
  const a = x / (TILE_W / 2);
  const b = y / (TILE_H / 2);
  return { gx: (a + b) / 2, gy: (b - a) / 2 };
}

/** Profondeur d'affichage : plus un objet est bas à l'écran, plus il passe devant. */
export function depthOf(gx: number, gy: number): number {
  return toWorld(gx, gy).y;
}
