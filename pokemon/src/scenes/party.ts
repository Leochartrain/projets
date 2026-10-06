import { isFainted, maxHp, nameOf } from '../battle/pokemon.ts';
import { HEIGHT, WIDTH } from '../core/constants.ts';
import type { Game, Scene } from '../game.ts';
import { drawCursor, drawHpBar, drawStatus, drawText, drawWindow } from '../ui/draw.ts';
import { ChoiceMenu } from '../ui/menu.ts';
import { SummaryScene } from './summary.ts';

export interface PartyOptions {
  /** switch : envoyer au combat ; item : cible d'un objet ; menu : hors combat (résumé, ordre). */
  mode: 'switch' | 'item' | 'menu';
  prompt: string;
  /** Changement obligatoire après un K.O. : pas d'annulation. */
  forced?: boolean;
  canPick?: (index: number) => boolean;
  /** Message si le Pokémon choisi ne convient pas. */
  refusal?: string;
  onPick?: (index: number) => void;
  onClose?: () => void;
}

const SLOT_W = 124;
const SLOT_H = 40;
const CANCEL = 6;

/** Écran de l'équipe, en deux colonnes de trois comme dans Diamant et Perle. */
export class PartyScene implements Scene {
  private cursor = 0;
  private submenu: ChoiceMenu | null = null;
  /** Mode « ordre » : premier Pokémon choisi pour l'échange. */
  private swapping: number | null = null;
  private message: { text: string; time: number } | null = null;
  private readonly game: Game;
  private readonly options: PartyOptions;

  constructor(game: Game, options: PartyOptions) {
    this.game = game;
    this.options = options;
  }

  private get party() {
    return this.game.state!.party;
  }

  update(dt: number): void {
    const { input, audio } = this.game;
    if (this.message && (this.message.time -= dt) <= 0) this.message = null;

    if (this.submenu) {
      const choice = this.submenu.update(input, audio);
      if (choice !== null) this.submenuChoice(choice);
      return;
    }

    const direction = input.consumeDirection();
    if (direction) {
      audio.select();
      this.move(direction);
    }
    if (input.consume('b')) {
      audio.select();
      if (this.swapping !== null) this.swapping = null;
      else if (!this.options.forced) this.close();
      return;
    }
    if (!input.consume('a')) return;
    audio.select();
    if (this.cursor === CANCEL) {
      if (!this.options.forced) this.close();
      return;
    }
    if (this.swapping !== null) {
      // Échange de place dans l'équipe.
      const party = this.party;
      [party[this.swapping], party[this.cursor]] = [party[this.cursor], party[this.swapping]];
      this.swapping = null;
      return;
    }
    if (this.options.mode === 'item') {
      this.pick(this.cursor);
      return;
    }
    const labels = this.options.mode === 'switch' ? ['ENVOYER', 'RÉSUMÉ', 'ANNULER'] : ['RÉSUMÉ', 'ORDRE', 'ANNULER'];
    this.submenu = new ChoiceMenu(this.game.ctx, labels, { x: WIDTH - 4, y: HEIGHT - 70, anchor: 'right' });
  }

  private submenuChoice(choice: number | 'cancel'): void {
    this.submenu = null;
    if (choice === 'cancel') return;
    const label = this.options.mode === 'switch' ? ['send', 'summary', 'cancel'][choice] : ['summary', 'order', 'cancel'][choice];
    if (label === 'send') this.pick(this.cursor);
    else if (label === 'summary') this.game.push(new SummaryScene(this.game, this.cursor));
    else if (label === 'order') this.swapping = this.cursor;
  }

  private pick(index: number): void {
    if (this.options.canPick && !this.options.canPick(index)) {
      const pokemon = this.party[index];
      const name = nameOf(pokemon);
      let text = this.options.refusal ?? 'Impossible !';
      if (this.options.mode === 'switch') text = isFainted(pokemon) ? `${name} n'a plus d'énergie pour se battre !` : `${name} est déjà au combat !`;
      this.message = { text, time: 1.6 };
      return;
    }
    this.options.onPick?.(index);
  }

  private close(): void {
    if (this.options.onClose) this.options.onClose();
    else this.game.pop();
  }

  private move(direction: 'up' | 'down' | 'left' | 'right'): void {
    const count = this.party.length;
    const slots = [...Array(count).keys(), ...(this.options.forced ? [] : [CANCEL])];
    if (this.cursor === CANCEL) {
      if (direction === 'up') this.cursor = count - 1;
      return;
    }
    let next = this.cursor;
    if (direction === 'left' && this.cursor % 2 === 1) next--;
    if (direction === 'right' && this.cursor % 2 === 0) next++;
    if (direction === 'up') next -= 2;
    if (direction === 'down') next += 2;
    if (next >= count && direction === 'down' && slots.includes(CANCEL)) next = CANCEL;
    if (slots.includes(next)) this.cursor = next;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#2a7a7a';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    // Motif de losanges du fond, comme sur l'écran tactile.
    ctx.fillStyle = '#2f8686';
    for (let y = 0; y < HEIGHT; y += 12) for (let x = (y / 12) % 2 === 0 ? 0 : 6; x < WIDTH; x += 12) ctx.fillRect(x, y, 6, 6);

    this.party.forEach((pokemon, i) => {
      const x = 4 + (i % 2) * (SLOT_W + 2);
      const y = 4 + Math.floor(i / 2) * (SLOT_H + 3);
      const selected = i === this.cursor;
      const fainted = isFainted(pokemon);
      ctx.fillStyle = this.swapping === i ? '#f0c060' : selected ? '#f8e888' : fainted ? '#e8a0a0' : '#a8e0f8';
      ctx.beginPath();
      ctx.roundRect(x, y, SLOT_W, SLOT_H, 6);
      ctx.fill();
      ctx.strokeStyle = selected ? '#e05030' : '#305878';
      ctx.lineWidth = selected ? 2 : 1;
      ctx.stroke();
      const sprite = this.game.assets.pokemon[pokemon.species].front;
      ctx.drawImage(sprite, x - 2, y - 2, 40, 40);
      drawText(ctx, nameOf(pokemon), x + 38, y + 12, { size: 9 });
      drawText(ctx, `N.${pokemon.level}`, x + SLOT_W - 6, y + 12, { size: 8, align: 'right' });
      drawHpBar(ctx, x + 38, y + 18, 64, pokemon.hp / maxHp(pokemon));
      drawText(ctx, `${pokemon.hp}/${maxHp(pokemon)}`, x + SLOT_W - 6, y + 35, { size: 8, align: 'right' });
      drawStatus(ctx, pokemon.status, x + 38, y + 28);
    });

    if (!this.options.forced) {
      const selected = this.cursor === CANCEL;
      ctx.fillStyle = selected ? '#f8e888' : '#e8e8e8';
      ctx.beginPath();
      ctx.roundRect(WIDTH - 66, HEIGHT - 34, 62, 18, 6);
      ctx.fill();
      ctx.strokeStyle = selected ? '#e05030' : '#305878';
      ctx.stroke();
      drawText(ctx, 'RETOUR', WIDTH - 35, HEIGHT - 21, { size: 9, align: 'center' });
    }

    drawWindow(ctx, 2, HEIGHT - 34, this.options.forced ? WIDTH - 4 : WIDTH - 72, 32);
    const text = this.message?.text ?? (this.swapping !== null ? 'Échanger avec quel Pokémon ?' : this.options.prompt);
    drawText(ctx, text, 10, HEIGHT - 14, { size: 9 });
    this.submenu?.draw(ctx);
    if (this.cursor === CANCEL) drawCursor(ctx, WIDTH - 62, HEIGHT - 25);
  }
}
