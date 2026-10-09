/**
 * Outils de dessin en perspective isométrique sur un canvas 2D.
 *
 * Une case de la carte mesure TILE_W × TILE_H pixels du monde. Les dessins sont faits
 * à la résolution RES (×2) puis affichés à l'échelle 1/RES : ils restent nets au zoom.
 *
 * Coordonnées d'un point : (u, v) en cases depuis le coin nord de l'emprise, z en pixels
 * du monde vers le haut. Les faces visibles sont celles du sud-ouest (v = max, à gauche
 * à l'écran) et du sud-est (u = max, à droite).
 */

export const TILE_W = 64;
export const TILE_H = 32;
export const RES = 2;

export const OUTLINE = '#2a1c12';
const LINE = 2.6;

export type P3 = [number, number, number];

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w);
  canvas.height = Math.ceil(h);
  const ctx = canvas.getContext('2d')!;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  return [canvas, ctx];
}

// ─── Couleurs ───────────────────────────────────────────────────────────────

function parse(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function format([r, g, b]: number[]): string {
  return `#${[r, g, b].map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('')}`;
}

/** Assombrit (amount < 0) ou éclaircit (amount > 0) une couleur, de -1 à 1. */
export function shade(hex: string, amount: number): string {
  const rgb = parse(hex);
  return format(rgb.map((c) => (amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)));
}

export function mix(a: string, b: string, t: number): string {
  const ca = parse(a);
  const cb = parse(b);
  return format(ca.map((c, i) => c + (cb[i] - c) * t));
}

export interface FaceColors {
  top: string;
  left: string;
  right: string;
}

/** Trois teintes d'un même matériau : dessus éclairé, face gauche, face droite à l'ombre. */
export function faces(base: string): FaceColors {
  return { top: shade(base, 0.12), left: base, right: shade(base, -0.22) };
}

// ─── Canvas isométrique ─────────────────────────────────────────────────────

export interface Drawing {
  canvas: HTMLCanvasElement;
  /** Point d'ancrage (fraction du canvas) : le coin sud de l'emprise au sol. */
  originX: number;
  originY: number;
}

export class IsoCanvas {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  private readonly cx: number;
  private readonly cy: number;
  private readonly size: number;

  /**
   * @param size côté de l'emprise, en cases
   * @param height hauteur maximale du dessin au-dessus du sol (pixels du monde)
   * @param pad marge autour, pour les contours et les débords de toit (pixels du monde)
   */
  constructor(size: number, height: number, pad = 14) {
    this.size = size;
    const w = (size * TILE_W + pad * 2) * RES;
    const h = (size * TILE_H + height + pad * 2) * RES;
    [this.canvas, this.ctx] = makeCanvas(w, h);
    this.cx = w / 2;
    this.cy = (pad + height) * RES;
  }

  p(u: number, v: number, z = 0): [number, number] {
    return [this.cx + ((u - v) * TILE_W * RES) / 2, this.cy + ((u + v) * TILE_H * RES) / 2 - z * RES];
  }

  path(points: P3[]): void {
    const { ctx } = this;
    ctx.beginPath();
    points.forEach(([u, v, z], i) => {
      const [x, y] = this.p(u, v, z);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
  }

  poly(points: P3[], fill: string | CanvasGradient | null, stroke: string | null = OUTLINE, width = LINE): void {
    const { ctx } = this;
    this.path(points);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width * RES * 0.5;
      ctx.stroke();
    }
  }

  line(a: P3, b: P3, color: string, width = 1.4): void {
    const { ctx } = this;
    const [x0, y0] = this.p(...a);
    const [x1, y1] = this.p(...b);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = color;
    ctx.lineWidth = width * RES;
    ctx.stroke();
  }

  /** Pavé droit : faces droite, gauche puis dessus. */
  box(u0: number, v0: number, u1: number, v1: number, z0: number, z1: number, c: FaceColors, stroke: string | null = OUTLINE): void {
    this.poly([[u1, v0, z0], [u1, v1, z0], [u1, v1, z1], [u1, v0, z1]], c.right, stroke);
    this.poly([[u0, v1, z0], [u1, v1, z0], [u1, v1, z1], [u0, v1, z1]], c.left, stroke);
    this.poly([[u0, v0, z1], [u1, v0, z1], [u1, v1, z1], [u0, v1, z1]], c.top, stroke);
  }

  /** Rectangle posé sur la face gauche (plan v), de a0 à a1 le long de u. */
  onLeft(v: number, a0: number, a1: number, z0: number, z1: number, fill: string, stroke: string | null = OUTLINE): void {
    this.poly([[a0, v, z0], [a1, v, z0], [a1, v, z1], [a0, v, z1]], fill, stroke, 2);
  }

  /** Rectangle posé sur la face droite (plan u), de a0 à a1 le long de v. */
  onRight(u: number, a0: number, a1: number, z0: number, z1: number, fill: string, stroke: string | null = OUTLINE): void {
    this.poly([[u, a0, z0], [u, a1, z0], [u, a1, z1], [u, a0, z1]], fill, stroke, 2);
  }

  /** Lignes parallèles à l'intérieur d'un quadrilatère (tuiles, planches). */
  hatch(a0: P3, a1: P3, b0: P3, b1: P3, count: number, color: string, width = 1): void {
    for (let k = 1; k < count; k++) {
      const t = k / count;
      const lerp = (p: P3, q: P3): P3 => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
      this.line(lerp(a0, a1), lerp(b0, b1), color, width);
    }
  }

  /**
   * Toit à quatre pans au-dessus de [u0,u1] × [v0,v1], posé à la hauteur z.
   * Le faîtage suit le côté le plus long.
   */
  hipRoof(u0: number, v0: number, u1: number, v1: number, z: number, h: number, color: string, overhang = 0.25): void {
    u0 -= overhang;
    v0 -= overhang;
    u1 += overhang;
    v1 += overhang;
    const top = z + h;
    const alongU = u1 - u0 >= v1 - v0;
    const half = (alongU ? v1 - v0 : u1 - u0) / 2;
    const r0: P3 = alongU ? [u0 + half, (v0 + v1) / 2, top] : [(u0 + u1) / 2, v0 + half, top];
    const r1: P3 = alongU ? [u1 - half, (v0 + v1) / 2, top] : [(u0 + u1) / 2, v1 - half, top];
    const nw: P3 = [u0, v0, z];
    const ne: P3 = [u1, v0, z];
    const se: P3 = [u1, v1, z];
    const sw: P3 = [u0, v1, z];
    const tile = shade(color, -0.35);
    if (alongU) {
      this.poly([nw, ne, r1, r0], shade(color, 0.2));
      this.poly([nw, r0, sw], shade(color, 0.3));
      this.poly([sw, r0, r1, se], color);
      this.hatch(sw, r0, se, r1, 5, tile);
      this.poly([ne, se, r1], shade(color, -0.2));
      this.hatch(se, r1, ne, r1, 4, tile);
    } else {
      this.poly([nw, r0, r1, sw], shade(color, 0.3));
      this.poly([nw, ne, r0], shade(color, 0.2));
      this.poly([sw, r1, se], color);
      this.hatch(sw, r1, se, r1, 4, tile);
      this.poly([ne, se, r1, r0], shade(color, -0.2));
      this.hatch(se, r1, ne, r0, 5, tile);
    }
  }

  /** Toit à deux pans, faîtage le long de u, pignon visible à droite. */
  gableRoof(u0: number, v0: number, u1: number, v1: number, z: number, h: number, color: string, gable: string, overhang = 0.2): void {
    const cv = (v0 + v1) / 2;
    const top = z + h;
    const a = u0 - overhang;
    const b = u1 + overhang;
    this.poly([[a, v0 - overhang, z], [b, v0 - overhang, z], [b, cv, top], [a, cv, top]], shade(color, 0.22));
    this.poly([[u1, v0, z], [u1, v1, z], [u1, cv, top]], gable);
    this.poly([[a, v1 + overhang, z], [a, cv, top], [b, cv, top], [b, v1 + overhang, z]], color);
    this.hatch([a, v1 + overhang, z], [a, cv, top], [b, v1 + overhang, z], [b, cv, top], 4, shade(color, -0.35));
  }

  /** Disque « debout » face à la caméra (cimes d'arbres, fumée, bulles). */
  blob(u: number, v: number, z: number, r: number, fill: string, stroke: string | null = OUTLINE): void {
    const [x, y] = this.p(u, v, z);
    const { ctx } = this;
    ctx.beginPath();
    ctx.arc(x, y, r * RES, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = LINE * RES * 0.5;
      ctx.stroke();
    }
  }

  /** Ellipse couchée au sol (ombres, flaques). */
  groundEllipse(u: number, v: number, z: number, rx: number, fill: string, stroke: string | null = null): void {
    const [x, y] = this.p(u, v, z);
    const { ctx } = this;
    ctx.beginPath();
    ctx.ellipse(x, y, rx * RES, (rx * RES) / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = LINE * RES * 0.5;
      ctx.stroke();
    }
  }

  done(): Drawing {
    const [, y] = this.p(this.size, this.size, 0);
    return { canvas: this.canvas, originX: 0.5, originY: y / this.canvas.height };
  }
}

/** Petit générateur déterministe pour les détails (brins d'herbe, cailloux). */
export function seeded(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
