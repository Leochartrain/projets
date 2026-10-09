import Phaser from 'phaser';
import { RES, TILE_H, TILE_W, seeded } from '../art/canvas.ts';
import { MARGIN, ground } from '../art/ground.ts';
import { bus, type Placement, type Selection } from '../app/bus.ts';
import { formatDuration } from '../app/format.ts';
import { BUILDINGS, MAP_SIZE } from '../game/config.ts';
import { phenotype } from '../game/genetics.ts';
import { build, canPlace, collect, isActive, isAdult, levelDef, move } from '../game/sim.ts';
import type { Animal, Building } from '../game/state.ts';
import { OBSTACLE_INFO } from '../game/state.ts';
import type { Store } from '../game/store.ts';
import { depthOf, toGrid, toWorld } from './iso.ts';
import { Textures } from './textures.ts';

const FONT = '"Lilita One", sans-serif';
/** Au-dessus de tout le décor : barres, bulles, étiquettes. */
const UI_DEPTH = 1_000_000;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 1.8;
/** Distance (pixels écran) au-delà de laquelle un appui devient un glissé de la carte. */
const DRAG_THRESHOLD = 8;

interface BuildingView {
  main: Phaser.GameObjects.Image;
  /** Enclos : la clôture avant, qui passe devant les animaux. */
  front?: Phaser.GameObjects.Image;
  scaffold?: Phaser.GameObjects.Image;
  bar: Phaser.GameObjects.Graphics;
  timer: Phaser.GameObjects.Text;
  bubble?: Phaser.GameObjects.Image;
  /** Ce qui a servi à choisir les images : si ça change, on les recrée. */
  look: string;
  /** Haut de l'image, pour placer barres et bulles. */
  top: number;
}

interface AnimalView {
  sprite: Phaser.GameObjects.Image;
  /** Position dans l'enclos, en cases depuis son coin nord. */
  u: number;
  v: number;
  tu: number;
  tv: number;
  wait: number;
  phase: number;
  look: string;
}

interface Placing {
  placement: Placement;
  size: number;
  ghost: Phaser.GameObjects.Image;
  ghostFront?: Phaser.GameObjects.Image;
  marker: Phaser.GameObjects.Graphics;
  gx: number;
  gy: number;
}

export class WorldScene extends Phaser.Scene {
  private store: Store;
  private tex!: Textures;
  private buildingViews = new Map<number, BuildingView>();
  private obstacleViews = new Map<number, Phaser.GameObjects.Image>();
  private animalViews = new Map<number, AnimalView>();
  private selection: Selection = null;
  private selectMarker!: Phaser.GameObjects.Graphics;
  private selectLabel!: Phaser.GameObjects.Text;
  private gridLines!: Phaser.GameObjects.Graphics;
  private placing?: Placing;
  private drag = { down: false, moved: false, x: 0, y: 0 };
  private heartClock = 0;

  constructor(store: Store) {
    super('world');
    this.store = store;
  }

  create(): void {
    this.tex = new Textures(this);
    this.createGround();
    this.createForest();

    this.gridLines = this.add.graphics().setDepth(-50_000).setVisible(false);
    this.drawGrid();
    this.selectMarker = this.add.graphics();
    this.selectLabel = this.add
      .text(0, 0, '', { fontFamily: FONT, fontSize: '22px', color: '#ffffff', stroke: '#2a1c12', strokeThickness: 5, align: 'center' })
      .setOrigin(0.5, 1)
      .setDepth(UI_DEPTH + 2)
      .setVisible(false);

    this.setupCamera();
    this.setupInput();

    bus.on('select', (sel) => this.showSelection(sel));
    bus.on('placeStart', (p) => this.startPlacing(p));
    bus.on('placeCancel', () => this.stopPlacing());
    bus.on('float', ({ buildingId, text, resource }) => this.floatText(buildingId, text, resource));
    bus.on('focus', (id) => this.focus(id));

    this.store.subscribe(() => this.sync());
    this.sync();
  }

  // ─── Décor fixe ─────────────────────────────────────────────────────────

  private createGround(): void {
    const g = ground();
    this.textures.addCanvas('ground', g.canvas);
    this.add.image(g.x, g.y, 'ground').setOrigin(0, 0).setDepth(-100_000);
  }

  private createForest(): void {
    const rand = seeded(77);
    for (let gy = -MARGIN + 1; gy < MAP_SIZE + MARGIN - 1; gy++) {
      for (let gx = -MARGIN + 1; gx < MAP_SIZE + MARGIN - 1; gx++) {
        const inside = gx >= 0 && gy >= 0 && gx < MAP_SIZE && gy < MAP_SIZE;
        if (inside || rand() > 0.55) continue;
        const key = this.tex.forest(Math.floor(rand() * 6));
        const o = this.tex.origin(key);
        const p = toWorld(gx + 1 + (rand() - 0.5) * 0.4, gy + 1 + (rand() - 0.5) * 0.4);
        this.add.image(p.x, p.y, key).setOrigin(o.x, o.y).setScale(1 / RES).setDepth(p.y);
      }
    }
  }

  private drawGrid(): void {
    const g = this.gridLines;
    g.lineStyle(1, 0xffffff, 0.22);
    for (let i = 0; i <= MAP_SIZE; i++) {
      const a = toWorld(i, 0);
      const b = toWorld(i, MAP_SIZE);
      g.lineBetween(a.x, a.y, b.x, b.y);
      const c = toWorld(0, i);
      const d = toWorld(MAP_SIZE, i);
      g.lineBetween(c.x, c.y, d.x, d.y);
    }
  }

  // ─── Caméra et entrées ──────────────────────────────────────────────────

  private setupCamera(): void {
    const cam = this.cameras.main;
    cam.setBackgroundColor('#3f7a2a');
    const half = ((MAP_SIZE + MARGIN * 2) * TILE_W) / 2;
    const top = -MARGIN * TILE_H;
    cam.setBounds(-half, top, half * 2, (MAP_SIZE + MARGIN * 2) * TILE_H);
    cam.setZoom(Math.min(1.15, Math.max(0.7, window.innerWidth / 1200)));
    const mairie = this.store.state.buildings.find((b) => b.type === 'mairie');
    const c = mairie ? toWorld(mairie.x + 2, mairie.y + 2) : toWorld(MAP_SIZE / 2, MAP_SIZE / 2);
    cam.centerOn(c.x, c.y);
  }

  private setupInput(): void {
    const cam = this.cameras.main;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.drag = { down: true, moved: false, x: p.x, y: p.y };
    });
    // Deux doigts : pincer pour zoomer.
    this.input.addPointer(1);
    let pinch = 0;
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const [a, b] = [this.input.pointer1, this.input.pointer2];
      if (a.isDown && b.isDown) {
        const dist = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
        if (pinch) cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dist / pinch), MIN_ZOOM, MAX_ZOOM));
        pinch = dist;
        this.drag.moved = true;
        return;
      }
      pinch = 0;
      if (this.placing && !p.isDown) this.ghostToPointer(p);
      if (!this.drag.down || !p.isDown) return;
      if (!this.drag.moved && Math.hypot(p.x - this.drag.x, p.y - this.drag.y) > DRAG_THRESHOLD) this.drag.moved = true;
      if (this.drag.moved) {
        cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
        cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
      }
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.drag.down && !this.drag.moved) this.tap(p);
      this.drag.down = false;
    });
    this.input.on('wheel', (p: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => {
      const before = cam.getWorldPoint(p.x, p.y);
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), MIN_ZOOM, MAX_ZOOM));
      const after = cam.getWorldPoint(p.x, p.y);
      cam.scrollX += before.x - after.x;
      cam.scrollY += before.y - after.y;
    });
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.placing) bus.emit('placeCancel');
      else bus.emit('select', null);
    });
  }

  private tap(p: Phaser.Input.Pointer): void {
    const world = this.cameras.main.getWorldPoint(p.x, p.y);
    if (this.placing) {
      const { gx, gy } = this.gridUnder(world.x, world.y, this.placing.size);
      if (gx === this.placing.gx && gy === this.placing.gy) this.confirmPlacing();
      else this.moveGhost(gx, gy);
      return;
    }
    const hit = this.pick(world.x, world.y);
    if (hit?.kind === 'building') {
      const view = this.buildingViews.get(hit.id);
      if (view?.bubble?.visible) this.collect(hit.id);
    }
    bus.emit('select', hit);
  }

  /** Bâtiment ou obstacle sous un point du monde, en tenant compte de la transparence des images. */
  private pick(x: number, y: number): Selection {
    const candidates: { sel: NonNullable<Selection>; img: Phaser.GameObjects.Image }[] = [];
    for (const [id, v] of this.buildingViews) {
      candidates.push({ sel: { kind: 'building', id }, img: v.main });
      if (v.front) candidates.push({ sel: { kind: 'building', id }, img: v.front });
    }
    for (const [id, img] of this.obstacleViews) candidates.push({ sel: { kind: 'obstacle', id }, img });
    candidates.sort((a, b) => b.img.depth - a.img.depth);
    for (const { sel, img } of candidates) {
      const left = img.x - img.displayWidth * img.originX;
      const top = img.y - img.displayHeight * img.originY;
      const lx = (x - left) / img.scaleX;
      const ly = (y - top) / img.scaleY;
      if (lx < 0 || ly < 0 || lx >= img.width || ly >= img.height) continue;
      if (this.textures.getPixelAlpha(Math.floor(lx), Math.floor(ly), img.texture.key) > 60) return sel;
    }
    // Pas d'image sous le doigt : on regarde l'emprise au sol (sol d'un enclos par exemple).
    const { gx, gy } = toGrid(x, y);
    const s = this.store.state;
    const b = s.buildings.find((it) => gx >= it.x && gy >= it.y && gx < it.x + BUILDINGS[it.type].size && gy < it.y + BUILDINGS[it.type].size);
    return b ? { kind: 'building', id: b.id } : null;
  }

  private collect(id: number): void {
    const result = this.store.act((s) => collect(s, id));
    if (result.ok) bus.emit('float', { buildingId: id, text: `+${result.amount}`, resource: result.resource });
    else bus.emit('toast', { text: result.reason, kind: 'error' });
  }

  private focus(id: number): void {
    const b = this.store.state.buildings.find((it) => it.id === id);
    if (!b) return;
    const size = BUILDINGS[b.type].size;
    const c = toWorld(b.x + size / 2, b.y + size / 2);
    this.cameras.main.pan(c.x, c.y, 400, 'Sine.easeInOut');
  }

  // ─── Synchronisation avec l'état du jeu ─────────────────────────────────

  private sync(): void {
    const s = this.store.state;
    const seen = new Set<number>();
    for (const b of s.buildings) {
      seen.add(b.id);
      this.syncBuilding(b);
    }
    for (const [id, v] of this.buildingViews) {
      if (!seen.has(id)) {
        this.destroyBuildingView(v);
        this.buildingViews.delete(id);
      }
    }

    const obstacles = new Set(s.obstacles.map((o) => o.id));
    for (const o of s.obstacles) {
      if (this.obstacleViews.has(o.id)) continue;
      const key = this.tex.obstacle(o.kind);
      const origin = this.tex.origin(key);
      const p = toWorld(o.x + o.size, o.y + o.size);
      this.obstacleViews.set(o.id, this.add.image(p.x, p.y, key).setOrigin(origin.x, origin.y).setScale(1 / RES).setDepth(p.y));
    }
    for (const [id, img] of this.obstacleViews) {
      if (!obstacles.has(id)) {
        img.destroy();
        this.obstacleViews.delete(id);
      }
    }

    const animals = new Set(s.animals.map((a) => a.id));
    for (const a of s.animals) this.syncAnimal(a);
    for (const [id, v] of this.animalViews) {
      if (!animals.has(id)) {
        v.sprite.destroy();
        this.animalViews.delete(id);
      }
    }

    // La sélection a disparu (obstacle retiré, décoration vendue) : on la quitte.
    const sel = this.selection;
    if (sel && !(sel.kind === 'building' ? this.buildingViews.has(sel.id) : this.obstacleViews.has(sel.id))) {
      bus.emit('select', null);
    } else if (sel) {
      this.showSelection(sel, false);
    }
    if (this.placing) this.moveGhost(this.placing.gx, this.placing.gy);
  }

  private syncBuilding(b: Building): void {
    const size = BUILDINGS[b.type].size;
    const look = `${b.level}:${b.work ? 1 : 0}:${b.x}:${b.y}`;
    let view = this.buildingViews.get(b.id);
    if (view && view.look !== look) {
      this.destroyBuildingView(view);
      view = undefined;
    }
    const base = toWorld(b.x + size, b.y + size);
    if (!view) {
      const key = b.level === 0 ? this.tex.site(size) : this.tex.building(b.type, b.level);
      const main = this.image(key, base.x, base.y);
      if (b.type === 'enclos' && b.level >= 1) {
        // Le sol et la clôture arrière passent sous les animaux.
        main.setDepth(depthOf(b.x, b.y));
      }
      view = {
        main,
        bar: this.add.graphics().setDepth(UI_DEPTH),
        timer: this.add
          .text(0, 0, '', { fontFamily: FONT, fontSize: '17px', color: '#ffffff', stroke: '#2a1c12', strokeThickness: 4 })
          .setOrigin(0.5, 1)
          .setDepth(UI_DEPTH),
        look,
        top: this.contentTop(main),
      };
      if (b.type === 'enclos' && b.level >= 1) view.front = this.image(this.tex.penFront(b.level), base.x, base.y);
      if (b.work) view.scaffold = this.image(this.tex.scaffold(size), base.x, base.y).setDepth(base.y + 1);
      this.buildingViews.set(b.id, view);
    }

    // Chantier : barre de progression et temps restant.
    view.bar.clear();
    if (b.work) {
      const now = this.store.state.time;
      const progress = Phaser.Math.Clamp(1 - (b.work.endsAt - now) / b.work.duration, 0, 1);
      const w = 70;
      const y = view.top + 4;
      view.bar.fillStyle(0x2a1c12, 1).fillRoundedRect(base.x - w / 2 - 2, y - 2, w + 4, 14, 6);
      view.bar.fillStyle(0x4a3a2a, 1).fillRoundedRect(base.x - w / 2, y, w, 10, 5);
      if (progress > 0) view.bar.fillStyle(0x7ddc3c, 1).fillRoundedRect(base.x - w / 2, y, Math.max(10, w * progress), 10, 5);
      view.timer.setText(formatDuration((b.work.endsAt - now) / 1000)).setPosition(base.x, y - 2).setVisible(true);
    } else {
      view.timer.setVisible(false);
    }

    // Bulle de récolte.
    const collectable = (b.type === 'ferme' || b.type === 'billetterie') && isActive(b);
    const ready = collectable && b.stored >= Math.min(10, levelDef(b).capacity!);
    if (ready && !view.bubble) {
      const key = this.tex.bubble(b.type === 'ferme' ? 'nourriture' : 'or');
      view.bubble = this.add.image(base.x, view.top + 6, key).setOrigin(0.5, 1).setScale(1 / RES).setDepth(UI_DEPTH - 1);
      view.bubble.setData('baseY', view.top + 6);
      this.tweens.add({ targets: view.bubble, scale: { from: 0, to: 1 / RES }, duration: 250, ease: 'Back.easeOut' });
    } else if (!ready && view.bubble) {
      view.bubble.destroy();
      view.bubble = undefined;
    }
  }

  /** Haut visible d'une image dans le monde (sans la marge transparente). */
  private contentTop(img: Phaser.GameObjects.Image): number {
    return img.y - img.displayHeight * img.originY + this.tex.contentTop(img.texture.key) * img.scaleY;
  }

  private image(key: string, x: number, y: number): Phaser.GameObjects.Image {
    const o = this.tex.origin(key);
    return this.add.image(x, y, key).setOrigin(o.x, o.y).setScale(1 / RES).setDepth(y);
  }

  private destroyBuildingView(v: BuildingView): void {
    v.main.destroy();
    v.front?.destroy();
    v.scaffold?.destroy();
    v.bar.destroy();
    v.timer.destroy();
    v.bubble?.destroy();
  }

  private syncAnimal(a: Animal): void {
    const p = phenotype(a.genes);
    const look = `${p.coat}:${p.spotted}`;
    let view = this.animalViews.get(a.id);
    if (!view) {
      const u = 0.6 + Math.random() * 2.8;
      const v = 0.6 + Math.random() * 2.8;
      view = {
        sprite: this.add.image(0, 0, this.tex.animal(a.species, p.coat, p.spotted)),
        u,
        v,
        tu: u,
        tv: v,
        wait: Math.random() * 2,
        phase: Math.random() * 10,
        look,
      };
      const o = this.tex.origin(view.sprite.texture.key);
      view.sprite.setOrigin(o.x, o.y);
      this.animalViews.set(a.id, view);
      // Petite apparition.
      view.sprite.setScale(0);
    }
    const adult = isAdult(a, this.store.state.time);
    view.sprite.setData('scale', (adult ? 1 : 0.62) / RES);
    view.sprite.setData('pen', a.penId);
    view.sprite.setData('hop', a.species === 'lapin');
  }

  // ─── Sélection ──────────────────────────────────────────────────────────

  private showSelection(sel: Selection, bounce = true): void {
    const changed = JSON.stringify(sel) !== JSON.stringify(this.selection);
    this.selection = sel;
    this.selectMarker.clear();
    this.selectLabel.setVisible(false);
    if (!sel) return;
    const s = this.store.state;
    let x: number;
    let y: number;
    let size: number;
    let label: string;
    let img: Phaser.GameObjects.Image | undefined;
    if (sel.kind === 'building') {
      const b = s.buildings.find((it) => it.id === sel.id);
      if (!b) return;
      ({ x, y } = b);
      size = BUILDINGS[b.type].size;
      const def = BUILDINGS[b.type];
      label = def.levels.length > 1 ? `${def.name}\nniveau ${Math.max(1, b.level)}` : def.name;
      img = this.buildingViews.get(b.id)?.main;
    } else {
      const o = s.obstacles.find((it) => it.id === sel.id);
      if (!o) return;
      ({ x, y, size } = o);
      label = OBSTACLE_INFO[o.kind].name;
      img = this.obstacleViews.get(o.id);
    }
    this.diamond(this.selectMarker, x, y, size, 0xffffff, 0.18, 0xffffff);
    // Sur le sol, sous les bâtiments ; pour un enclos, juste au-dessus de son sol d'herbe.
    const onPen = sel.kind === 'building' && s.buildings.find((b) => b.id === sel.id)?.type === 'enclos';
    this.selectMarker.setDepth(onPen ? depthOf(x, y) + 0.5 : -50_000);
    const base = toWorld(x + size, y + size);
    const top = img ? this.contentTop(img) : base.y - 40;
    // Au-dessus de la barre de chantier s'il y en a une.
    const working = sel.kind === 'building' && !!s.buildings.find((b) => b.id === sel.id)?.work;
    this.selectLabel.setText(label).setPosition(base.x, top - (working ? 30 : 6)).setVisible(true);
    if (bounce && changed && img) {
      this.tweens.add({ targets: img, scaleX: 1.06 / RES, scaleY: 0.94 / RES, duration: 80, yoyo: true, ease: 'Sine.easeOut' });
    }
  }

  private diamond(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number, fill: number, alpha: number, line: number): void {
    const pts = [toWorld(x, y), toWorld(x + size, y), toWorld(x + size, y + size), toWorld(x, y + size)].map(
      (p) => new Phaser.Math.Vector2(p.x, p.y),
    );
    g.fillStyle(fill, alpha).fillPoints(pts, true);
    g.lineStyle(3, line, 0.9).strokePoints(pts, true);
  }

  // ─── Placement ──────────────────────────────────────────────────────────

  private startPlacing(placement: Placement): void {
    this.stopPlacing(false);
    bus.emit('select', null);
    const type = placement.type;
    const size = BUILDINGS[type].size;
    const key = this.tex.building(type, 1);
    const ghost = this.image(key, 0, 0).setAlpha(0.85).setDepth(UI_DEPTH - 10);
    const ghostFront = type === 'enclos' ? this.image(this.tex.penFront(1), 0, 0).setAlpha(0.85).setDepth(UI_DEPTH - 9) : undefined;
    // Par-dessus le fantôme : il se teinte en vert (libre) ou en rouge (occupé).
    const marker = this.add.graphics().setDepth(UI_DEPTH - 8);
    let start: { x: number; y: number };
    if (placement.mode === 'move') {
      const b = this.store.state.buildings.find((it) => it.id === placement.id)!;
      start = { x: b.x, y: b.y };
      this.setBuildingAlpha(b.id, 0.25);
    } else {
      start = this.freeSpotNearCenter(type, size);
    }
    this.placing = { placement, size, ghost, ghostFront, marker, gx: start.x, gy: start.y };
    this.gridLines.setVisible(true);
    this.moveGhost(start.x, start.y);
  }

  private stopPlacing(notify = true): void {
    const p = this.placing;
    if (!p) return;
    p.ghost.destroy();
    p.ghostFront?.destroy();
    p.marker.destroy();
    if (p.placement.mode === 'move') this.setBuildingAlpha(p.placement.id, 1);
    this.placing = undefined;
    this.gridLines.setVisible(false);
    if (notify) bus.emit('placeEnd');
  }

  private setBuildingAlpha(id: number, alpha: number): void {
    const v = this.buildingViews.get(id);
    v?.main.setAlpha(alpha);
    v?.front?.setAlpha(alpha);
  }

  private gridUnder(x: number, y: number, size: number): { gx: number; gy: number } {
    const g = toGrid(x, y);
    return { gx: Math.round(g.gx - size / 2), gy: Math.round(g.gy - size / 2) };
  }

  private ghostToPointer(p: Phaser.Input.Pointer): void {
    const world = this.cameras.main.getWorldPoint(p.x, p.y);
    const { gx, gy } = this.gridUnder(world.x, world.y, this.placing!.size);
    if (gx !== this.placing!.gx || gy !== this.placing!.gy) this.moveGhost(gx, gy);
  }

  private moveGhost(gx: number, gy: number): void {
    const p = this.placing!;
    gx = Phaser.Math.Clamp(gx, 0, MAP_SIZE - p.size);
    gy = Phaser.Math.Clamp(gy, 0, MAP_SIZE - p.size);
    p.gx = gx;
    p.gy = gy;
    const base = toWorld(gx + p.size, gy + p.size);
    p.ghost.setPosition(base.x, base.y);
    p.ghostFront?.setPosition(base.x, base.y);
    const ignore = p.placement.mode === 'move' ? p.placement.id : undefined;
    const ok = canPlace(this.store.state, p.placement.type, gx, gy, ignore);
    p.marker.clear();
    this.diamond(p.marker, gx, gy, p.size, ok ? 0x6fe05a : 0xff4a3a, 0.35, ok ? 0xc8ffb8 : 0xffc0b8);
    p.ghost.setTint(ok ? 0xffffff : 0xff9a8a);
    p.ghostFront?.setTint(ok ? 0xffffff : 0xff9a8a);
  }

  private confirmPlacing(): void {
    const p = this.placing!;
    const { placement, gx, gy } = p;
    const result =
      placement.mode === 'build'
        ? this.store.act((s) => build(s, placement.type, gx, gy))
        : this.store.act((s) => move(s, placement.id, gx, gy));
    if (!result.ok) {
      bus.emit('toast', { text: result.reason, kind: 'error' });
      return;
    }
    this.stopPlacing();
    const id = placement.mode === 'build' ? (result as { id?: number }).id : placement.id;
    if (id !== undefined) {
      // Petit « boum » de poussière à l'arrivée.
      this.puff(gx, gy, p.size);
      bus.emit('select', { kind: 'building', id });
    }
  }

  private freeSpotNearCenter(type: Placement['type'], size: number): { x: number; y: number } {
    const cam = this.cameras.main;
    const c = toGrid(cam.midPoint.x, cam.midPoint.y);
    const cx = Math.round(c.gx - size / 2);
    const cy = Math.round(c.gy - size / 2);
    for (let r = 0; r < MAP_SIZE; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (canPlace(this.store.state, type, cx + dx, cy + dy)) return { x: cx + dx, y: cy + dy };
        }
      }
    }
    return { x: cx, y: cy };
  }

  // ─── Effets ─────────────────────────────────────────────────────────────

  private puff(gx: number, gy: number, size: number): void {
    for (let i = 0; i < 10; i++) {
      const p = toWorld(gx + Math.random() * size, gy + Math.random() * size);
      const dot = this.add.circle(p.x, p.y, 6 + Math.random() * 6, 0xf3e7d0, 0.9).setDepth(UI_DEPTH - 20);
      this.tweens.add({
        targets: dot,
        y: p.y - 20 - Math.random() * 20,
        alpha: 0,
        scale: 1.8,
        duration: 600 + Math.random() * 300,
        onComplete: () => dot.destroy(),
      });
    }
  }

  private floatText(id: number, text: string, resource?: string): void {
    const v = this.buildingViews.get(id);
    if (!v) return;
    const color = resource === 'or' ? '#ffd23c' : resource === 'nourriture' ? '#ffa94d' : resource === 'gemmes' ? '#5dff8f' : '#ffffff';
    const t = this.add
      .text(v.main.x, v.top, text, { fontFamily: FONT, fontSize: '28px', color, stroke: '#2a1c12', strokeThickness: 6 })
      .setOrigin(0.5, 1)
      .setDepth(UI_DEPTH + 5);
    this.tweens.add({ targets: t, y: v.top - 60, alpha: { from: 1, to: 0 }, duration: 1300, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  update(time: number, delta: number): void {
    const dt = Math.min(delta, 100) / 1000;
    const s = this.store.state;
    const pens = new Map(s.buildings.filter((b) => b.type === 'enclos').map((b) => [b.id, b]));

    for (const view of this.animalViews.values()) {
      const pen = pens.get(view.sprite.getData('pen'));
      if (!pen) continue;
      const dx = view.tu - view.u;
      const dv = view.tv - view.v;
      const dist = Math.hypot(dx, dv);
      let moving = false;
      if (view.wait > 0) {
        view.wait -= dt;
      } else if (dist < 0.05) {
        view.tu = 0.55 + Math.random() * 2.9;
        view.tv = 0.55 + Math.random() * 2.9;
        view.wait = 1 + Math.random() * 3.5;
      } else {
        const step = Math.min(dist, 0.9 * dt);
        view.u += (dx / dist) * step;
        view.v += (dv / dist) * step;
        moving = true;
        // Vers la droite de l'écran quand u augmente plus que v.
        view.sprite.setFlipX(dx - dv < 0);
      }
      view.phase += dt * (moving ? 14 : 2);
      const hop = view.sprite.getData('hop') ? 5 : 2;
      const lift = moving ? Math.abs(Math.sin(view.phase)) * hop : 0;
      const p = toWorld(pen.x + view.u, pen.y + view.v);
      view.sprite.setPosition(p.x, p.y - lift).setDepth(p.y);
      const target = view.sprite.getData('scale') as number;
      const breathe = moving ? 1 : 1 + Math.sin(view.phase) * 0.015;
      const current = view.sprite.scaleY;
      const next = current + (target * breathe - current) * Math.min(1, dt * 8);
      view.sprite.setScale(next, next);
    }

    // Bulles qui flottent.
    for (const v of this.buildingViews.values()) {
      if (v.bubble) v.bubble.y = (v.bubble.getData('baseY') as number) + Math.sin(time / 300) * 3;
    }

    // Cœurs au-dessus des enclos où un petit est en route.
    this.heartClock += dt;
    if (this.heartClock > 0.7) {
      this.heartClock = 0;
      for (const pen of pens.values()) {
        if (!pen.breeding) continue;
        const p = toWorld(pen.x + 1 + Math.random() * 2, pen.y + 1 + Math.random() * 2);
        const heart = this.add.image(p.x, p.y - 20, this.tex.heart()).setScale(0.5 / RES).setDepth(UI_DEPTH - 30);
        this.tweens.add({ targets: heart, y: p.y - 70, alpha: 0, scale: 0.9 / RES, duration: 1600, onComplete: () => heart.destroy() });
      }
    }
  }
}

