import { expToNextLevel, levelProgress, maxHp, nameOf, statsOf } from '../battle/pokemon.ts';
import { HEIGHT, WIDTH } from '../core/constants.ts';
import { MOVES } from '../data/moves.ts';
import { NATURES, SPECIES, STAT_NAMES, type StatId } from '../data/species.ts';
import type { Game, Scene } from '../game.ts';
import { drawExpBar, drawHpBar, drawStatus, drawText, drawTypeBadge, drawWindow, wrapText } from '../ui/draw.ts';

const PAGES = ['INFOS', 'CAPACITÉS'];

/** Résumé d'un Pokémon : infos et statistiques (haut/bas : Pokémon suivant), puis capacités (haut/bas : capacité suivante). */
export class SummaryScene implements Scene {
  private page = 0;
  private moveCursor = 0;
  private index: number;
  private readonly game: Game;

  constructor(game: Game, index: number) {
    this.game = game;
    this.index = index;
  }

  update(): void {
    const { input, audio } = this.game;
    const party = this.game.state!.party;
    const direction = input.consumeDirection();
    if (direction === 'left' || direction === 'right') {
      this.page = (this.page + 1) % PAGES.length;
      audio.select();
    } else if (direction && this.page === 1) {
      // Page des capacités : haut/bas parcourt les capacités.
      const count = party[this.index].moves.length;
      this.moveCursor = (this.moveCursor + (direction === 'up' ? count - 1 : 1)) % count;
      audio.select();
    } else if (direction === 'up' || direction === 'down') {
      this.index = (this.index + (direction === 'up' ? party.length - 1 : 1)) % party.length;
      this.moveCursor = 0;
      audio.select();
    }
    if (input.consume('b') || input.consume('a')) {
      audio.select();
      this.game.pop();
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const pokemon = this.game.state!.party[this.index];
    const species = SPECIES[pokemon.species];
    ctx.fillStyle = '#e8f0f8';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#3a6a9a';
    ctx.fillRect(0, 0, WIDTH, 18);
    PAGES.forEach((label, i) => {
      drawText(ctx, label, 10 + i * 60, 13, { size: 9, color: i === this.page ? '#f8e888' : '#c8d8e8', shadow: null, bold: i === this.page });
    });
    drawText(ctx, this.page === 0 ? '← → page   ↑ ↓ Pokémon' : '← → page   ↑ ↓ capacité', WIDTH - 6, 13, { size: 7, color: '#c8d8e8', shadow: null, align: 'right' });

    // Colonne de gauche : sprite et identité.
    drawWindow(ctx, 4, 22, 96, 120);
    ctx.drawImage(this.game.assets.pokemon[pokemon.species].front, 12, 26);
    drawText(ctx, nameOf(pokemon), 10, 116, { size: 10, bold: true });
    drawText(ctx, `N.${pokemon.level}`, 94, 116, { size: 9, align: 'right' });
    drawText(ctx, `N° ${String(species.id).padStart(3, '0')}`, 10, 128, { size: 8 });
    species.types.forEach((type, i) => drawTypeBadge(ctx, type, 48 + i * 25, 120, 23));
    drawStatus(ctx, pokemon.status, 10, 132);

    if (this.page === 0) this.drawInfo(ctx);
    else this.drawMoves(ctx);
  }

  private drawInfo(ctx: CanvasRenderingContext2D): void {
    const pokemon = this.game.state!.party[this.index];
    const stats = statsOf(pokemon);
    const nature = NATURES[pokemon.nature];
    drawWindow(ctx, 104, 22, 148, 120);
    drawText(ctx, 'PV', 112, 37, { size: 9 });
    drawText(ctx, `${pokemon.hp}/${maxHp(pokemon)}`, 244, 37, { size: 9, align: 'right' });
    drawHpBar(ctx, 160, 41, 64, pokemon.hp / maxHp(pokemon));
    (['atk', 'def', 'spa', 'spd', 'spe'] as StatId[]).forEach((stat, i) => {
      const y = 62 + i * 12;
      // La statistique favorisée par la nature en rouge, la défavorisée en bleu.
      const color = nature.up === stat ? '#d03030' : nature.down === stat ? '#3060d0' : undefined;
      drawText(ctx, STAT_NAMES[stat], 112, y, { size: 9, color });
      drawText(ctx, String(stats[stat]), 244, y, { size: 9, align: 'right' });
    });
    drawText(ctx, `Nature ${nature.name}`, 112, 134, { size: 8 });

    drawWindow(ctx, 4, 146, 248, 42);
    drawText(ctx, 'Points EXP.', 12, 160, { size: 9 });
    drawText(ctx, String(pokemon.exp), 120, 160, { size: 9, align: 'right' });
    drawText(ctx, 'N. suivant', 132, 160, { size: 9 });
    drawText(ctx, String(expToNextLevel(pokemon)), 244, 160, { size: 9, align: 'right' });
    drawText(ctx, 'EXP', 12, 177, { size: 7, color: '#3098e8', shadow: null, bold: true });
    drawExpBar(ctx, 32, 173, 212, levelProgress(pokemon));
  }

  private drawMoves(ctx: CanvasRenderingContext2D): void {
    const pokemon = this.game.state!.party[this.index];
    drawWindow(ctx, 104, 22, 148, 120);
    pokemon.moves.forEach((slot, i) => {
      const move = MOVES[slot.id];
      const y = 28 + i * 28;
      if (i === this.moveCursor) {
        ctx.fillStyle = '#f8e888';
        ctx.fillRect(108, y, 140, 26);
      }
      drawTypeBadge(ctx, move.type, 110, y + 3, 40);
      drawText(ctx, move.name, 154, y + 12, { size: 9 });
      drawText(ctx, `PP ${slot.pp}/${move.pp}`, 244, y + 23, { size: 8, align: 'right' });
    });
    const move = MOVES[pokemon.moves[Math.min(this.moveCursor, pokemon.moves.length - 1)].id];
    drawWindow(ctx, 4, 146, 248, 42);
    const category = move.category === 'physical' ? 'Physique' : move.category === 'special' ? 'Spéciale' : 'Statut';
    const details = `${category} · Puiss. ${move.power ?? '—'} · Préc. ${move.accuracy ?? '—'}`;
    drawText(ctx, details, 12, 158, { size: 8 });
    wrapText(ctx, move.description, 232, 8).slice(0, 2).forEach((line, i) => drawText(ctx, line, 12, 170 + i * 10, { size: 8 }));
  }
}
