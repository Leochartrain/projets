import { HEIGHT, WIDTH } from '../core/constants.ts';
import type { Input } from '../core/input.ts';
import { drawNextArrow, drawText, drawWindow, wrapText } from './draw.ts';

const CHARS_PER_SECOND = 45;
const LINES_PER_PAGE = 2;
const TEXT_SIZE = 10;
export const DIALOG_HEIGHT = 46;

/**
 * Boîte de texte du bas de l'écran : le texte s'écrit lettre par lettre, A
 * l'affiche d'un coup puis passe à la suite. `done` devient vrai après la dernière page.
 */
export class Dialog {
  private pages: string[][] = [];
  private page = 0;
  private shown = 0;
  private time = 0;
  /** Vrai : la dernière page reste affichée sans attendre A (un menu prend le relais, ex. « Que doit faire Tiplouf ? »). */
  private holdLast = false;
  done = true;
  private readonly ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  /** Affiche un texte (découpé en pages de 2 lignes) ; `instant` : sans l'effet machine à écrire. */
  show(text: string, options: { hold?: boolean; instant?: boolean } = {}): void {
    const lines = wrapText(this.ctx, text, WIDTH - 28, TEXT_SIZE);
    this.pages = [];
    for (let i = 0; i < lines.length; i += LINES_PER_PAGE) this.pages.push(lines.slice(i, i + LINES_PER_PAGE));
    this.page = 0;
    this.shown = 0;
    this.done = false;
    this.holdLast = options.hold ?? false;
    if (options.instant) this.shown = this.pageLength;
  }

  /** Vrai quand la page courante est entièrement écrite. */
  get pageComplete(): boolean {
    return this.shown >= this.pageLength;
  }

  private get pageLength(): number {
    return (this.pages[this.page] ?? []).join('').length;
  }

  private get lastPage(): boolean {
    return this.page >= this.pages.length - 1;
  }

  /** Renvoie vrai si A a été utilisé (pour ne pas le compter deux fois). */
  update(dt: number, input: Input): boolean {
    this.time += dt;
    if (this.done) return false;
    if (!this.pageComplete) {
      this.shown = Math.min(this.pageLength, this.shown + dt * CHARS_PER_SECOND);
      if (input.consume('a') || input.consume('b')) {
        this.shown = this.pageLength;
        return true;
      }
      return false;
    }
    if (this.lastPage && this.holdLast) {
      this.done = true;
      return false;
    }
    if (input.consume('a') || input.consume('b')) {
      if (this.lastPage) this.done = true;
      else {
        this.page++;
        this.shown = 0;
      }
      return true;
    }
    return false;
  }

  /** Dessine la boîte (sur `width` pixels de large, pour laisser la place à un menu à droite). */
  draw(width = WIDTH): void {
    const { ctx } = this;
    const y = HEIGHT - DIALOG_HEIGHT;
    drawWindow(ctx, 2, y, width - 4, DIALOG_HEIGHT - 2);
    const lines = this.pages[this.page] ?? [];
    let budget = Math.floor(this.shown);
    lines.forEach((line, i) => {
      const visible = line.slice(0, Math.max(0, budget));
      budget -= line.length;
      drawText(ctx, visible, 12, y + 18 + i * 14, { size: TEXT_SIZE });
    });
    if (this.pageComplete && !this.done && !(this.lastPage && this.holdLast)) drawNextArrow(ctx, width - 14, y + DIALOG_HEIGHT - 11, this.time);
  }
}
