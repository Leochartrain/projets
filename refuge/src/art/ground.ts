import { MAP_SIZE } from '../game/config.ts';
import { TILE_H, TILE_W, makeCanvas, seeded } from './canvas.ts';

/** Nombre de cases de forêt dessinées autour de la carte. */
export const MARGIN = 7;

export interface Ground {
  canvas: HTMLCanvasElement;
  /** Position, dans le monde, du coin haut-gauche du canvas. */
  x: number;
  y: number;
}

/**
 * Tout le sol en une seule image (résolution 1:1 : c'est un fond, il n'a pas besoin
 * d'être aussi net que les bâtiments). Damier d'herbe façon Clash of Clans sur la carte,
 * herbe plus sombre dans la forêt autour.
 */
export function ground(): Ground {
  const total = MAP_SIZE + MARGIN * 2;
  const w = total * TILE_W;
  const h = total * TILE_H;
  const [canvas, ctx] = makeCanvas(w, h);
  // Le coin nord de la case (-MARGIN, -MARGIN) est en haut au centre du canvas.
  const ox = w / 2;
  const oy = 0;
  const at = (gx: number, gy: number): [number, number] => [
    ox + ((gx + MARGIN - (gy + MARGIN)) * TILE_W) / 2,
    oy + ((gx + MARGIN + gy + MARGIN) * TILE_H) / 2,
  ];
  const diamond = (gx: number, gy: number, size = 1) => {
    const [x0, y0] = at(gx, gy);
    const [x1, y1] = at(gx + size, gy);
    const [x2, y2] = at(gx + size, gy + size);
    const [x3, y3] = at(gx, gy + size);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.closePath();
  };

  // Forêt.
  diamond(-MARGIN, -MARGIN, total);
  ctx.fillStyle = '#5c9a32';
  ctx.fill();

  // Damier de la carte.
  for (let gy = 0; gy < MAP_SIZE; gy++) {
    for (let gx = 0; gx < MAP_SIZE; gx++) {
      diamond(gx, gy);
      ctx.fillStyle = (gx + gy) % 2 ? '#8fca43' : '#86c23d';
      ctx.fill();
    }
  }

  // Liseré entre la carte et la forêt.
  diamond(0, 0, MAP_SIZE);
  ctx.strokeStyle = 'rgba(60, 100, 25, 0.55)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Touffes d'herbe et petites fleurs.
  const rand = seeded(2024);
  for (let i = 0; i < 2600; i++) {
    const gx = -MARGIN + rand() * total;
    const gy = -MARGIN + rand() * total;
    const inside = gx >= 0 && gy >= 0 && gx < MAP_SIZE && gy < MAP_SIZE;
    const [x, y] = at(gx, gy);
    if (rand() < 0.06 && inside) {
      ctx.fillStyle = rand() < 0.5 ? '#ffffff' : '#ffe46b';
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.strokeStyle = inside ? 'rgba(70, 130, 30, 0.55)' : 'rgba(40, 90, 25, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 3, y);
    ctx.lineTo(x - 4, y - 5);
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 7);
    ctx.moveTo(x + 3, y);
    ctx.lineTo(x + 4, y - 5);
    ctx.stroke();
  }

  // La case (0, 0) est à l'origine du monde.
  const [zx, zy] = at(0, 0);
  return { canvas, x: -zx, y: -zy };
}
