import { HEIGHT, WIDTH } from '../core/constants.ts';
import { SPECIES } from '../data/species.ts';
import type { Game, Scene } from '../game.ts';
import { hasSave, load, newGame, STARTER } from '../state.ts';
import { drawText } from '../ui/draw.ts';
import { ChoiceMenu } from '../ui/menu.ts';
import { START } from '../world/map.ts';
import { OverworldScene } from './overworld.ts';

/** Écran titre : logo, starter, puis Continuer / Nouvelle partie. */
export class TitleScene implements Scene {
  private time = 0;
  private menu: ChoiceMenu | null = null;
  private readonly game: Game;
  private readonly saved = hasSave();

  constructor(game: Game) {
    this.game = game;
  }

  update(dt: number): void {
    this.time += dt;
    const { input, audio } = this.game;
    if (!this.menu) {
      if (input.consume('a')) {
        audio.select();
        if (!this.saved) this.startNew();
        else this.menu = new ChoiceMenu(this.game.ctx, ['CONTINUER', 'NOUVELLE PARTIE'], { x: WIDTH / 2 - 52, y: 128, cancellable: true });
      }
      return;
    }
    const choice = this.menu.update(input, audio);
    if (choice === 'cancel') this.menu = null;
    else if (choice === 0) this.continue();
    else if (choice === 1) this.startNew();
  }

  private continue(): void {
    const state = load();
    if (!state) {
      this.startNew();
      return;
    }
    this.game.state = state;
    this.game.reset(new OverworldScene(this.game, ['Bon retour sur la Route 201 !']));
  }

  private startNew(): void {
    this.game.state = newGame(START, Math.random);
    const starter = SPECIES[STARTER].name;
    this.game.reset(
      new OverworldScene(this.game, [
        'Bienvenue dans le monde des Pokémon !',
        `Ton fidèle ${starter} t'accompagne. Explore la Route 201 : des Pokémon sauvages se cachent dans les hautes herbes !`,
        'X : menu (Pokémon, Sac, Pokédex, Sauvegarder). Maj : courir. Maman, juste ici, soigne ton équipe.',
      ]),
    );
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // Ciel du soir de Sinnoh, en dégradé.
    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, '#1c3c78');
    sky.addColorStop(0.6, '#5a8ed0');
    sky.addColorStop(1, '#a8d8a0');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Logo : contour bleu foncé, lettres jaunes.
    ctx.lineJoin = 'round';
    ctx.font = 'bold 34px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#1f3a8a';
    ctx.strokeText('Pokémon', WIDTH / 2, 46);
    ctx.fillStyle = '#ffcb05';
    ctx.fillText('Pokémon', WIDTH / 2, 46);
    drawText(ctx, 'ROUTE 201', WIDTH / 2, 64, { size: 12, color: '#ffffff', shadow: '#1f3a8a', align: 'center', bold: true });
    drawText(ctx, 'Version Diamant & Perle', WIDTH / 2, 76, { size: 8, color: '#dce8ff', shadow: null, align: 'center' });

    const sprite = this.game.assets.pokemon[STARTER].front;
    const bob = Math.round(Math.sin(this.time * 3) * 2);
    ctx.drawImage(sprite, WIDTH / 2 - sprite.width / 2, 78 + bob);

    if (this.menu) this.menu.draw(ctx);
    else if (Math.floor(this.time * 1.6) % 2 === 0) drawText(ctx, 'Appuie sur ESPACE', WIDTH / 2, 172, { size: 10, color: '#ffffff', shadow: '#1f3a8a', align: 'center' });
    drawText(ctx, 'Pokémon © Nintendo / Game Freak — projet de fan', WIDTH / 2, 188, { size: 6, color: '#e8f0e0', shadow: null, align: 'center' });
  }
}
