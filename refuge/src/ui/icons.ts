import { makeCanvas } from '../art/canvas.ts';

/**
 * Icônes dessinées au canvas : la même source sert aux bulles du jeu (Phaser)
 * et à l'interface HTML (en image).
 */
export type IconName = 'or' | 'nourriture' | 'gemmes' | 'coeur' | 'marteau' | 'etoile';

const OUTLINE = '#2a1c12';

type Ctx = CanvasRenderingContext2D;

function stroke(ctx: Ctx, width = 1.6): void {
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

const DRAW: Record<IconName, (ctx: Ctx) => void> = {
  // Pièce d'or.
  or(ctx) {
    ctx.beginPath();
    ctx.ellipse(12, 13, 9.5, 9.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#e09a12';
    ctx.fill();
    stroke(ctx);
    ctx.beginPath();
    ctx.ellipse(12, 12, 8.5, 8.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd23c';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(12, 12, 5.5, 5.5, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#e8a417';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(9, 8.5, 2.2, 1.4, -0.6, 0, Math.PI * 2);
    ctx.fillStyle = '#fff3b8';
    ctx.fill();
  },
  // Carotte.
  nourriture(ctx) {
    ctx.beginPath();
    ctx.moveTo(14, 4);
    ctx.quadraticCurveTo(13, 1, 10, 2);
    ctx.moveTo(15, 5);
    ctx.quadraticCurveTo(18, 1, 20, 4);
    ctx.moveTo(15, 5);
    ctx.lineTo(16, 0.5);
    ctx.strokeStyle = '#3f9a2a';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(10, 7);
    ctx.quadraticCurveTo(16, 3, 19, 8);
    ctx.lineTo(6, 22);
    ctx.quadraticCurveTo(3, 21, 4, 18);
    ctx.closePath();
    ctx.fillStyle = '#f28a1e';
    ctx.fill();
    stroke(ctx);
    ctx.beginPath();
    ctx.moveTo(10, 11);
    ctx.lineTo(13, 12);
    ctx.moveTo(8, 15);
    ctx.lineTo(11, 16);
    ctx.strokeStyle = '#c2620e';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  },
  // Gemme verte.
  gemmes(ctx) {
    ctx.beginPath();
    ctx.moveTo(6, 4);
    ctx.lineTo(18, 4);
    ctx.lineTo(22, 10);
    ctx.lineTo(12, 22);
    ctx.lineTo(2, 10);
    ctx.closePath();
    ctx.fillStyle = '#36d36b';
    ctx.fill();
    stroke(ctx);
    ctx.beginPath();
    ctx.moveTo(2, 10);
    ctx.lineTo(22, 10);
    ctx.moveTo(8, 10);
    ctx.lineTo(12, 22);
    ctx.lineTo(16, 10);
    ctx.strokeStyle = '#1f9c4a';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(7, 5.5);
    ctx.lineTo(11, 5.5);
    ctx.lineTo(8.5, 9);
    ctx.closePath();
    ctx.fillStyle = '#c8ffd9';
    ctx.fill();
  },
  coeur(ctx) {
    ctx.beginPath();
    ctx.moveTo(12, 21);
    ctx.bezierCurveTo(2, 14, 1, 7, 6, 4.5);
    ctx.bezierCurveTo(9, 3, 11, 5, 12, 7);
    ctx.bezierCurveTo(13, 5, 15, 3, 18, 4.5);
    ctx.bezierCurveTo(23, 7, 22, 14, 12, 21);
    ctx.closePath();
    ctx.fillStyle = '#ff5b7f';
    ctx.fill();
    stroke(ctx);
    ctx.beginPath();
    ctx.ellipse(7.5, 8, 2, 1.3, -0.7, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd0db';
    ctx.fill();
  },
  marteau(ctx) {
    ctx.save();
    ctx.translate(12, 12);
    ctx.rotate(-0.7);
    ctx.beginPath();
    ctx.roundRect(-1.8, -4, 3.6, 15, 1.5);
    ctx.fillStyle = '#b57a43';
    ctx.fill();
    stroke(ctx);
    ctx.beginPath();
    ctx.roundRect(-7, -9, 14, 6, 1.5);
    ctx.fillStyle = '#9aa3ad';
    ctx.fill();
    stroke(ctx);
    ctx.restore();
  },
  etoile(ctx) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 4.5 : 10;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      ctx.lineTo(12 + Math.cos(a) * r, 12.5 + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = '#ffd23c';
    ctx.fill();
    stroke(ctx);
  },
};

/** Icône carrée de `size` pixels. */
export function iconCanvas(name: IconName, size: number): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(size, size);
  ctx.scale(size / 24, size / 24);
  DRAW[name](ctx);
  return canvas;
}

const urls = new Map<IconName, string>();

/** Balise <img> d'une icône, pour l'interface. */
export function icon(name: IconName, cls = 'icon'): string {
  if (!urls.has(name)) urls.set(name, iconCanvas(name, 48).toDataURL());
  return `<img class="${cls}" src="${urls.get(name)}" alt="">`;
}
