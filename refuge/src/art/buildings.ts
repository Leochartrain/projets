import type { BuildingType } from '../game/config.ts';
import type { ObstacleKind } from '../game/state.ts';
import { IsoCanvas, OUTLINE, RES, faces, seeded, shade, type Drawing, type P3 } from './canvas.ts';

/**
 * Bâtiments dessinés par le code, dans l'esprit de Clash of Clans : formes simples,
 * couleurs franches, contour sombre, toits colorés qui changent avec le niveau.
 */

const STONE = '#b8b0a2';
const WOOD = '#b57a43';
const WOOD_DARK = '#7d4f2a';
const PLASTER = '#f4e6c8';
const GLASS = '#7fc8f0';
const GOLD = '#f5c542';

/** Couleur des toits selon le niveau : rouge, rouge, bleu, violet, or. */
const ROOF_BY_LEVEL = ['#d9452b', '#e0532f', '#3d7fd9', '#8f4fc8', '#e3a21f'];

function roofColor(level: number): string {
  return ROOF_BY_LEVEL[Math.min(level, 5) - 1];
}

function window_(iso: IsoCanvas, side: 'left' | 'right', plane: number, a: number, z: number, w = 0.42, h = 11): void {
  const draw = side === 'left' ? iso.onLeft.bind(iso) : iso.onRight.bind(iso);
  draw(plane, a - 0.06, a + w + 0.06, z - 2, z + h + 2, '#fff7e6');
  draw(plane, a, a + w, z, z + h, GLASS, null);
  draw(plane, a, a + w, z + h * 0.55, z + h, shade(GLASS, 0.35), null);
}

function flag(iso: IsoCanvas, u: number, v: number, z: number, color: string): void {
  iso.line([u, v, z], [u, v, z + 26], OUTLINE, 2.2);
  iso.line([u, v, z], [u, v, z + 26], '#d8d0c0', 1.1);
  iso.poly([[u, v, z + 26], [u + 0.45, v - 0.45, z + 21], [u, v, z + 16]], color);
}

// ─── Mairie ─────────────────────────────────────────────────────────────────

function mairie(level: number): Drawing {
  const iso = new IsoCanvas(4, 150);
  const wallH = 30 + level * 5;
  iso.groundEllipse(2, 2, 0, 74, 'rgba(0,0,0,0.18)');
  // Socle de pierre.
  iso.box(0.15, 0.15, 3.85, 3.85, 0, 8, faces(STONE));
  iso.hatch([0.15, 3.85, 0], [0.15, 3.85, 8], [3.85, 3.85, 0], [3.85, 3.85, 8], 2, shade(STONE, -0.3));
  // Escalier devant la porte.
  iso.box(1.4, 3.85, 2.4, 4.1, 0, 4, faces(shade(STONE, 0.1)));
  // Murs à colombages.
  const z0 = 8;
  const z1 = z0 + wallH;
  iso.box(0.5, 0.5, 3.5, 3.5, z0, z1, faces(PLASTER));
  for (const a of [0.5, 1.25, 2.75, 3.5]) {
    iso.onLeft(3.5, a - 0.06, a + 0.06, z0, z1, WOOD_DARK, null);
    iso.onRight(3.5, a - 0.06, a + 0.06, z0, z1, shade(WOOD_DARK, -0.2), null);
  }
  iso.onLeft(3.5, 0.5, 3.5, z1 - 4, z1, WOOD_DARK, null);
  iso.onRight(3.5, 0.5, 3.5, z1 - 4, z1, shade(WOOD_DARK, -0.2), null);
  // Porte en arc.
  iso.onLeft(3.5, 1.55, 2.25, z0, z0 + 20, '#6b3d1e');
  iso.onLeft(3.5, 1.65, 2.15, z0 + 2, z0 + 17, '#8a5229', null);
  iso.blob(2.05, 3.5, z0 + 9, 1.4, GOLD, null);
  // Fenêtres : une rangée, deux à partir du niveau 3.
  const rows = level >= 3 ? [z0 + 8, z0 + 8 + (wallH - 8) / 2] : [z0 + wallH / 2 - 5];
  for (const z of rows) {
    window_(iso, 'left', 3.5, 0.72, z);
    window_(iso, 'left', 3.5, 2.5, z);
    window_(iso, 'right', 3.5, 0.85, z);
    window_(iso, 'right', 3.5, 2.3, z);
  }
  // Toit, avec des bords dorés à partir du niveau 4.
  const roofH = 30 + level * 4;
  iso.hipRoof(0.5, 0.5, 3.5, 3.5, z1, roofH, roofColor(level), 0.3);
  if (level >= 4) {
    iso.line([0.2, 3.8, z1], [3.8, 3.8, z1], GOLD, 1.6);
    iso.line([3.8, 3.8, z1], [3.8, 0.2, z1], GOLD, 1.6);
  }
  // Cheminée (niveau 2+) et drapeau.
  if (level >= 2) {
    iso.box(2.6, 1.2, 3.0, 1.6, z1 + roofH * 0.35, z1 + roofH * 0.75, faces('#c0573a'));
  }
  flag(iso, 2, 2, z1 + roofH - 2, level >= 5 ? GOLD : '#2f86e0');
  // Bannières sur la façade aux niveaux 3+.
  if (level >= 3) {
    const banner = level >= 5 ? GOLD : roofColor(level);
    iso.onRight(3.5, 1.45, 1.75, z1 - 22, z1 - 4, banner);
    iso.onRight(3.5, 2.25, 2.55, z1 - 22, z1 - 4, banner);
  }
  return iso.done();
}

// ─── Cabane de bâtisseur ────────────────────────────────────────────────────

function cabane(): Drawing {
  const iso = new IsoCanvas(2, 80);
  iso.groundEllipse(1, 1, 0, 38, 'rgba(0,0,0,0.18)');
  iso.box(0.3, 0.3, 1.7, 1.7, 0, 24, faces(WOOD));
  iso.hatch([0.3, 1.7, 0], [0.3, 1.7, 24], [1.7, 1.7, 0], [1.7, 1.7, 24], 4, shade(WOOD, -0.3));
  iso.hatch([1.7, 0.3, 0], [1.7, 0.3, 24], [1.7, 1.7, 0], [1.7, 1.7, 24], 4, shade(WOOD, -0.45));
  iso.onLeft(1.7, 0.75, 1.25, 0, 16, '#5a3418');
  iso.onRight(1.7, 0.7, 1.2, 9, 17, GLASS);
  iso.gableRoof(0.3, 0.3, 1.7, 1.7, 24, 22, '#e2a23a', shade(WOOD, -0.1));
  // Marteau accroché au mur.
  iso.line([1.7, 1.35, 6], [1.7, 1.55, 15], '#6b4426', 1.6);
  iso.onRight(1.7, 1.42, 1.68, 13, 17, '#9aa3ad');
  // Planches entassées à côté.
  iso.box(1.75, 0.4, 1.95, 1.3, 0, 4, faces('#c98f52'));
  return iso.done();
}

// ─── Ferme ──────────────────────────────────────────────────────────────────

const CROPS = [
  { leaf: '#5fb83a', fruit: '#f28a1e', tall: 6 }, // carottes
  { leaf: '#7ccf4a', fruit: '#a6e06a', tall: 7 }, // choux
  { leaf: '#6cb83a', fruit: '#f5d23c', tall: 13 }, // maïs
  { leaf: '#4f9f2c', fruit: '#f08a1c', tall: 8 }, // citrouilles
  { leaf: '#5fb83a', fruit: '#e9443a', tall: 9 }, // tomates
];

function ferme(level: number): Drawing {
  const iso = new IsoCanvas(3, 80);
  const crop = CROPS[level - 1];
  // Terre labourée.
  iso.box(0.1, 0.1, 2.9, 2.9, 0, 4, faces('#8a5a2e'));
  iso.poly([[0.1, 0.1, 4], [2.9, 0.1, 4], [2.9, 2.9, 4], [0.1, 2.9, 4]], '#9a6a3a');
  // Grange au fond, plus grande avec le niveau.
  const barnH = 18 + level * 3;
  iso.box(0.25, 0.25, 1.25, 1.15, 4, 4 + barnH, faces('#c8402e'));
  iso.onLeft(1.15, 0.5, 1.0, 4, 4 + barnH * 0.6, '#f6efe4');
  iso.line([0.5, 1.15, 4], [1.0, 1.15, 4 + barnH * 0.6], '#c8402e', 1);
  iso.line([1.0, 1.15, 4], [0.5, 1.15, 4 + barnH * 0.6], '#c8402e', 1);
  iso.gableRoof(0.25, 0.25, 1.25, 1.15, 4 + barnH, 12, '#6b4a3a', '#a8352a');
  // Sillons et cultures, du fond vers l'avant.
  const rand = seeded(level * 31);
  for (let v = 0.45; v < 2.8; v += 0.42) {
    iso.line([0.25, v, 4], [2.75, v, 4], '#7a4c24', 2.2);
    for (let u = 0.4; u < 2.75; u += 0.38) {
      if (u < 1.4 && v < 1.35) continue; // la grange
      const jitter = (rand() - 0.5) * 0.08;
      const [x, y] = iso.p(u + jitter, v, 4);
      const { ctx } = iso;
      ctx.fillStyle = crop.leaf;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = RES;
      ctx.beginPath();
      ctx.ellipse(x, y - crop.tall * RES * 0.4, 3.2 * RES, crop.tall * RES * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = crop.fruit;
      ctx.beginPath();
      ctx.arc(x + RES, y - crop.tall * RES * 0.25, 2.2 * RES, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  // Épouvantail au niveau 5.
  if (level >= 5) {
    iso.line([2.4, 2.4, 4], [2.4, 2.4, 30], '#6b4426', 1.8);
    iso.line([2.15, 2.65, 22], [2.65, 2.15, 22], '#6b4426', 1.6);
    iso.blob(2.4, 2.4, 31, 4, '#f2d38a');
    iso.blob(2.4, 2.4, 35, 3.5, '#d9452b');
  }
  return iso.done();
}

// ─── Billetterie ────────────────────────────────────────────────────────────

function billetterie(level: number): Drawing {
  const iso = new IsoCanvas(2, 120);
  const awning = level >= 5 ? GOLD : roofColor(level);
  iso.groundEllipse(1, 1, 0, 40, 'rgba(0,0,0,0.18)');
  iso.box(0.25, 0.25, 1.75, 1.75, 0, 16, faces('#f1e2c2'));
  iso.onLeft(1.75, 0.25, 1.75, 0, 4, shade(WOOD, -0.1), null);
  iso.onRight(1.75, 0.25, 1.75, 0, 4, shade(WOOD, -0.35), null);
  // Guichet vitré.
  const z0 = 16;
  const z1 = 36 + level * 2;
  iso.box(0.25, 0.25, 1.75, 1.75, z0, z1, faces(WOOD));
  iso.onLeft(1.75, 0.4, 1.6, z0 + 3, z1 - 3, '#ffe9a8');
  iso.onRight(1.75, 0.4, 1.6, z0 + 3, z1 - 3, shade('#ffe9a8', -0.15));
  iso.box(0.2, 1.65, 1.8, 2.0, z0 - 2, z0 + 1, faces('#e7d4ad'));
  // Toit de chapiteau rayé, pointu au centre.
  const o = 0.3;
  const eave = z1 - 2;
  const apex: P3 = [1, 1, z1 + 26 + level * 2];
  const corner = { nw: [0.25 - o, 0.25 - o, eave], ne: [1.75 + o, 0.25 - o, eave], se: [1.75 + o, 1.75 + o, eave], sw: [0.25 - o, 1.75 + o, eave] } as Record<string, P3>;
  const stripes = (from: P3, to: P3, light: number) => {
    const n = 4;
    for (let i = 0; i < n; i++) {
      const lerp = (t: number): P3 => [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, eave];
      const color = i % 2 ? '#ffffff' : awning;
      iso.poly([lerp(i / n), lerp((i + 1) / n), apex], shade(color, light));
    }
  };
  stripes(corner.nw, corner.ne, 0.15);
  stripes(corner.sw, corner.nw, 0.25);
  stripes(corner.sw, corner.se, 0);
  stripes(corner.se, corner.ne, -0.2);
  // Festons sous le bord du toit.
  const { ctx } = iso;
  for (const [from, to, light] of [[corner.sw, corner.se, 0], [corner.se, corner.ne, -0.2]] as [P3, P3, number][]) {
    const n = 6;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const [x, y] = iso.p(from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, eave);
      ctx.beginPath();
      ctx.arc(x, y, 4.2 * RES, 0, Math.PI);
      ctx.fillStyle = shade(i % 2 ? '#ffffff' : awning, light);
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.2 * RES;
      ctx.stroke();
    }
  }
  flag(iso, apex[0], apex[1], apex[2] - 2, level >= 5 ? GOLD : '#ffd23c');
  // Ticket accroché au guichet.
  iso.onLeft(1.75, 1.1, 1.5, z0 + 8, z0 + 14, '#ffd23c');  return iso.done();
}

// ─── Enclos ─────────────────────────────────────────────────────────────────

const FENCE_BY_LEVEL = ['#b57a43', '#a86b38', '#9fa4ab', '#f4f0e6', '#f4f0e6'];

/** L'enclos est en deux images : le fond (sol + clôture arrière) et la clôture avant. */
export function enclos(level: number, part: 'back' | 'front'): Drawing {
  const iso = new IsoCanvas(4, 40);
  const s = 4;
  const fence = FENCE_BY_LEVEL[level - 1];
  const post = level >= 3 ? '#8d939b' : '#7d4f2a';
  const tip = level >= 5 ? GOLD : shade(post, 0.2);
  const step = level >= 2 ? 0.5 : 1;

  if (part === 'back') {
    // Sol de l'enclos : herbe plus claire et tapis de foin.
    iso.poly([[0, 0, 0], [s, 0, 0], [s, s, 0], [0, s, 0]], '#9fd45a', null);
    const rand = seeded(level * 17);
    for (let i = 0; i < 26; i++) {
      iso.groundEllipse(0.3 + rand() * 3.4, 0.3 + rand() * 3.4, 0, 2 + rand() * 3, 'rgba(70,120,30,0.25)');
    }
    iso.groundEllipse(0.9, 0.9, 0, 18, '#e9c766', '#b8902e');
    // Abreuvoir.
    iso.box(2.6, 0.3, 3.5, 0.65, 0, 6, faces('#8d939b'));
    iso.poly([[2.7, 0.4, 6], [3.4, 0.4, 6], [3.4, 0.55, 6], [2.7, 0.55, 6]], '#5ab0e8', null);
  }

  const posts: [number, number][] = [];
  const rails: [[number, number], [number, number]][] = [];
  const edge = (from: [number, number], to: [number, number]) => {
    const n = Math.round(Math.hypot(to[0] - from[0], to[1] - from[1]) / step);
    for (let i = 0; i <= n; i++) {
      posts.push([from[0] + ((to[0] - from[0]) * i) / n, from[1] + ((to[1] - from[1]) * i) / n]);
    }
    rails.push([from, to]);
  };
  if (part === 'back') {
    edge([0, s], [0, 0]);
    edge([0, 0], [s, 0]);
  } else {
    edge([0, s], [s, s]);
    edge([s, 0], [s, s]);
  }
  const railColor = shade(fence, -0.05);
  for (const [[u0, v0], [u1, v1]] of rails) {
    for (const z of [5, 11]) {
      iso.line([u0, v0, z], [u1, v1, z], OUTLINE, 3.2);
      iso.line([u0, v0, z], [u1, v1, z], railColor, 2);
    }
  }
  for (const [u, v] of posts) {
    iso.box(u - 0.06, v - 0.06, u + 0.06, v + 0.06, 0, 15, faces(post));
    iso.poly([[u - 0.06, v - 0.06, 15], [u + 0.06, v - 0.06, 15], [u + 0.06, v + 0.06, 15], [u - 0.06, v + 0.06, 15]], tip, OUTLINE, 1.5);
  }
  return iso.done();
}

// ─── Décorations ────────────────────────────────────────────────────────────

function fleurs(): Drawing {
  const iso = new IsoCanvas(1, 24);
  iso.box(0.1, 0.1, 0.9, 0.9, 0, 3, faces('#7a4c24'));
  const rand = seeded(4);
  const colors = ['#ff6b8a', '#ffd23f', '#ffffff', '#b07cff', '#ff8c42'];
  for (let i = 0; i < 9; i++) {
    const u = 0.22 + rand() * 0.56;
    const v = 0.22 + rand() * 0.56;
    iso.line([u, v, 3], [u, v, 9], '#3f8f2a', 1.2);
    iso.blob(u, v, 10, 2.6, colors[i % colors.length]);
    iso.blob(u, v, 10, 0.9, '#ffe680', null);
  }
  return iso.done();
}

function tree(iso: IsoCanvas, u: number, v: number, scale: number, color: string): void {
  iso.groundEllipse(u, v, 0, 14 * scale, 'rgba(0,0,0,0.2)');
  iso.box(u - 0.08 * scale, v - 0.08 * scale, u + 0.08 * scale, v + 0.08 * scale, 0, 14 * scale, faces('#8a5a32'));
  iso.blob(u, v, 26 * scale, 14 * scale, shade(color, -0.15));
  iso.blob(u - 0.18 * scale, v + 0.18 * scale, 30 * scale, 10 * scale, color);
  iso.blob(u + 0.2 * scale, v - 0.05 * scale, 33 * scale, 9 * scale, shade(color, 0.1));
  iso.blob(u - 0.05 * scale, v + 0.05 * scale, 38 * scale, 4 * scale, shade(color, 0.35), null);
}

function arbre(): Drawing {
  const iso = new IsoCanvas(1, 60);
  tree(iso, 0.5, 0.5, 1, '#4fae3c');
  return iso.done();
}

function fontaine(): Drawing {
  const iso = new IsoCanvas(2, 60);
  iso.groundEllipse(1, 1, 0, 40, 'rgba(0,0,0,0.18)');
  iso.box(0.15, 0.15, 1.85, 1.85, 0, 9, faces('#c9c2b4'));
  iso.poly([[0.3, 0.3, 9], [1.7, 0.3, 9], [1.7, 1.7, 9], [0.3, 1.7, 9]], '#4aa8e8');
  iso.groundEllipse(1, 1, 9, 16, '#7cc8f5', null);
  iso.box(0.85, 0.85, 1.15, 1.15, 9, 26, faces('#d8d1c4'));
  iso.box(0.65, 0.65, 1.35, 1.35, 26, 29, faces('#c9c2b4'));
  // Jets d'eau.
  for (const [du, dv] of [[-0.35, 0], [0.35, 0], [0, -0.35], [0, 0.35]]) {
    iso.line([1, 1, 32], [1 + du, 1 + dv, 12], '#bfe6ff', 1.6);
  }
  iso.blob(1, 1, 34, 4, '#dff3ff', '#6ab8e8');
  return iso.done();
}

// ─── Obstacles et forêt ─────────────────────────────────────────────────────

function sapin(iso: IsoCanvas, u: number, v: number, scale: number, color = '#2f7d3a'): void {
  iso.groundEllipse(u, v, 0, 12 * scale, 'rgba(0,0,0,0.22)');
  iso.box(u - 0.06 * scale, v - 0.06 * scale, u + 0.06 * scale, v + 0.06 * scale, 0, 8 * scale, faces('#7a4a2a'));
  const [x, y] = iso.p(u, v, 0);
  const { ctx } = iso;
  const layers = [
    { w: 15, y0: 8, y1: 30 },
    { w: 12, y0: 20, y1: 40 },
    { w: 8, y0: 31, y1: 50 },
  ];
  layers.forEach((l, i) => {
    const w = l.w * scale * RES;
    const base = y - l.y0 * scale * RES;
    const top = y - l.y1 * scale * RES;
    ctx.beginPath();
    ctx.moveTo(x - w, base);
    ctx.quadraticCurveTo(x, base + 4 * RES * scale, x + w, base);
    ctx.lineTo(x, top);
    ctx.closePath();
    ctx.fillStyle = shade(color, i * 0.08);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.3 * RES;
    ctx.stroke();
    // Côté droit à l'ombre.
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x + w, base);
    ctx.quadraticCurveTo(x + w / 2, base + 2 * RES * scale, x, base + 2 * RES * scale);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fill();
  });
}

function buisson(iso: IsoCanvas): void {
  iso.groundEllipse(0.5, 0.5, 0, 16, 'rgba(0,0,0,0.2)');
  const c = '#4c9a34';
  iso.blob(0.35, 0.6, 7, 8, shade(c, -0.1));
  iso.blob(0.65, 0.4, 8, 8, shade(c, -0.05));
  iso.blob(0.5, 0.5, 12, 9, c);
  iso.blob(0.45, 0.55, 15, 3, shade(c, 0.35), null);
  iso.blob(0.62, 0.52, 9, 1.6, '#e8423a', null);
  iso.blob(0.38, 0.45, 11, 1.6, '#e8423a', null);
}

function rocher(iso: IsoCanvas): void {
  iso.groundEllipse(1, 1, 0, 36, 'rgba(0,0,0,0.2)');
  const rock = (u: number, v: number, r: number, h: number) => {
    const c = '#9a958c';
    iso.poly(
      [[u - r, v, 0], [u, v + r, 0], [u + r, v, 0], [u + r * 0.6, v - r * 0.4, h * 0.7], [u, v - r * 0.2, h], [u - r * 0.6, v + r * 0.1, h * 0.8]],
      c,
    );
    iso.poly([[u, v + r, 0], [u + r, v, 0], [u + r * 0.6, v - r * 0.4, h * 0.7], [u, v - r * 0.2, h]], shade(c, -0.2));
    iso.poly([[u - r * 0.6, v + r * 0.1, h * 0.8], [u, v - r * 0.2, h], [u - r * 0.1, v + r * 0.3, h * 0.75]], shade(c, 0.25), null);
  };
  rock(0.8, 0.8, 0.7, 26);
  rock(1.4, 1.3, 0.45, 16);
  rock(0.6, 1.5, 0.35, 11);
  return;
}

export function obstacle(kind: ObstacleKind): Drawing {
  if (kind === 'rocher') {
    const iso = new IsoCanvas(2, 40);
    rocher(iso);
    return iso.done();
  }
  const iso = new IsoCanvas(1, kind === 'sapin' ? 60 : 30);
  if (kind === 'sapin') sapin(iso, 0.5, 0.5, 1);
  else buisson(iso);
  return iso.done();
}

/** Arbres de la forêt autour de la carte. */
export function forestTree(variant: number): Drawing {
  const iso = new IsoCanvas(1, 70, 18);
  if (variant % 3 === 2) tree(iso, 0.5, 0.5, 1.15, '#3f9a34');
  else sapin(iso, 0.5, 0.5, 1.2 + (variant % 2) * 0.15, variant % 2 ? '#2a6f34' : '#327a38');
  return iso.done();
}

// ─── Chantiers ──────────────────────────────────────────────────────────────

/** Terrain d'un bâtiment en construction : terre, planches, caisses. */
export function constructionSite(size: number): Drawing {
  const iso = new IsoCanvas(size, 30);
  iso.box(0.1, 0.1, size - 0.1, size - 0.1, 0, 3, faces('#a8773f'));
  const rand = seeded(size * 7);
  for (let i = 0; i < size * 2; i++) {
    const u = 0.4 + rand() * (size - 0.9);
    const v = 0.4 + rand() * (size - 0.9);
    iso.box(u, v, u + 0.35, v + 0.35, 3, 11, faces('#c9924e'));
    iso.line([u, v + 0.35, 3], [u + 0.35, v + 0.35, 11], shade('#c9924e', -0.4), 0.8);
  }
  return iso.done();
}

/** Échafaudage posé par-dessus un bâtiment en chantier. */
export function scaffold(size: number): Drawing {
  const iso = new IsoCanvas(size, 50);
  const h = 22 + size * 6;
  const pole = '#c08a4a';
  const front: [number, number][] = [[0.15, size - 0.15], [size - 0.15, size - 0.15], [size - 0.15, 0.15]];
  for (const [u, v] of front) {
    iso.box(u - 0.05, v - 0.05, u + 0.05, v + 0.05, 0, h, faces(pole));
  }
  const [a, b, c] = front;
  for (const z of [h * 0.45, h]) {
    iso.line([a[0], a[1], z], [b[0], b[1], z], OUTLINE, 3);
    iso.line([a[0], a[1], z], [b[0], b[1], z], pole, 1.8);
    iso.line([b[0], b[1], z], [c[0], c[1], z], OUTLINE, 3);
    iso.line([b[0], b[1], z], [c[0], c[1], z], pole, 1.8);
  }
  iso.line([a[0], a[1], 0], [b[0], b[1], h * 0.45], shade(pole, -0.2), 1.2);
  iso.line([b[0], b[1], 0], [c[0], c[1], h * 0.45], shade(pole, -0.3), 1.2);
  return iso.done();
}

// ─── Point d'entrée ─────────────────────────────────────────────────────────

/** Dessin d'un bâtiment à un niveau donné (l'enclos renvoie sa partie arrière). */
export function building(type: BuildingType, level: number): Drawing {
  const lvl = Math.max(1, level);
  switch (type) {
    case 'mairie':
      return mairie(lvl);
    case 'cabane':
      return cabane();
    case 'ferme':
      return ferme(lvl);
    case 'billetterie':
      return billetterie(lvl);
    case 'enclos':
      return enclos(lvl, 'back');
    case 'fleurs':
      return fleurs();
    case 'arbre':
      return arbre();
    case 'fontaine':
      return fontaine();
  }
}

/** Vignette pour l'interface : l'enclos complet (fond + clôture avant). */
export function thumbnail(type: BuildingType, level: number): HTMLCanvasElement {
  const main = building(type, level).canvas;
  if (type !== 'enclos') return main;
  const front = enclos(Math.max(1, level), 'front').canvas;
  main.getContext('2d')!.drawImage(front, 0, 0);
  return main;
}
