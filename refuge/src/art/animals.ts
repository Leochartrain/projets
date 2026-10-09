import type { CoatColors, Species } from '../game/config.ts';
import type { Coat } from '../game/genetics.ts';
import { OUTLINE, RES, makeCanvas, seeded, shade } from './canvas.ts';

/**
 * Animaux vus de profil, tournés vers la droite (on les retourne pour aller à gauche).
 * Le point d'ancrage est entre les pattes, au sol.
 */

export const ANIMAL_W = 44;
export const ANIMAL_H = 46;

type Ctx = CanvasRenderingContext2D;

function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string, stroke = true, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.3;
    ctx.stroke();
  }
}

function leg(ctx: Ctx, x: number, top: number, bottom: number, w: number, fill: string): void {
  ctx.beginPath();
  ctx.roundRect(x - w / 2, top, w, bottom - top, w / 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

function eye(ctx: Ctx, x: number, y: number, r = 1.7, color = '#1d1410'): void {
  ellipse(ctx, x, y, r, r * 1.15, color, false);
  ellipse(ctx, x + r * 0.35, y - r * 0.4, r * 0.4, r * 0.4, '#ffffff', false);
}

function poly(ctx: Ctx, points: [number, number][], fill: string, stroke = true): void {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
}

/** Taches dessinées à l'intérieur du corps. */
function spots(ctx: Ctx, x: number, y: number, rx: number, ry: number, color: string, seed: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, rx - 0.6, ry - 0.6, 0, 0, Math.PI * 2);
  ctx.clip();
  const rand = seeded(seed);
  for (let i = 0; i < 6; i++) {
    ellipse(ctx, x + (rand() - 0.5) * rx * 1.6, y + (rand() - 0.6) * ry * 1.4, 1.6 + rand() * 2, 1.3 + rand() * 1.6, color, false);
  }
  ctx.restore();
}

function lapin(ctx: Ctx, c: CoatColors, spotted: boolean, coat: Coat): void {
  const ground = 40;
  ellipse(ctx, 22, ground, 10, 2.5, 'rgba(0,0,0,0.2)', false);
  ellipse(ctx, 12, 31, 3.5, 3.5, '#ffffff'); // queue
  leg(ctx, 16, 33, ground, 4, shade(c.body, -0.15));
  leg(ctx, 26, 33, ground, 3.5, shade(c.body, -0.15));
  ellipse(ctx, 20, 31, 9, 7.5, c.body);
  ellipse(ctx, 21, 34, 5, 3.5, c.belly, false);
  if (spotted) spots(ctx, 20, 31, 9, 7.5, shade(c.body, -0.35), 1);
  // Oreilles.
  ellipse(ctx, 26, 13, 2.6, 7.5, c.body, true, -0.15);
  ellipse(ctx, 26, 13, 1.2, 5.5, c.accent, false, -0.15);
  ellipse(ctx, 31, 14, 2.6, 7.5, c.body, true, 0.25);
  ellipse(ctx, 31, 14, 1.2, 5.5, c.accent, false, 0.25);
  ellipse(ctx, 29, 24, 7, 6.2, c.body);
  ellipse(ctx, 32, 27, 3, 2.2, c.belly, false);
  eye(ctx, 31, 22.5, 1.6, coat === 'albinos' ? '#d0405a' : '#1d1410');
  ellipse(ctx, 35.3, 25.5, 1.1, 0.9, c.accent, false);
}

function mouton(ctx: Ctx, c: CoatColors, spotted: boolean): void {
  const ground = 41;
  ellipse(ctx, 22, ground, 12, 2.6, 'rgba(0,0,0,0.2)', false);
  for (const x of [13, 18, 25, 30]) leg(ctx, x, 32, ground, 3.2, c.accent);
  // Toison en boules.
  const wool = [[12, 27], [17, 23], [23, 22], [28, 25], [14, 32], [20, 33], [26, 32], [31, 30]];
  for (const [x, y] of wool) ellipse(ctx, x, y, 5.5, 5.2, c.body);
  ellipse(ctx, 21, 28, 10, 6.5, c.body, false);
  if (spotted) spots(ctx, 21, 28, 11, 8, shade(c.accent, 0.15), 2);
  // Tête.
  ellipse(ctx, 32, 20, 2.5, 4.5, c.accent, true, 1.1);
  ellipse(ctx, 36, 23, 5, 6, c.accent);
  ellipse(ctx, 35, 17.5, 4, 3, c.body);
  eye(ctx, 37.5, 22, 1.4, '#ffffff');
  eye(ctx, 37.5, 22, 1, '#1d1410');
}

function cochon(ctx: Ctx, c: CoatColors, spotted: boolean): void {
  const ground = 41;
  ellipse(ctx, 22, ground, 12, 2.6, 'rgba(0,0,0,0.2)', false);
  for (const x of [13, 18, 25, 30]) leg(ctx, x, 32, ground, 4, shade(c.body, -0.1));
  // Queue en tire-bouchon.
  ctx.beginPath();
  ctx.arc(8.5, 25, 2.2, 0, Math.PI * 1.6);
  ctx.strokeStyle = shade(c.body, -0.25);
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ellipse(ctx, 21, 28, 12, 8.5, c.body);
  ellipse(ctx, 22, 32, 8, 3.5, c.belly, false);
  if (spotted) spots(ctx, 21, 28, 12, 8.5, shade(c.accent, -0.1), 3);
  ellipse(ctx, 33, 24, 7, 6.5, c.body);
  poly(ctx, [[29, 19], [31, 13], [34, 18.5]], c.body);
  poly(ctx, [[33, 18.5], [37, 14], [37.5, 20]], shade(c.body, -0.1));
  ellipse(ctx, 39.5, 26, 3, 2.6, c.accent);
  ellipse(ctx, 39, 26, 0.6, 0.9, OUTLINE, false);
  ellipse(ctx, 40.6, 26, 0.6, 0.9, OUTLINE, false);
  eye(ctx, 35, 22, 1.4);
}

function renard(ctx: Ctx, c: CoatColors, spotted: boolean): void {
  const ground = 41;
  ellipse(ctx, 22, ground, 12, 2.6, 'rgba(0,0,0,0.2)', false);
  // Grande queue touffue.
  ellipse(ctx, 9, 27, 4.5, 9, c.body, true, -0.9);
  ellipse(ctx, 4.8, 22.5, 2.6, 3.4, c.belly, false, -0.9);
  for (const x of [14, 18, 26, 30]) leg(ctx, x, 31, ground, 3, c.accent);
  ellipse(ctx, 21, 28, 10.5, 6, c.body);
  ellipse(ctx, 23, 31.5, 6, 2.6, c.belly, false);
  if (spotted) spots(ctx, 21, 28, 10.5, 6, shade(c.body, -0.3), 4);
  // Tête triangulaire.
  poly(ctx, [[28, 22], [30, 12], [33, 19]], c.body);
  poly(ctx, [[32, 19], [36, 12], [36.5, 20]], shade(c.body, -0.1));
  poly(ctx, [[27, 23], [33, 17], [38, 21], [42, 25], [36, 28.5], [29, 28]], c.body);
  poly(ctx, [[31, 27], [37, 24], [42, 25], [36, 28.5]], c.belly, false);
  ellipse(ctx, 42, 24.8, 1.2, 1, OUTLINE, false);
  eye(ctx, 34.5, 21.5, 1.4);
}

function cerf(ctx: Ctx, c: CoatColors, spotted: boolean): void {
  const ground = 44;
  ellipse(ctx, 22, ground, 11, 2.4, 'rgba(0,0,0,0.2)', false);
  for (const x of [14, 17.5, 26, 29.5]) leg(ctx, x, 30, ground, 2.6, shade(c.body, -0.15));
  ellipse(ctx, 10.5, 25, 2, 2.6, c.belly);
  ellipse(ctx, 21, 27, 10.5, 6.5, c.body);
  ellipse(ctx, 22, 30.5, 6.5, 2.5, c.belly, false);
  if (spotted) spots(ctx, 21, 27, 10.5, 6.5, '#ffffff', 5);
  // Cou et tête.
  poly(ctx, [[27, 26], [31, 14], [35, 15], [32, 27]], c.body);
  ellipse(ctx, 35, 15, 5, 4, c.body);
  poly(ctx, [[36, 13], [42, 16], [39, 18.5], [35, 18]], c.body);
  ellipse(ctx, 41.6, 16.4, 1, 0.9, OUTLINE, false);
  ellipse(ctx, 31.5, 11.5, 1.8, 3.2, c.body, true, -0.6);
  eye(ctx, 36, 14, 1.3);
  // Bois.
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 3;
  const antlers = () => {
    ctx.beginPath();
    ctx.moveTo(34, 11);
    ctx.lineTo(32, 3);
    ctx.moveTo(32.8, 6.5);
    ctx.lineTo(29, 4);
    ctx.moveTo(36, 11);
    ctx.lineTo(38.5, 3.5);
    ctx.moveTo(37.6, 6.2);
    ctx.lineTo(41, 4.5);
  };
  antlers();
  ctx.stroke();
  ctx.strokeStyle = '#e8d6b0';
  ctx.lineWidth = 1.4;
  antlers();
  ctx.stroke();
}

function panda(ctx: Ctx, c: CoatColors, spotted: boolean): void {
  const ground = 41;
  ellipse(ctx, 22, ground, 13, 2.8, 'rgba(0,0,0,0.2)', false);
  for (const x of [13, 18.5, 25.5, 31]) leg(ctx, x, 30, ground, 5, c.accent);
  ellipse(ctx, 21, 27, 12.5, 9, c.body);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(21, 27, 12, 8.5, 0, 0, Math.PI * 2);
  ctx.clip();
  ellipse(ctx, 25, 24, 4.5, 12, c.accent, false, 0.2); // bande des épaules
  ctx.restore();
  if (spotted) spots(ctx, 18, 28, 8, 7, shade(c.accent, 0.3), 6);
  ellipse(ctx, 29, 13, 3.2, 3.2, c.accent);
  ellipse(ctx, 38, 14, 3.2, 3.2, c.accent);
  ellipse(ctx, 34, 20, 8, 7, c.body);
  ellipse(ctx, 31, 20, 2.4, 3, c.accent, false, 0.4);
  ellipse(ctx, 37, 20, 2.4, 3, c.accent, false, -0.4);
  eye(ctx, 31.4, 19.6, 1, '#ffffff');
  eye(ctx, 37.2, 19.6, 1, '#ffffff');
  ellipse(ctx, 34.5, 24, 1.6, 1.1, OUTLINE, false);
}

const DRAW: Record<Species, (ctx: Ctx, c: CoatColors, spotted: boolean, coat: Coat) => void> = {
  lapin,
  mouton,
  cochon,
  renard,
  cerf,
  panda,
};

export function animal(species: Species, colors: CoatColors, coat: Coat, spotted: boolean): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(ANIMAL_W * RES, ANIMAL_H * RES);
  ctx.scale(RES, RES);
  DRAW[species](ctx, colors, spotted, coat);
  return canvas;
}

/** Point d'ancrage (fraction du canvas) : au sol, sous le corps. */
export const ANIMAL_ORIGIN = { x: 0.5, y: 41 / ANIMAL_H };
