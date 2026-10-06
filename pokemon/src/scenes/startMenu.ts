import { HEIGHT, WIDTH } from '../core/constants.ts';
import type { Game, Scene } from '../game.ts';
import { save } from '../state.ts';
import { drawText, drawWindow } from '../ui/draw.ts';
import { ChoiceMenu } from '../ui/menu.ts';
import { BagScene } from './bag.ts';
import { PartyScene } from './party.ts';
import { PokedexScene } from './pokedex.ts';

const OPTIONS = ['POKéDEX', 'POKéMON', 'SAC', 'SAUVEGARDER', 'RETOUR'];

/** Menu X, en haut à droite de la carte comme dans Diamant et Perle. */
export class StartMenu implements Scene {
  readonly overlay = true;
  private readonly menu: ChoiceMenu;
  private message: { text: string; time: number } | null = null;
  private readonly game: Game;

  constructor(game: Game) {
    this.game = game;
    this.menu = new ChoiceMenu(game.ctx, OPTIONS, { x: WIDTH - 4, y: 4, anchor: 'right' });
  }

  update(dt: number): void {
    if (this.message && (this.message.time -= dt) <= 0) this.message = null;
    const choice = this.menu.update(this.game.input, this.game.audio);
    if (choice === null) return;
    if (choice === 'cancel' || choice === 4) {
      this.game.pop();
      return;
    }
    switch (choice) {
      case 0:
        this.game.push(new PokedexScene(this.game));
        break;
      case 1:
        this.game.push(new PartyScene(this.game, { mode: 'menu', prompt: 'Choisis un Pokémon.' }));
        break;
      case 2:
        this.game.push(new BagScene(this.game, { inBattle: false }));
        break;
      case 3: {
        const ok = save(this.game.state!);
        if (ok) this.game.audio.heal();
        this.message = { text: ok ? 'La partie a été sauvegardée.' : 'Impossible de sauvegarder (stockage du navigateur bloqué).', time: 2 };
        break;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    this.menu.draw(ctx);
    const state = this.game.state!;
    const minutes = Math.floor(state.playTime / 60);
    drawWindow(ctx, 4, 4, 104, 22);
    drawText(ctx, `Temps de jeu ${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`, 12, 18, { size: 8 });
    if (this.message) {
      drawWindow(ctx, 2, HEIGHT - 44, WIDTH - 4, 42);
      drawText(ctx, this.message.text, 12, HEIGHT - 20, { size: 10 });
    }
  }
}
