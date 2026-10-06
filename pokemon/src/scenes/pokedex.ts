import { HEIGHT, WIDTH } from '../core/constants.ts';
import { SPECIES, type SpeciesId } from '../data/species.ts';
import type { Game, Scene } from '../game.ts';
import { drawCursor, drawPokeball, drawText, drawTypeBadge, drawWindow, wrapText } from '../ui/draw.ts';

/** Les espèces de la route, par numéro du Pokédex national. */
const ORDER = (Object.keys(SPECIES) as SpeciesId[]).sort((a, b) => SPECIES[a].id - SPECIES[b].id);

/** Pokédex : vus (nom et sprite) et capturés (Poké Ball, types et description). */
export class PokedexScene implements Scene {
  private cursor = 0;
  private readonly game: Game;

  constructor(game: Game) {
    this.game = game;
  }

  update(): void {
    const { input, audio } = this.game;
    const direction = input.consumeDirection();
    if (direction === 'up' || direction === 'down') {
      this.cursor = (this.cursor + (direction === 'up' ? ORDER.length - 1 : 1)) % ORDER.length;
      audio.select();
    }
    if (input.consume('b') || input.consume('a')) {
      audio.select();
      this.game.pop();
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const state = this.game.state!;
    ctx.fillStyle = '#c83030';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#a82020';
    ctx.fillRect(0, 0, WIDTH, 16);
    drawText(ctx, 'POKéDEX', 8, 12, { size: 10, color: '#ffffff', shadow: '#701010', bold: true });
    drawText(ctx, `Vus ${state.seen.length}   Attrapés ${state.caught.length}`, WIDTH - 8, 12, { size: 8, color: '#ffe0e0', shadow: null, align: 'right' });

    drawWindow(ctx, 4, 20, 112, 168);
    ORDER.forEach((id, i) => {
      const y = 36 + i * 19;
      const seen = state.seen.includes(id);
      const caught = state.caught.includes(id);
      if (caught) drawPokeball(ctx, 20, y - 3.5, 4);
      drawText(ctx, String(SPECIES[id].id).padStart(3, '0'), 28, y, { size: 8 });
      drawText(ctx, seen ? SPECIES[id].name : '- - - - -', 50, y, { size: 9 });
      if (i === this.cursor) drawCursor(ctx, 9, y - 3);
    });

    const id = ORDER[this.cursor];
    const species = SPECIES[id];
    const seen = state.seen.includes(id);
    const caught = state.caught.includes(id);
    drawWindow(ctx, 120, 20, 132, 168);
    if (!seen) {
      drawText(ctx, '???', 186, 80, { size: 14, align: 'center' });
      return;
    }
    ctx.drawImage(this.game.assets.pokemon[id].front, 146, 22);
    drawText(ctx, species.name, 186, 112, { size: 11, align: 'center', bold: true });
    if (!caught) {
      drawText(ctx, 'Pas encore attrapé', 186, 128, { size: 8, align: 'center' });
      return;
    }
    species.types.forEach((type, i) => drawTypeBadge(ctx, type, 186 - species.types.length * 18 + i * 36, 117, 34));
    wrapText(ctx, species.entry, 118, 8).slice(0, 5).forEach((line, i) => drawText(ctx, line, 127, 142 + i * 10, { size: 8 }));
  }
}
