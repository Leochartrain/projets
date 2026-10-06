import { Battle, type BattleEvent, type Outcome, type PlayerAction, type Side } from '../battle/battle.ts';
import { levelProgress, maxHp, nameOf, statsOf, type Pokemon, type Status } from '../battle/pokemon.ts';
import { spriteBottom } from '../core/assets.ts';
import { HEIGHT, WIDTH } from '../core/constants.ts';
import { itemUsable } from '../battle/items.ts';
import { ITEMS, type ItemId } from '../data/items.ts';
import { MOVES, type MoveId } from '../data/moves.ts';
import { STAT_NAMES, type StatId } from '../data/species.ts';
import type { Game, Scene } from '../game.ts';
import { addCaught } from '../state.ts';
import { DIALOG_HEIGHT, Dialog } from '../ui/dialog.ts';
import { drawCursor, drawExpBar, drawHpBar, drawPokeball, drawStatus, drawText, drawTypeBadge, drawWindow } from '../ui/draw.ts';
import { ChoiceMenu } from '../ui/menu.ts';
import { BagScene } from './bag.ts';
import { PartyScene } from './party.ts';

const ENEMY = { x: 188, y: 86, platformY: 82 };
const PLAYER = { x: 64, top: HEIGHT - DIALOG_HEIGHT - 70, platformY: 140 };
const INTRO_TIME = 0.8;
const COMMANDS = ['ATTAQUE', 'SAC', 'POKéMON', 'FUITE'];

type Phase = 'intro' | 'events' | 'command' | 'moves' | 'learn' | 'busy' | 'outro';

/** Animation en cours sur l'écran (l'événement suivant attend qu'elle finisse). */
interface Animation {
  time: number;
  duration: number;
  kind: 'attack' | 'hit' | 'stat' | 'faint' | 'withdraw' | 'send' | 'ball' | 'hp' | 'exp' | 'wait';
  side?: Side;
  up?: boolean;
  /** PV ou expérience : valeur de départ et d'arrivée. */
  from?: number;
  to?: number;
  shakes?: number;
  caught?: boolean;
}

/** Ce qu'affichent les cadres (en retard sur la logique, le temps des animations). */
interface Shown {
  index: number;
  hp: Record<Side, number>;
  status: Record<Side, Status>;
  level: number;
  exp: number;
  visible: Record<Side, boolean>;
}

export class BattleScene implements Scene {
  private readonly game: Game;
  private readonly battle: Battle;
  private readonly dialog: Dialog;
  private readonly onEnd: (outcome: Outcome) => void;
  private phase: Phase = 'intro';
  private time = 0;
  private queue: BattleEvent[] = [];
  private animation: Animation | null = null;
  private command = 0;
  private moveCursor = 0;
  private readonly shown: Shown;
  private readonly enemyBottom: number;
  private outcome: Outcome | null = null;
  private outroTime = 0;
  /** Panneau de statistiques après une montée de niveau (avant, après). */
  private levelPanel: { before: Record<StatId, number>; after: Record<StatId, number> } | null = null;
  private learn: LearnFlow | null = null;

  constructor(game: Game, wild: Pokemon, onEnd: (outcome: Outcome) => void) {
    this.game = game;
    this.onEnd = onEnd;
    const state = game.state!;
    this.battle = new Battle(state.party, wild);
    this.dialog = new Dialog(game.ctx);
    const player = this.battle.player;
    this.shown = {
      index: this.battle.active,
      hp: { player: player.hp, wild: wild.hp },
      status: { player: player.status, wild: wild.status },
      level: player.level,
      exp: levelProgress(player),
      visible: { player: false, wild: true },
    };
    this.enemyBottom = spriteBottom(game.assets.pokemon[wild.species].front);
  }

  private get shownPlayer(): Pokemon {
    return this.battle.party[this.shown.index];
  }

  update(dt: number): void {
    this.time += dt;
    const { input } = this.game;
    switch (this.phase) {
      case 'intro':
        if (this.time >= INTRO_TIME) this.play(this.battle.start());
        break;
      case 'events':
        this.updateEvents(dt);
        break;
      case 'command':
        this.dialog.update(dt, input);
        this.updateCommand();
        break;
      case 'moves':
        this.updateMoves();
        break;
      case 'learn':
        this.learn?.update(dt);
        break;
      case 'busy':
        break;
      case 'outro':
        this.outroTime += dt;
        if (this.outroTime >= 0.5) {
          this.game.pop();
          this.onEnd(this.outcome!);
        }
        break;
    }
  }

  // --- Événements ---

  private play(events: BattleEvent[]): void {
    this.queue.push(...events);
    this.phase = 'events';
  }

  private updateEvents(dt: number): void {
    const { input } = this.game;
    if (this.levelPanel) {
      if (input.consume('a') || input.consume('b')) this.levelPanel = null;
      return;
    }
    if (!this.dialog.done) {
      this.dialog.update(dt, input);
      return;
    }
    if (this.animation) {
      this.animation.time += dt;
      this.applyAnimation(this.animation);
      if (this.animation.time < this.animation.duration) return;
      this.finishAnimation(this.animation);
      this.animation = null;
    }
    const event = this.queue.shift();
    if (!event) {
      this.nextTurn();
      return;
    }
    this.start(event);
  }

  private start(event: BattleEvent): void {
    const { audio } = this.game;
    switch (event.type) {
      case 'text':
        this.dialog.show(event.text);
        break;
      case 'hp':
        this.animate({ kind: 'hp', side: event.side, from: this.shown.hp[event.side], to: event.hp, duration: hpDuration(this.shown.hp[event.side], event.hp, this.maxHpOf(event.side)) });
        break;
      case 'attack':
        this.animate({ kind: 'attack', side: event.side, duration: 0.3 });
        break;
      case 'hit':
        audio.hit();
        this.animate({ kind: 'hit', side: event.side, duration: 0.45 });
        break;
      case 'stat':
        if (event.up) audio.statUp();
        else audio.statDown();
        this.animate({ kind: 'stat', side: event.side, up: event.up, duration: 0.5 });
        break;
      case 'status':
        this.shown.status[event.side] = event.status;
        break;
      case 'faint':
        audio.faint();
        this.animate({ kind: 'faint', side: event.side, duration: 0.5 });
        break;
      case 'withdraw':
        this.animate({ kind: 'withdraw', side: 'player', duration: 0.35 });
        break;
      case 'send': {
        const pokemon = this.battle.party[event.index];
        this.shown.index = event.index;
        this.shown.hp.player = pokemon.hp;
        this.shown.status.player = pokemon.status;
        this.shown.level = pokemon.level;
        this.shown.exp = levelProgress(pokemon);
        this.shown.visible.player = true;
        audio.throwBall();
        this.animate({ kind: 'send', side: 'player', duration: 0.45 });
        break;
      }
      case 'ball':
        audio.throwBall();
        this.animate({ kind: 'ball', duration: 1.1 + event.shakes * 0.6 + (event.caught ? 0.6 : 0.3), shakes: event.shakes, caught: event.caught });
        break;
      case 'exp': {
        const pokemon = this.battle.party[event.index];
        if (event.index !== this.shown.index) break;
        const target = event.level > this.shown.level ? 1 : levelProgress(pokemon);
        this.animate({ kind: 'exp', from: this.shown.exp, to: target, duration: 0.7 });
        break;
      }
      case 'levelUp': {
        const pokemon = this.battle.party[event.index];
        audio.levelUp();
        this.levelPanel = { before: statsAtLevel(pokemon, event.level - 1), after: statsAtLevel(pokemon, event.level) };
        if (event.index === this.shown.index) {
          this.shown.level = event.level;
          this.shown.hp.player = pokemon.hp;
          this.shown.exp = 0;
          const target = event.level === pokemon.level ? levelProgress(pokemon) : 1;
          this.animate({ kind: 'exp', from: 0, to: target, duration: 0.5 });
        }
        break;
      }
      case 'learnPrompt':
        this.phase = 'learn';
        this.learn = new LearnFlow(this.game, this.dialog, this.battle.party[event.index], event.move, () => {
          this.learn = null;
          this.phase = 'events';
        });
        break;
      case 'needSwitch':
        this.phase = 'busy';
        this.game.push(
          new PartyScene(this.game, {
            mode: 'switch',
            forced: true,
            prompt: 'Envoyer quel Pokémon ?',
            canPick: (index) => this.battle.canSwitchTo(index),
            onPick: (index) => {
              this.game.pop();
              this.play(this.battle.sendReplacement(index));
            },
          }),
        );
        break;
      case 'end':
        this.finish(event.outcome);
        break;
    }
  }

  private animate(animation: Omit<Animation, 'time'>): void {
    this.animation = { ...animation, time: 0 };
  }

  /** Effets continus d'une animation (barres qui glissent). */
  private applyAnimation(animation: Animation): void {
    const t = Math.min(animation.time / animation.duration, 1);
    if (animation.kind === 'hp' && animation.side) this.shown.hp[animation.side] = Math.round(lerp(animation.from!, animation.to!, t));
    if (animation.kind === 'exp') this.shown.exp = lerp(animation.from!, animation.to!, t);
    if (animation.kind === 'ball' && animation.shakes !== undefined) {
      // Un petit bruit à chaque secousse.
      const shakeIndex = Math.floor((animation.time - 1.1) / 0.6);
      const previous = Math.floor((animation.time - 0.02 - 1.1) / 0.6);
      if (animation.time > 1.1 && shakeIndex !== previous && shakeIndex < animation.shakes) this.game.audio.shake();
    }
  }

  private finishAnimation(animation: Animation): void {
    if (animation.kind === 'faint' && animation.side) this.shown.visible[animation.side] = false;
    if (animation.kind === 'withdraw') this.shown.visible.player = false;
    if (animation.kind === 'ball' && animation.caught) {
      this.shown.visible.wild = false;
      this.game.audio.caught();
    }
  }

  /** Fin des événements d'un tour : suite imposée, ou retour au menu. */
  private nextTurn(): void {
    if (this.outcome) return;
    if (this.battle.locked) {
      this.play(this.battle.continueLocked());
      return;
    }
    this.phase = 'command';
    // Affiché d'un coup : le menu répond tout de suite, comme dans Diamant et Perle.
    this.dialog.show(`Que doit faire ${nameOf(this.battle.player)} ?`, { hold: true, instant: true });
  }

  private finish(outcome: Outcome): void {
    const state = this.game.state!;
    if (outcome === 'caught' && !this.catchRecorded) {
      // Le Pokémon rejoint l'équipe (ou le PC) ; les messages du Pokédex passent avant de quitter.
      this.catchRecorded = true;
      const wild = this.battle.wild;
      const newSpecies = !state.caught.includes(wild.species);
      const toBox = addCaught(state, wild);
      const lines: string[] = [];
      if (newSpecies) lines.push(`Les données de ${nameOf(wild)} ont été ajoutées au Pokédex !`);
      if (toBox) lines.push(`Ton équipe est pleine : ${nameOf(wild)} est envoyé au PC.`);
      if (lines.length > 0) {
        this.queue.unshift(...lines.map((text): BattleEvent => ({ type: 'text', text })), { type: 'end', outcome: 'caught' });
        return;
      }
    }
    this.outcome = outcome;
    this.phase = 'outro';
  }

  private catchRecorded = false;

  // --- Menus ---

  private updateCommand(): void {
    const { input, audio } = this.game;
    const direction = input.consumeDirection();
    if (direction) {
      const col = this.command % 2;
      const row = Math.floor(this.command / 2);
      if (direction === 'left' || direction === 'right') this.command = row * 2 + (1 - col);
      else this.command = (1 - row) * 2 + col;
      audio.select();
    }
    if (!input.consume('a')) return;
    audio.select();
    switch (this.command) {
      case 0:
        this.phase = 'moves';
        this.moveCursor = Math.min(this.moveCursor, this.battle.player.moves.length - 1);
        break;
      case 1:
        this.openBag();
        break;
      case 2:
        this.openParty();
        break;
      case 3:
        this.act({ kind: 'run' });
        break;
    }
  }

  private updateMoves(): void {
    const { input, audio } = this.game;
    const moves = this.battle.player.moves;
    const direction = input.consumeDirection();
    if (direction) {
      const col = this.moveCursor % 2;
      const row = Math.floor(this.moveCursor / 2);
      let next = this.moveCursor;
      if (direction === 'left' || direction === 'right') next = row * 2 + (1 - col);
      else next = (1 - row) * 2 + col;
      if (next < moves.length) this.moveCursor = next;
      audio.select();
    }
    if (input.consume('b')) {
      audio.select();
      this.phase = 'command';
      return;
    }
    if (!input.consume('a')) return;
    audio.select();
    // Plus aucun PP nulle part : Lutte ; sinon, une attaque sans PP ne peut pas être choisie.
    if (moves.every((m) => m.pp === 0) || moves[this.moveCursor].pp > 0) this.act({ kind: 'move', slot: this.moveCursor });
    else this.flash("Il n'y a plus de PP pour cette capacité !");
  }

  private openBag(): void {
    const state = this.game.state!;
    this.phase = 'busy';
    this.game.push(
      new BagScene(this.game, {
        inBattle: true,
        onUse: (item: ItemId) => {
          const def = ITEMS[item];
          if (def.kind === 'ball') {
            this.game.pop();
            state.bag[item]--;
            this.act({ kind: 'item', item, target: this.battle.active });
            return;
          }
          // Objet de soin : choisir le Pokémon.
          this.game.push(
            new PartyScene(this.game, {
              mode: 'item',
              prompt: `Utiliser ${def.name} sur quel Pokémon ?`,
              canPick: (index) => itemUsable(item, state.party[index]),
              refusal: 'Ça n\'aura aucun effet.',
              onPick: (index) => {
                this.game.pop();
                this.game.pop();
                state.bag[item]--;
                this.act({ kind: 'item', item, target: index });
              },
            }),
          );
        },
        onClose: () => {
          this.game.pop();
          this.phase = 'command';
        },
      }),
    );
  }

  private openParty(): void {
    this.phase = 'busy';
    this.game.push(
      new PartyScene(this.game, {
        mode: 'switch',
        prompt: 'Choisis un Pokémon.',
        canPick: (index) => this.battle.canSwitchTo(index),
        onPick: (index) => {
          this.game.pop();
          this.act({ kind: 'switch', index });
        },
        onClose: () => {
          this.game.pop();
          this.phase = 'command';
        },
      }),
    );
  }

  private act(action: PlayerAction): void {
    this.play(this.battle.turn(action));
  }

  /** Message court qui ne coûte pas de tour. */
  private flash(text: string): void {
    this.queue.unshift({ type: 'text', text });
    this.phase = 'events';
    this.dialog.done = true;
  }

  // --- Affichage ---

  private maxHpOf(side: Side): number {
    return maxHp(side === 'player' ? this.shownPlayer : this.battle.wild);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const intro = Math.min(this.time / INTRO_TIME, 1);
    const slide = (1 - easeOut(intro)) * WIDTH;
    this.drawBackground(ctx, slide);
    this.drawWild(ctx, -slide);
    this.drawPlayerPokemon(ctx, slide);
    if (intro >= 1) {
      this.drawEnemyBox(ctx);
      if (this.shown.visible.player || this.animation?.kind === 'withdraw') this.drawPlayerBox(ctx);
    }
    this.drawBall(ctx);

    switch (this.phase) {
      case 'command':
        this.dialog.draw(WIDTH - 104);
        this.drawCommands(ctx);
        break;
      case 'moves':
        this.drawMoves(ctx);
        break;
      case 'learn':
        this.dialog.draw();
        this.learn?.draw(ctx);
        break;
      default:
        if (intro >= 1 || this.phase !== 'intro') this.dialog.draw();
        else drawWindow(ctx, 2, HEIGHT - DIALOG_HEIGHT, WIDTH - 4, DIALOG_HEIGHT - 2);
    }
    if (this.levelPanel) this.drawLevelPanel(ctx);
    if (this.phase === 'outro') {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(this.outroTime / 0.5, 1)})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
  }

  /** Décor de combat dans les herbes, façon Diamant et Perle : ciel clair, prairie et deux plateformes. */
  private drawBackground(ctx: CanvasRenderingContext2D, slide: number): void {
    const sky = ctx.createLinearGradient(0, 0, 0, 100);
    sky.addColorStop(0, '#f0f8e0');
    sky.addColorStop(1, '#d8eec0');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#b8dc98';
    ctx.fillRect(0, 56, WIDTH, HEIGHT - 56);
    // Bandes d'herbe plus sombres vers le bas.
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#acd48c' : '#b8dc98';
      ctx.fillRect(0, 70 + i * 16, WIDTH, 8);
    }
    platform(ctx, ENEMY.x - slide, ENEMY.platformY, 54, 13);
    platform(ctx, PLAYER.x + slide, PLAYER.platformY, 66, 15);
  }

  private drawWild(ctx: CanvasRenderingContext2D, offset: number): void {
    const animation = this.animation;
    const wild = this.battle.wild;
    let visible = this.shown.visible.wild;
    let dx = offset;
    let dy = 0;
    let scale = 1;
    if (animation?.side === 'wild') {
      const t = animation.time / animation.duration;
      if (animation.kind === 'attack') dx -= Math.sin(t * Math.PI) * 10;
      if (animation.kind === 'hit') visible &&= Math.floor(t * 8) % 2 === 0;
      if (animation.kind === 'faint') dy = t * 60;
    }
    if (animation?.kind === 'ball') {
      // Aspiré dans la Poké Ball, puis ressorti si elle s'ouvre.
      const t = animation.time;
      if (t > 0.5 && t < 0.8) scale = 1 - (t - 0.5) / 0.3;
      else if (t >= 0.8) scale = 0;
      const end = animation.duration - (animation.caught ? 0.6 : 0.3);
      if (!animation.caught && t >= end) scale = Math.min(1, (t - end) / 0.3);
    }
    if (!visible || scale <= 0) return;
    const sprite = this.game.assets.pokemon[wild.species].front;
    const top = ENEMY.y - this.enemyBottom + 4;
    ctx.save();
    // Disparaît vers le bas en tombant K.O. (coupé au niveau de la plateforme).
    ctx.beginPath();
    ctx.rect(0, 0, WIDTH, ENEMY.y + 6);
    ctx.clip();
    if (scale < 1) {
      ctx.translate(ENEMY.x, ENEMY.y - 30);
      ctx.scale(scale, scale);
      ctx.translate(-ENEMY.x, -(ENEMY.y - 30));
      ctx.globalAlpha = Math.max(0.3, scale);
    }
    ctx.drawImage(sprite, Math.round(ENEMY.x - sprite.width / 2 + dx), Math.round(top + dy));
    if (animation?.side === 'wild' && animation.kind === 'stat') tintOverlay(ctx, sprite, ENEMY.x - sprite.width / 2 + dx, top, animation);
    ctx.restore();
  }

  private drawPlayerPokemon(ctx: CanvasRenderingContext2D, offset: number): void {
    const animation = this.animation;
    let visible = this.shown.visible.player;
    let dx = offset;
    let dy = 0;
    let scale = 1;
    if (animation?.side === 'player') {
      const t = animation.time / animation.duration;
      if (animation.kind === 'attack') dx += Math.sin(t * Math.PI) * 12;
      if (animation.kind === 'hit') visible &&= Math.floor(t * 8) % 2 === 0;
      if (animation.kind === 'faint') dy = t * 70;
      if (animation.kind === 'send') scale = t;
      if (animation.kind === 'withdraw') scale = 1 - t;
    }
    if ((!visible && animation?.kind !== 'withdraw') || scale <= 0) return;
    const sprite = this.game.assets.pokemon[this.shownPlayer.species].back;
    const left = PLAYER.x - sprite.width / 2 + dx;
    const top = PLAYER.top + dy;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, WIDTH, HEIGHT - DIALOG_HEIGHT);
    ctx.clip();
    if (scale < 1) {
      const cx = PLAYER.x;
      const cy = PLAYER.top + sprite.height - 10;
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -cy);
      // Apparition dans un éclair blanc.
      ctx.globalAlpha = 0.4 + scale * 0.6;
    }
    ctx.drawImage(sprite, Math.round(left), Math.round(top));
    if (animation?.side === 'player' && animation.kind === 'stat') tintOverlay(ctx, sprite, left, top, animation);
    ctx.restore();
  }

  /** Poké Ball lancée : arc jusqu'à l'adversaire, chute, secousses, puis étoiles ou éclatement. */
  private drawBall(ctx: CanvasRenderingContext2D): void {
    const animation = this.animation;
    if (animation?.kind !== 'ball') return;
    const t = animation.time;
    const groundY = ENEMY.y - 6;
    let x = ENEMY.x;
    let y = groundY;
    let angle = 0;
    if (t < 0.5) {
      const k = t / 0.5;
      x = lerp(20, ENEMY.x, k);
      y = lerp(150, ENEMY.y - 40, k) - Math.sin(k * Math.PI) * 50;
      angle = k * 12;
    } else if (t < 0.8) {
      y = ENEMY.y - 40;
    } else if (t < 1.1) {
      y = lerp(ENEMY.y - 40, groundY, (t - 0.8) / 0.3);
    } else {
      const shakeTime = t - 1.1;
      const shake = Math.floor(shakeTime / 0.6);
      if (shake < (animation.shakes ?? 0)) angle = Math.sin(((shakeTime % 0.6) / 0.6) * Math.PI * 2) * 0.5 * (shake % 2 === 0 ? 1 : -1);
    }
    const end = animation.duration - (animation.caught ? 0.6 : 0.3);
    if (!animation.caught && t >= end) return;
    drawPokeball(ctx, x, y, 6, angle);
    if (t > 0.5 && t < 0.8) {
      // Rayon rouge qui aspire le Pokémon.
      ctx.fillStyle = `rgba(255, 90, 90, ${0.5 - (t - 0.5)})`;
      ctx.beginPath();
      ctx.arc(x, y, 18, 0, Math.PI * 2);
      ctx.fill();
    }
    if (animation.caught && t >= end) {
      // Petites étoiles : capture réussie.
      const k = (t - end) / 0.6;
      ctx.fillStyle = '#f8d030';
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i - 1) * 0.7;
        ctx.fillRect(x + Math.cos(a) * 14 * k - 1.5, y + Math.sin(a) * 14 * k - 1.5, 3, 3);
      }
    }
  }

  private drawEnemyBox(ctx: CanvasRenderingContext2D): void {
    const wild = this.battle.wild;
    if (!this.shown.visible.wild && this.animation?.kind !== 'faint') return;
    drawWindow(ctx, 6, 12, 112, 32);
    drawText(ctx, nameOf(wild), 14, 25, { size: 10 });
    drawText(ctx, `N.${wild.level}`, 110, 25, { size: 9, align: 'right' });
    drawHpBar(ctx, 30, 30, 64, this.shown.hp.wild / maxHp(wild));
    drawStatus(ctx, this.shown.status.wild, 12, 31);
  }

  private drawPlayerBox(ctx: CanvasRenderingContext2D): void {
    const pokemon = this.shownPlayer;
    const x = 136;
    const y = HEIGHT - DIALOG_HEIGHT - 44;
    drawWindow(ctx, x, y, 116, 42);
    drawText(ctx, nameOf(pokemon), x + 8, y + 13, { size: 10 });
    drawText(ctx, `N.${this.shown.level}`, x + 108, y + 13, { size: 9, align: 'right' });
    const max = maxHp(pokemon);
    drawHpBar(ctx, x + 26, y + 17, 64, this.shown.hp.player / max);
    drawText(ctx, `${Math.max(0, this.shown.hp.player)}/${max}`, x + 108, y + 33, { size: 9, align: 'right' });
    drawStatus(ctx, this.shown.status.player, x + 8, y + 18);
    drawText(ctx, 'EXP', x + 8, y + 38, { size: 6, color: '#3098e8', shadow: null, bold: true });
    drawExpBar(ctx, x + 24, y + 35, 84, this.shown.exp);
  }

  private drawCommands(ctx: CanvasRenderingContext2D): void {
    const x = WIDTH - 104;
    const y = HEIGHT - DIALOG_HEIGHT;
    drawWindow(ctx, x, y, 102, DIALOG_HEIGHT - 2);
    COMMANDS.forEach((label, i) => {
      const cx = x + 14 + (i % 2) * 46;
      const cy = y + 18 + Math.floor(i / 2) * 16;
      drawText(ctx, label, cx, cy, { size: 9 });
      if (i === this.command) drawCursor(ctx, cx - 8, cy - 3);
    });
  }

  private drawMoves(ctx: CanvasRenderingContext2D): void {
    const y = HEIGHT - DIALOG_HEIGHT;
    const moves = this.battle.player.moves;
    drawWindow(ctx, 2, y, 168, DIALOG_HEIGHT - 2);
    moves.forEach((slot, i) => {
      const cx = 16 + (i % 2) * 78;
      const cy = y + 18 + Math.floor(i / 2) * 16;
      drawText(ctx, MOVES[slot.id].name, cx, cy, { size: 9, color: slot.pp === 0 ? '#a0a0a0' : undefined });
      if (i === this.moveCursor) drawCursor(ctx, cx - 8, cy - 3);
    });
    for (let i = moves.length; i < 4; i++) drawText(ctx, '-', 16 + (i % 2) * 78, y + 18 + Math.floor(i / 2) * 16, { size: 9 });
    const selected = moves[this.moveCursor];
    const def = MOVES[selected.id];
    drawWindow(ctx, 170, y, 84, DIALOG_HEIGHT - 2);
    drawText(ctx, 'PP', 180, y + 18, { size: 9 });
    drawText(ctx, `${selected.pp}/${def.pp}`, 244, y + 18, { size: 9, align: 'right', color: selected.pp === 0 ? '#e03030' : undefined });
    drawTypeBadge(ctx, def.type, 180, y + 26, 64);
  }

  private drawLevelPanel(ctx: CanvasRenderingContext2D): void {
    const panel = this.levelPanel!;
    const x = 142;
    const y = 30;
    drawWindow(ctx, x, y, 110, 86);
    (Object.keys(STAT_NAMES) as StatId[]).forEach((stat, i) => {
      const rowY = y + 16 + i * 12;
      drawText(ctx, STAT_NAMES[stat], x + 8, rowY, { size: 9 });
      drawText(ctx, `+${panel.after[stat] - panel.before[stat]}`, x + 82, rowY, { size: 9, align: 'right', color: '#d03030' });
      drawText(ctx, `${panel.after[stat]}`, x + 104, rowY, { size: 9, align: 'right' });
    });
  }
}

/**
 * Apprendre une 4e attaque quand on en connaît déjà 4 : on demande s'il faut
 * en oublier une, laquelle, ou si l'on renonce — avec les messages de Diamant et Perle.
 */
class LearnFlow {
  private step: 'intro' | 'ask' | 'choose' | 'giveUp' | 'outro' = 'intro';
  private menu: ChoiceMenu | null = null;
  private cursor = 0;
  private lines: string[] = [];
  private readonly game: Game;
  private readonly dialog: Dialog;
  private readonly pokemon: Pokemon;
  private readonly move: MoveId;
  private readonly done: () => void;

  constructor(game: Game, dialog: Dialog, pokemon: Pokemon, move: MoveId, done: () => void) {
    this.game = game;
    this.dialog = dialog;
    this.pokemon = pokemon;
    this.move = move;
    this.done = done;
    const name = nameOf(pokemon);
    this.say([`${name} veut apprendre ${MOVES[move].name}.`, `Mais ${name} connaît déjà quatre capacités.`, `Oublier une capacité pour ${MOVES[move].name} ?`], 'ask');
  }

  private next: LearnFlow['step'] = 'intro';

  private say(lines: string[], then: LearnFlow['step']): void {
    this.lines = lines.slice(1);
    this.dialog.show(lines[0]);
    this.step = 'intro';
    this.next = then;
    this.menu = null;
  }

  update(dt: number): void {
    const { input, audio } = this.game;
    if (this.step === 'intro' || this.step === 'outro') {
      this.dialog.update(dt, input);
      if (!this.dialog.done) return;
      const line = this.lines.shift();
      if (line) {
        this.dialog.show(line, { hold: this.lines.length === 0 && (this.next === 'ask' || this.next === 'giveUp') });
        return;
      }
      if (this.step === 'outro') {
        this.done();
        return;
      }
      this.step = this.next;
      if (this.step === 'ask' || this.step === 'giveUp') this.menu = new ChoiceMenu(this.game.ctx, ['OUI', 'NON'], { x: WIDTH - 8, y: HEIGHT - DIALOG_HEIGHT - 44, anchor: 'right', cancellable: true });
      return;
    }
    if (this.step === 'choose') {
      if (!this.dialog.pageComplete) {
        this.dialog.update(dt, input);
        return;
      }
      const direction = input.consumeDirection();
      if (direction === 'up' || direction === 'down') {
        this.cursor = (this.cursor + (direction === 'up' ? 3 : 1)) % 4;
        audio.select();
      }
      if (input.consume('b')) {
        audio.select();
        this.askGiveUp();
      } else if (input.consume('a')) {
        audio.select();
        const forgotten = MOVES[this.pokemon.moves[this.cursor].id].name;
        this.pokemon.moves[this.cursor] = { id: this.move, pp: MOVES[this.move].pp };
        const name = nameOf(this.pokemon);
        this.finish(['1, 2 et… Tadaaa !', `${name} oublie ${forgotten}…`, `Et ${name} apprend ${MOVES[this.move].name} !`]);
      }
      return;
    }
    const choice = this.menu?.update(input, audio);
    if (choice === null || choice === undefined) return;
    const yes = choice === 0;
    if (this.step === 'ask') {
      if (yes) {
        this.step = 'choose';
        this.menu = null;
        this.dialog.show('Quelle capacité oublier ?', { hold: true });
      } else this.askGiveUp();
    } else if (yes) {
      this.finish([`${nameOf(this.pokemon)} n'a pas appris ${MOVES[this.move].name}.`]);
    } else {
      this.say([`Oublier une capacité pour ${MOVES[this.move].name} ?`], 'ask');
    }
  }

  private askGiveUp(): void {
    this.say([`Renoncer à apprendre ${MOVES[this.move].name} ?`], 'giveUp');
  }

  private finish(lines: string[]): void {
    this.say(lines, 'outro');
    this.step = 'outro';
  }

  draw(ctx: CanvasRenderingContext2D): void {
    this.menu?.draw(ctx);
    if (this.step !== 'choose') return;
    const x = WIDTH - 120;
    const y = 8;
    drawWindow(ctx, x, y, 114, 70);
    this.pokemon.moves.forEach((slot, i) => {
      const rowY = y + 18 + i * 14;
      drawText(ctx, MOVES[slot.id].name, x + 16, rowY, { size: 9 });
      drawText(ctx, `${slot.pp}/${MOVES[slot.id].pp}`, x + 106, rowY, { size: 8, align: 'right' });
      if (i === this.cursor) drawCursor(ctx, x + 7, rowY - 3);
    });
  }
}

function platform(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.fillStyle = '#7fae5c';
  ctx.beginPath();
  ctx.ellipse(x, y + 2, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#a2cc78';
  ctx.beginPath();
  ctx.ellipse(x, y, rx - 4, ry - 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c4e29a';
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.2, y - 2, rx * 0.5, ry * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Lueur rouge (hausse) ou bleue (baisse) sur un Pokémon dont une statistique change. */
function tintOverlay(ctx: CanvasRenderingContext2D, sprite: HTMLCanvasElement, x: number, y: number, animation: Animation): void {
  const alpha = Math.sin((animation.time / animation.duration) * Math.PI) * 0.55;
  const tinted = document.createElement('canvas');
  tinted.width = sprite.width;
  tinted.height = sprite.height;
  const t = tinted.getContext('2d')!;
  t.drawImage(sprite, 0, 0);
  t.globalCompositeOperation = 'source-atop';
  t.fillStyle = animation.up ? '#ff5040' : '#4070ff';
  t.fillRect(0, 0, sprite.width, sprite.height);
  ctx.globalAlpha = alpha;
  ctx.drawImage(tinted, Math.round(x), Math.round(y));
  ctx.globalAlpha = 1;
}

function statsAtLevel(pokemon: Pokemon, level: number): Record<StatId, number> {
  return statsOf({ ...pokemon, level });
}

/** La barre de PV glisse à vitesse constante (une barre pleine en ~1 s). */
function hpDuration(from: number, to: number, max: number): number {
  return Math.max(0.25, (Math.abs(from - to) / Math.max(max, 1)) * 1.2);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}
