import { HEIGHT, WIDTH } from '../core/constants.ts';
import type { Game, Scene } from '../game.ts';

const FLASH_TIME = 0.6;
const BARS_TIME = 0.6;
const BARS = 8;

/**
 * Entrée en combat sauvage : l'écran clignote, puis des bandes noires se
 * referment depuis les côtés (une sur deux de chaque côté), et le combat commence.
 */
export class EncounterTransition implements Scene {
  readonly overlay = true;
  private time = 0;
  private finished = false;
  private readonly done: () => void;

  constructor(_game: Game, done: () => void) {
    this.done = done;
  }

  update(dt: number): void {
    this.time += dt;
    if (!this.finished && this.time >= FLASH_TIME + BARS_TIME + 0.1) {
      this.finished = true;
      this.done();
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.time < FLASH_TIME) {
      const flash = Math.floor(this.time / (FLASH_TIME / 6)) % 2 === 0;
      ctx.fillStyle = flash ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      return;
    }
    const t = Math.min((this.time - FLASH_TIME) / BARS_TIME, 1);
    const height = HEIGHT / BARS;
    ctx.fillStyle = '#000000';
    for (let i = 0; i < BARS; i++) {
      const width = WIDTH * t;
      ctx.fillRect(i % 2 === 0 ? 0 : WIDTH - width, i * height, width, height + 0.5);
    }
  }
}
