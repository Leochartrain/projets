import { createPokemon } from '../battle/pokemon.ts';
import { HEIGHT, TILE, WIDTH } from '../core/constants.ts';
import { DIRECTION_VECTORS, type Direction } from '../core/input.ts';
import { randInt, weighted } from '../core/random.ts';
import { ENCOUNTER_CHANCE, ENCOUNTERS } from '../data/encounters.ts';
import type { Game, Scene } from '../game.ts';
import { healParty, markSeen } from '../state.ts';
import { Dialog } from '../ui/dialog.ts';
import {
  canEnter,
  EAST_ZONE_X,
  exitMessage,
  isLedge,
  isOutside,
  isTallGrass,
  LAKE_MESSAGE,
  LAKE_PATH_END,
  MAP_HEIGHT,
  MAP_WIDTH,
  MOM,
  RESPAWN,
  SIGNS,
  tileAt,
} from '../world/map.ts';
import { WorldRenderer, type Prop } from '../world/render.ts';
import { BattleScene } from './battle.ts';
import { StartMenu } from './startMenu.ts';
import { EncounterTransition } from './transition.ts';

/** Durée d'un pas (une case) en marchant et en courant, comme dans Diamant et Perle. */
const WALK_TIME = 0.26;
const RUN_TIME = 0.13;
/** En dessous de cette durée d'appui, on se tourne sans avancer. */
const TURN_TIME = 0.09;
/** Saut d'un rebord : deux cases vers le bas. */
const JUMP_TIME = 0.42;
const RUSTLE_TIME = 0.25;

/** Sprite du héros (Mystic Woods) : cases de 48 px, pieds à 41 px du haut ; lignes : immobile 0-2, marche 3-5 (bas, droite, haut). */
const CELL = 48;
const FOOT_Y = 41;
const ROWS: Record<Direction, number> = { down: 0, right: 1, up: 2, left: 1 };

interface Step {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  time: number;
  duration: number;
  jump: boolean;
}

export class OverworldScene implements Scene {
  private readonly game: Game;
  private readonly world: WorldRenderer;
  private readonly dialog: Dialog;
  private readonly momSheet: HTMLCanvasElement;
  private step: Step | null = null;
  /** Après s'être tourné, il faut maintenir la direction un instant avant de marcher. */
  private turnLock = 0;
  private bumpCooldown = 0;
  private animTime = 0;
  private time = 0;
  /** Messages en attente, et ce qu'il faut faire une fois lus. */
  private queue: string[] = [];
  private afterDialog: (() => void) | null = null;
  private rustle: { x: number; y: number; time: number } | null = null;

  constructor(game: Game, intro: string[] = []) {
    this.game = game;
    this.world = new WorldRenderer(game.assets);
    this.dialog = new Dialog(game.ctx);
    this.momSheet = recolorClothes(game.assets.sheets.player);
    if (intro.length > 0) this.say(intro);
  }

  private get position() {
    return this.game.state!.position;
  }

  /** Affiche des messages l'un après l'autre, puis appelle `then`. */
  say(lines: string[], then: (() => void) | null = null): void {
    this.queue = [...lines];
    this.afterDialog = then;
    this.dialog.show(this.queue.shift()!);
  }

  update(dt: number): void {
    this.time += dt;
    this.bumpCooldown = Math.max(0, this.bumpCooldown - dt);
    if (this.rustle && (this.rustle.time -= dt) <= 0) this.rustle = null;
    const { input, audio } = this.game;

    if (!this.dialog.done) {
      this.dialog.update(dt, input);
      if (this.dialog.done) {
        if (this.queue.length > 0) this.dialog.show(this.queue.shift()!);
        else {
          const then = this.afterDialog;
          this.afterDialog = null;
          then?.();
        }
      }
      return;
    }

    if (this.step) {
      this.advanceStep(dt);
      return;
    }

    if (input.consume('menu') || input.consume('b')) {
      audio.select();
      this.game.push(new StartMenu(this.game));
      return;
    }
    if (input.consume('a')) {
      this.interact();
      return;
    }

    const direction = input.direction;
    // Appui très bref (relâché avant cette image) : on se tourne quand même.
    const tapped = input.consumeDirection();
    if (!direction) {
      if (tapped && this.animTime === 0) this.position.facing = tapped;
      this.turnLock = 0;
      this.animTime = 0;
      return;
    }
    if (direction !== this.position.facing && this.animTime === 0) {
      // Un appui bref dans une autre direction tourne le héros sur place ; maintenu, il se met à marcher.
      this.position.facing = direction;
      this.turnLock = TURN_TIME;
      return;
    }
    this.position.facing = direction;
    this.turnLock -= dt;
    if (this.turnLock > 0) return;
    this.tryMove(direction);
  }

  private tryMove(direction: Direction): void {
    const { x, y } = this.position;
    const [dx, dy] = DIRECTION_VECTORS[direction];
    const toX = x + dx;
    const toY = y + dy;
    const running = this.game.input.isHeld('run');

    if (isLedge(toX, toY) && direction === 'down' && canEnter(x, y + 2, 'down')) {
      this.step = { fromX: x, fromY: y, toX: x, toY: y + 2, time: 0, duration: JUMP_TIME, jump: true };
      this.game.audio.bump();
      return;
    }
    if (isOutside(toX, toY) && tileAt(toX, toY) === ':') {
      this.animTime = 0;
      this.say([exitMessage(toX)]);
      return;
    }
    if (!canEnter(toX, toY, direction) || isLedge(toX, toY)) {
      if (this.bumpCooldown === 0) {
        this.game.audio.bump();
        this.bumpCooldown = 0.35;
      }
      this.animTime = 0;
      return;
    }
    this.step = { fromX: x, fromY: y, toX, toY, time: 0, duration: running ? RUN_TIME : WALK_TIME, jump: false };
  }

  private advanceStep(dt: number): void {
    const step = this.step!;
    step.time += dt;
    this.animTime += dt * (step.duration === RUN_TIME ? 1.6 : 1);
    if (step.time < step.duration) return;
    this.position.x = step.toX;
    this.position.y = step.toY;
    this.step = null;
    if (isTallGrass(step.toX, step.toY)) {
      this.rustle = { x: step.toX, y: step.toY, time: RUSTLE_TIME };
      if (Math.random() < ENCOUNTER_CHANCE) this.startEncounter();
    }
  }

  private interact(): void {
    const { x, y, facing } = this.position;
    const [dx, dy] = DIRECTION_VECTORS[facing];
    const tx = x + dx;
    const ty = y + dy;
    const sign = SIGNS[`${tx},${ty}`];
    if (sign) {
      this.game.audio.select();
      this.say([sign]);
    } else if (tx === MOM.x && ty === MOM.y) {
      this.game.audio.select();
      this.say(MOM.lines.slice(0, 3), () => {
        healParty(this.game.state!);
        this.game.audio.heal();
        this.say([MOM.lines[3]]);
      });
    } else if (facing === 'up' && y === LAKE_PATH_END.y && x >= LAKE_PATH_END.x1 && x <= LAKE_PATH_END.x2) {
      this.say([LAKE_MESSAGE]);
    }
  }

  // --- Rencontres ---

  private startEncounter(): void {
    const state = this.game.state!;
    const zone = this.position.x >= EAST_ZONE_X ? 'east' : 'west';
    const slot = weighted(Math.random, ENCOUNTERS[zone].map((s) => ({ weight: s.weight, value: s })));
    const wild = createPokemon(slot.species, randInt(Math.random, slot.minLevel, slot.maxLevel), Math.random);
    markSeen(state, wild.species);
    this.game.audio.encounter();
    this.animTime = 0;
    this.game.push(
      new EncounterTransition(this.game, () => {
        this.game.pop();
        this.game.push(new BattleScene(this.game, wild, (outcome) => this.afterBattle(outcome)));
      }),
    );
  }

  private afterBattle(outcome: string): void {
    if (outcome !== 'lose') return;
    // Plus de Pokémon en état de se battre : retour chez maman, équipe soignée.
    const state = this.game.state!;
    healParty(state);
    Object.assign(state.position, RESPAWN);
    this.say(['Tu te précipites chez toi pour protéger tes Pokémon épuisés…', 'MAMAN : Oh là là ! Tes Pokémon sont tout fatigués… Voilà, ils sont soignés. Courage !']);
  }

  // --- Affichage ---

  /** Position du héros en pixels (pieds), entre deux cases pendant un pas. */
  private heroPixels(): { x: number; y: number; hop: number } {
    const step = this.step;
    if (!step) return { x: this.position.x * TILE, y: this.position.y * TILE, hop: 0 };
    const t = Math.min(step.time / step.duration, 1);
    const hop = step.jump ? Math.sin(t * Math.PI) * 10 : 0;
    return {
      x: (step.fromX + (step.toX - step.fromX) * t) * TILE,
      y: (step.fromY + (step.toY - step.fromY) * t) * TILE,
      hop,
    };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const hero = this.heroPixels();
    // Caméra centrée sur le héros, bloquée aux bords de la carte.
    const cameraX = Math.round(clamp(hero.x + TILE / 2 - WIDTH / 2, 0, MAP_WIDTH * TILE - WIDTH));
    const cameraY = Math.round(clamp(hero.y + TILE / 2 - HEIGHT / 2, 0, MAP_HEIGHT * TILE - HEIGHT));

    ctx.drawImage(this.world.ground, cameraX, cameraY, WIDTH, HEIGHT, 0, 0, WIDTH, HEIGHT);
    if (this.rustle) ctx.drawImage(this.world.tallGrass[1], this.rustle.x * TILE - cameraX, this.rustle.y * TILE - cameraY);

    const heroProp: Prop = {
      bottom: hero.y + TILE,
      draw: () => this.drawHero(ctx, hero.x - cameraX, hero.y - cameraY, hero.hop),
    };
    const momProp: Prop = {
      bottom: (MOM.y + 1) * TILE,
      draw: () => this.drawCharacter(ctx, this.momSheet, MOM.x * TILE - cameraX, MOM.y * TILE - cameraY, 'down', false, 0),
    };
    const visible = this.world.props.filter((p) => p.bottom > cameraY && p.bottom - 80 < cameraY + HEIGHT);
    for (const prop of [...visible, heroProp, momProp].sort((a, b) => a.bottom - b.bottom)) prop.draw(ctx, cameraX, cameraY);

    if (!this.dialog.done) this.dialog.draw();
  }

  private drawHero(ctx: CanvasRenderingContext2D, x: number, y: number, hop: number): void {
    const walking = this.step !== null || this.animTime > 0;
    this.drawCharacter(ctx, this.game.assets.sheets.player, x, y - hop, this.position.facing, walking, this.animTime);
    // Dans les hautes herbes, le bas des brins passe devant les jambes.
    if (!this.step && isTallGrass(this.position.x, this.position.y)) {
      const grass = this.world.tallGrass[this.rustle ? 1 : 0];
      ctx.drawImage(grass, 0, 8, TILE, 8, x, y + 8, TILE, 8);
    }
  }

  private drawCharacter(ctx: CanvasRenderingContext2D, sheet: CanvasImageSource, x: number, y: number, facing: Direction, walking: boolean, time: number): void {
    const row = ROWS[facing] + (walking ? 3 : 0);
    const frame = walking ? Math.floor(time * 12) % 6 : Math.floor(this.time * 5) % 6;
    const left = Math.round(x + TILE / 2 - CELL / 2);
    const top = Math.round(y + TILE - 2 - FOOT_Y);
    // Ombre au sol.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.beginPath();
    ctx.ellipse(x + TILE / 2, y + TILE - 2, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    if (facing === 'left') {
      // La gauche est la droite retournée.
      ctx.translate(left + CELL, top);
      ctx.scale(-1, 1);
      ctx.drawImage(sheet, frame * CELL, row * CELL, CELL, CELL, 0, 0, CELL, CELL);
    } else {
      ctx.drawImage(sheet, frame * CELL, row * CELL, CELL, CELL, left, top, CELL, CELL);
    }
    ctx.restore();
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Maman : la planche du héros dont seuls les vêtements bleus deviennent roses
 * (la peau et les cheveux gardent leurs couleurs).
 */
function recolorClothes(image: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = pixels.data;
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    // Bleu dominant : on échange rouge et bleu (bleu → rose), en gardant la luminosité.
    if (b > r + 15 && b > g) {
      data[i] = Math.min(255, b + 20);
      data[i + 1] = Math.round(g * 0.75);
      data[i + 2] = Math.min(255, r + 40);
    }
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}
