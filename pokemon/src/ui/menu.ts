import type { Audio } from '../core/audio.ts';
import type { Input } from '../core/input.ts';
import { drawCursor, drawText, drawWindow, textWidth } from './draw.ts';

const ROW_HEIGHT = 14;

/**
 * Liste de choix dans une fenêtre (« OUI / NON », menu Start…). `update`
 * renvoie l'indice choisi avec A, `'cancel'` avec B, sinon null.
 */
export class ChoiceMenu {
  index = 0;
  private readonly options: string[];
  private readonly x: number;
  private readonly y: number;
  private readonly width: number;
  private readonly cancellable: boolean;

  /** `x`, `y` : coin haut-droit si `anchor` vaut 'right', sinon haut-gauche. */
  constructor(
    ctx: CanvasRenderingContext2D,
    options: string[],
    position: { x: number; y: number; anchor?: 'left' | 'right'; cancellable?: boolean },
  ) {
    this.options = options;
    this.width = Math.ceil(Math.max(...options.map((o) => textWidth(ctx, o))) + 26);
    this.x = position.anchor === 'right' ? position.x - this.width : position.x;
    this.y = position.y;
    this.cancellable = position.cancellable ?? true;
  }

  get height(): number {
    return this.options.length * ROW_HEIGHT + 10;
  }

  update(input: Input, audio: Audio): number | 'cancel' | null {
    const direction = input.consumeDirection();
    if (direction === 'up' || direction === 'down') {
      this.index = (this.index + (direction === 'up' ? -1 : 1) + this.options.length) % this.options.length;
      audio.select();
    }
    if (input.consume('a')) {
      audio.select();
      return this.index;
    }
    if (this.cancellable && (input.consume('b') || input.consume('menu'))) {
      audio.select();
      return 'cancel';
    }
    return null;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    drawWindow(ctx, this.x, this.y, this.width, this.height);
    this.options.forEach((option, i) => {
      const rowY = this.y + 15 + i * ROW_HEIGHT;
      drawText(ctx, option, this.x + 15, rowY);
      if (i === this.index) drawCursor(ctx, this.x + 7, rowY - 3.5);
    });
  }
}
