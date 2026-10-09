import Phaser from 'phaser';
import { ANIMAL_ORIGIN, animal } from '../art/animals.ts';
import { building, constructionSite, enclos, forestTree, obstacle, scaffold } from '../art/buildings.ts';
import type { Drawing } from '../art/canvas.ts';
import { RES, makeCanvas } from '../art/canvas.ts';
import { SPECIES, type BuildingType, type Resource, type Species } from '../game/config.ts';
import type { Coat } from '../game/genetics.ts';
import type { ObstacleKind } from '../game/state.ts';
import { iconCanvas } from '../ui/icons.ts';

/**
 * Crée les textures Phaser à la demande à partir des dessins du dossier art/,
 * et retient leur point d'ancrage.
 */
export class Textures {
  private origins = new Map<string, { x: number; y: number }>();
  private tops = new Map<string, number>();
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  private ensure(key: string, draw: () => Drawing): string {
    if (!this.scene.textures.exists(key)) {
      const d = draw();
      this.scene.textures.addCanvas(key, d.canvas);
      this.origins.set(key, { x: d.originX, y: d.originY });
      this.tops.set(key, firstOpaqueRow(d.canvas));
    }
    return key;
  }

  origin(key: string): { x: number; y: number } {
    return this.origins.get(key) ?? { x: 0.5, y: 0.5 };
  }

  /** Première ligne non transparente de la texture : le vrai haut du dessin. */
  contentTop(key: string): number {
    return this.tops.get(key) ?? 0;
  }

  building(type: BuildingType, level: number): string {
    return this.ensure(`b:${type}:${level}`, () => building(type, level));
  }

  penFront(level: number): string {
    return this.ensure(`pen-front:${level}`, () => enclos(level, 'front'));
  }

  site(size: number): string {
    return this.ensure(`site:${size}`, () => constructionSite(size));
  }

  scaffold(size: number): string {
    return this.ensure(`scaffold:${size}`, () => scaffold(size));
  }

  obstacle(kind: ObstacleKind): string {
    return this.ensure(`obs:${kind}`, () => obstacle(kind));
  }

  forest(variant: number): string {
    return this.ensure(`forest:${variant}`, () => forestTree(variant));
  }

  animal(species: Species, coat: Coat, spotted: boolean): string {
    return this.ensure(`animal:${species}:${coat}:${spotted ? 1 : 0}`, () => ({
      canvas: animal(species, SPECIES[species].coats[coat], coat, spotted),
      originX: ANIMAL_ORIGIN.x,
      originY: ANIMAL_ORIGIN.y,
    }));
  }

  /** Bulle de récolte au-dessus d'une ferme ou d'une billetterie. */
  bubble(resource: Resource): string {
    return this.ensure(`bubble:${resource}`, () => {
      const size = 30 * RES;
      const [canvas, ctx] = makeCanvas(size, size + 8 * RES);
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 2 * RES, 0, Math.PI * 2);
      ctx.moveTo(size / 2 - 5 * RES, size - 4 * RES);
      ctx.lineTo(size / 2, size + 6 * RES);
      ctx.lineTo(size / 2 + 5 * RES, size - 4 * RES);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#2a1c12';
      ctx.lineWidth = 2 * RES;
      ctx.stroke();
      ctx.drawImage(iconCanvas(resource, 20 * RES), 5 * RES, 5 * RES);
      return { canvas, originX: 0.5, originY: 1 };
    });
  }

  heart(): string {
    return this.ensure('heart', () => ({ canvas: iconCanvas('coeur', 16 * RES), originX: 0.5, originY: 0.5 }));
  }
}

function firstOpaqueRow(canvas: HTMLCanvasElement): number {
  const { width, height } = canvas;
  const data = canvas.getContext('2d')!.getImageData(0, 0, width, height).data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 40) return y;
    }
  }
  return 0;
}
