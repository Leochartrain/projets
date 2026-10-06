import { COLORS, FONT } from '../core/constants.ts';
import { TYPE_COLORS, TYPE_NAMES, type Type } from '../data/types.ts';

export interface TextOptions {
  size?: number;
  color?: string;
  shadow?: string | null;
  align?: CanvasTextAlign;
  bold?: boolean;
}

/** Texte avec l'ombre grise des jeux DS ; `y` est la ligne de base. */
export function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, options: TextOptions = {}): void {
  const { size = 10, color = COLORS.text, shadow = COLORS.textShadow, align = 'left', bold = false } = options;
  ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  if (shadow) {
    ctx.fillStyle = shadow;
    ctx.fillText(text, x + 0.75, y + 0.75);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

export function textWidth(ctx: CanvasRenderingContext2D, text: string, size = 10): number {
  ctx.font = `${size}px ${FONT}`;
  return ctx.measureText(text).width;
}

/** Découpe un texte en lignes qui tiennent dans `width`. */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, width: number, size = 10): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && textWidth(ctx, candidate, size) > width) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Fenêtre blanche à double bordure bleue, comme les boîtes de dialogue de Diamant et Perle. */
export function drawWindow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  roundRect(ctx, x, y, w, h, 4);
  ctx.fillStyle = COLORS.windowBorder;
  ctx.fill();
  roundRect(ctx, x + 1.5, y + 1.5, w - 3, h - 3, 3);
  ctx.fillStyle = COLORS.windowInner;
  ctx.fill();
  roundRect(ctx, x + 3, y + 3, w - 6, h - 6, 2);
  ctx.fillStyle = COLORS.windowFill;
  ctx.fill();
}

/** Flèche rouge du curseur, pointe vers la droite. */
export function drawCursor(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = COLORS.cursor;
  ctx.beginPath();
  ctx.moveTo(x, y - 4);
  ctx.lineTo(x + 5, y);
  ctx.lineTo(x, y + 4);
  ctx.closePath();
  ctx.fill();
}

/** Petite flèche qui clignote en bas d'une boîte de texte : « appuie sur A pour continuer ». */
export function drawNextArrow(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  if (Math.floor(time * 2.5) % 2 === 1) return;
  ctx.fillStyle = COLORS.cursor;
  ctx.beginPath();
  ctx.moveTo(x - 3, y - 2);
  ctx.lineTo(x + 3, y - 2);
  ctx.lineTo(x, y + 2);
  ctx.closePath();
  ctx.fill();
}

export function hpColor(ratio: number): string {
  return ratio > 0.5 ? COLORS.hpGreen : ratio > 0.2 ? COLORS.hpYellow : COLORS.hpRed;
}

/** Barre de PV avec l'étiquette « PV » : verte, jaune sous la moitié, rouge sous 20 %. */
export function drawHpBar(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, ratio: number): void {
  ctx.fillStyle = '#505050';
  roundRect(ctx, x, y, width + 18, 6, 2);
  ctx.fill();
  drawText(ctx, 'PV', x + 2, y + 5.5, { size: 6, color: '#f8b030', shadow: null, bold: true });
  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(x + 15, y + 1.5, width, 3);
  const clamped = Math.max(0, Math.min(1, ratio));
  ctx.fillStyle = hpColor(clamped);
  ctx.fillRect(x + 15, y + 1.5, Math.ceil(width * clamped), 3);
}

export function drawExpBar(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, ratio: number): void {
  ctx.fillStyle = '#404040';
  ctx.fillRect(x, y, width, 3);
  ctx.fillStyle = COLORS.exp;
  ctx.fillRect(x + 0.5, y + 0.5, Math.max(0, (width - 1) * Math.min(1, ratio)), 2);
}

/** Étiquette de type colorée (« EAU », « VOL »…). */
export function drawTypeBadge(ctx: CanvasRenderingContext2D, type: Type, x: number, y: number, width = 32): void {
  roundRect(ctx, x, y, width, 10, 2);
  ctx.fillStyle = TYPE_COLORS[type];
  ctx.fill();
  drawText(ctx, TYPE_NAMES[type].toUpperCase(), x + width / 2, y + 8, { size: 7, color: '#ffffff', shadow: 'rgba(0,0,0,0.35)', align: 'center' });
}

/** Poké Ball dessinée, de rayon `r`, éventuellement inclinée (secousses). */
export function drawPokeball(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, angle = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#202020';
  ctx.fillStyle = '#e83030';
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#f8f8f8';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.moveTo(-r, 0);
  ctx.lineTo(r, 0);
  ctx.stroke();
  ctx.fillStyle = '#f8f8f8';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Abréviations des statuts dans les cadres de PV. */
export function drawStatus(ctx: CanvasRenderingContext2D, status: 'poison' | 'paralysis' | null, x: number, y: number): void {
  if (!status) return;
  const [label, color] = status === 'poison' ? ['PSN', '#a040a0'] : ['PAR', '#c8a818'];
  roundRect(ctx, x, y, 20, 8, 2);
  ctx.fillStyle = color;
  ctx.fill();
  drawText(ctx, label, x + 10, y + 6.5, { size: 6, color: '#ffffff', shadow: null, align: 'center', bold: true });
}
