import { itemUsable } from '../battle/items.ts';
import { maxHp, nameOf } from '../battle/pokemon.ts';
import { HEIGHT, WIDTH } from '../core/constants.ts';
import { ITEM_ORDER, ITEMS, type ItemId } from '../data/items.ts';
import type { Game, Scene } from '../game.ts';
import { drawCursor, drawText, drawWindow, wrapText } from '../ui/draw.ts';
import { PartyScene } from './party.ts';

export interface BagOptions {
  inBattle: boolean;
  /** En combat : l'objet choisi (le combat s'occupe de la suite). */
  onUse?: (item: ItemId) => void;
  onClose?: () => void;
}

/** Le Sac : objets possédés, description en bas ; hors combat, les soins s'utilisent directement. */
export class BagScene implements Scene {
  private cursor = 0;
  private message: { text: string; time: number } | null = null;
  private readonly game: Game;
  private readonly options: BagOptions;

  constructor(game: Game, options: BagOptions) {
    this.game = game;
    this.options = options;
  }

  private get items(): ItemId[] {
    const bag = this.game.state!.bag;
    return ITEM_ORDER.filter((id) => bag[id] > 0);
  }

  update(dt: number): void {
    const { input, audio } = this.game;
    if (this.message && (this.message.time -= dt) <= 0) this.message = null;
    const items = this.items;
    const count = items.length + 1; // + « Fermer le Sac »
    const direction = input.consumeDirection();
    if (direction === 'up' || direction === 'down') {
      this.cursor = (this.cursor + (direction === 'up' ? count - 1 : 1)) % count;
      audio.select();
    }
    if (input.consume('b')) {
      audio.select();
      this.close();
      return;
    }
    if (!input.consume('a')) return;
    audio.select();
    const item = items[this.cursor];
    if (!item) {
      this.close();
      return;
    }
    if (this.options.inBattle) {
      this.options.onUse?.(item);
      return;
    }
    this.useOutside(item);
  }

  /** Hors combat : soins sur un Pokémon au choix ; les Poké Balls ne servent qu'en combat. */
  private useOutside(item: ItemId): void {
    const def = ITEMS[item];
    const state = this.game.state!;
    if (def.kind === 'ball') {
      this.message = { text: "Ce n'est pas le moment d'utiliser ça !", time: 1.8 };
      return;
    }
    this.game.push(
      new PartyScene(this.game, {
        mode: 'item',
        prompt: `Utiliser ${def.name} sur quel Pokémon ?`,
        canPick: (index) => itemUsable(item, state.party[index]),
        refusal: "Ça n'aura aucun effet.",
        onPick: (index) => {
          const pokemon = state.party[index];
          state.bag[item]--;
          if (def.kind === 'heal') {
            const before = pokemon.hp;
            pokemon.hp = Math.min(maxHp(pokemon), pokemon.hp + (def.heal ?? 0));
            this.message = { text: `${nameOf(pokemon)} récupère ${pokemon.hp - before} PV !`, time: 1.8 };
          } else {
            pokemon.status = null;
            this.message = { text: `${nameOf(pokemon)} est soigné !`, time: 1.8 };
          }
          this.game.audio.heal();
          this.game.pop();
          this.cursor = Math.min(this.cursor, this.items.length);
        },
      }),
    );
  }

  private close(): void {
    if (this.options.onClose) this.options.onClose();
    else this.game.pop();
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const bag = this.game.state!.bag;
    const items = this.items;
    // Sac à gauche, liste à droite.
    ctx.fillStyle = '#f0b860';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#e8a848';
    for (let y = 0; y < HEIGHT; y += 8) ctx.fillRect(0, y, WIDTH, 4);
    drawBag(ctx, 48, 70);
    drawText(ctx, 'SAC', 48, 128, { size: 12, align: 'center', bold: true, color: '#704010', shadow: '#f8d8a0' });

    drawWindow(ctx, 96, 6, 156, 132);
    items.forEach((id, i) => {
      const y = 22 + i * 16;
      drawText(ctx, ITEMS[id].name, 112, y, { size: 10 });
      drawText(ctx, `×${bag[id]}`, 244, y, { size: 10, align: 'right' });
      if (i === this.cursor) drawCursor(ctx, 103, y - 3.5);
    });
    const closeY = 22 + items.length * 16;
    drawText(ctx, 'FERMER LE SAC', 112, closeY, { size: 10 });
    if (this.cursor === items.length) drawCursor(ctx, 103, closeY - 3.5);

    drawWindow(ctx, 2, HEIGHT - 50, WIDTH - 4, 48);
    const selected = items[this.cursor];
    const text = this.message?.text ?? (selected ? ITEMS[selected].description : 'Fermer le Sac.');
    wrapText(ctx, text, WIDTH - 28, 10).slice(0, 2).forEach((line, i) => drawText(ctx, line, 12, HEIGHT - 32 + i * 14, { size: 10 }));
  }
}

/** Le Sac du héros, dessiné simplement. */
function drawBag(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#7a4a20';
  ctx.beginPath();
  ctx.roundRect(x - 26, y - 22, 52, 46, 10);
  ctx.fill();
  ctx.fillStyle = '#c87830';
  ctx.beginPath();
  ctx.roundRect(x - 23, y - 19, 46, 40, 8);
  ctx.fill();
  ctx.fillStyle = '#a05a20';
  ctx.fillRect(x - 23, y - 8, 46, 6);
  ctx.fillStyle = '#f8d030';
  ctx.fillRect(x - 4, y - 9, 8, 8);
  ctx.strokeStyle = '#7a4a20';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y - 22, 12, Math.PI, 0);
  ctx.stroke();
}
