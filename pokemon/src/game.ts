import type { Assets } from './core/assets.ts';
import type { Audio } from './core/audio.ts';
import { HEIGHT, WIDTH } from './core/constants.ts';
import type { Input } from './core/input.ts';
import type { GameState } from './state.ts';

/** Un écran du jeu : la carte, un combat, un menu… */
export interface Scene {
  update(dt: number): void;
  draw(ctx: CanvasRenderingContext2D): void;
  /** Vrai pour un menu posé sur l'écran précédent (qui reste dessiné dessous). */
  readonly overlay?: boolean;
}

/** Boucle du jeu et pile d'écrans : seul celui du dessus reçoit les touches. */
export class Game {
  state: GameState | null = null;
  readonly ctx: CanvasRenderingContext2D;
  readonly input: Input;
  readonly audio: Audio;
  readonly assets: Assets;
  private readonly stack: Scene[] = [];
  private last = 0;

  constructor(ctx: CanvasRenderingContext2D, input: Input, audio: Audio, assets: Assets) {
    this.ctx = ctx;
    this.input = input;
    this.audio = audio;
    this.assets = assets;
  }

  get top(): Scene | undefined {
    return this.stack[this.stack.length - 1];
  }

  push(scene: Scene): void {
    this.stack.push(scene);
  }

  pop(): void {
    this.stack.pop();
  }

  /** Remplace toute la pile (nouvel écran principal). */
  reset(scene: Scene): void {
    this.stack.length = 0;
    this.stack.push(scene);
  }

  start(): void {
    requestAnimationFrame((time) => {
      this.last = time;
      this.frame(time);
    });
  }

  private frame(time: number): void {
    const dt = Math.min((time - this.last) / 1000, 0.1);
    this.last = time;
    if (this.state) this.state.playTime += dt;
    this.top?.update(dt);
    this.input.endFrame();

    const { ctx } = this;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    // On dessine depuis le dernier écran plein (les menus se superposent à lui).
    let first = this.stack.length - 1;
    while (first > 0 && this.stack[first].overlay) first--;
    for (const scene of this.stack.slice(first)) scene.draw(ctx);
    requestAnimationFrame((t) => this.frame(t));
  }
}
