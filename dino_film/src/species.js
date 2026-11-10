// Les trois espèces : grand théropode (type tyrannosaure), cératopsien, sauropode.
// Coordonnées du modèle : X vers l'avant, Y vers le haut, Z latéral, en mètres.
import * as THREE from 'three';
import { Creature } from './creature.js';
import { fbm, smooth, lerp } from './util.js';

const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const M4 = (x, y, z, ry = 0, rz = 0) => new THREE.Matrix4().makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeRotationY(ry)).multiply(new THREE.Matrix4().makeRotationZ(rz));
const K = (x, y, w, hu, hd, o = {}) => ({ x, y, w, hu, hd, ...o });
// Largeur et bords du profil à une abscisse donnée (pour planter les dents sur la ligne des lèvres).
function at(keys, x) {
  for (let i = 0; i < keys.length - 1; i++) if (x >= keys[i].x && x <= keys[i + 1].x) {
    const t = (x - keys[i].x) / (keys[i + 1].x - keys[i].x), a = keys[i], b = keys[i + 1];
    return { y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), hu: lerp(a.hu, b.hu, t), hd: lerp(a.hd, b.hd, t) };
  }
  return keys[keys.length - 1];
}
function tooth(c, bone, x, y, z, len, r, dirDown, lean, col) {
  const m = M4(x, y, z, 0, dirDown ? -Math.PI / 2 - lean : Math.PI / 2 + lean);
  for (const mirror of [false, true]) c.loft([
    K(-len * 0.15, 0, r, r, r, { ker: 1 }), K(len * 0.3, 0, r * 0.85, r * 0.85, r * 0.85, { ker: 1 }),
    K(len * 0.75, len * 0.04, r * 0.45, r * 0.45, r * 0.45, { ker: 1 }), K(len, len * 0.1, 0.002, 0.002, 0.002, { ker: 1 }),
  ], { sub: 2, radial: 7, matrix: m, mirror, weights: () => [[c.bi(bone), 1]], color: (P, d, s) => (s.x < len * 0.25 ? [0.2, 0.13, 0.08] : col) });
}
const breathW = (bi, x0, wd, amt) => (s, W) => { const b = Math.exp(-Math.pow((s.x - x0) / wd, 2)) * amt; return b > 0.02 ? [...W.map(([i, w]) => [i, w * (1 - b)]), [bi, b]] : W; };

// ---------- Grand théropode
export function makeRex(scale = 1) {
  const c = new Creature('rex', scale);
  const back = [0.085, 0.066, 0.046], belly = [0.27, 0.22, 0.155], claw = [0.022, 0.02, 0.018];
  const col = (P, d, s) => {
    if (s.ker > 0.5) return claw;
    let k = mix3(belly, back, smooth(-0.6, 0.4, d));
    const st = Math.sin(P.x * 4.4 + fbm(P.x * 0.9, P.y * 0.9 + P.z, 3, 7) * 6.0);
    k = k.map((v) => v * (1 - 0.5 * smooth(0.1, 0.8, st) * smooth(-0.2, 0.7, d)));
    if (P.x > 4.3 && P.y > 4.6) k = mix3(k, [0.14, 0.055, 0.035], 0.4 * smooth(4.3, 4.6, P.x) * smooth(5.8, 5.0, P.x)); // face
    return k;
  };
  c.bone('hips', null, 0, 3.3);
  const tail = [[-0.9, 3.26], [-2.0, 3.2], [-3.1, 3.15], [-4.2, 3.1], [-5.3, 3.05], [-6.2, 3.02]];
  tail.forEach(([x, y], i) => c.bone('tail' + i, i ? 'tail' + (i - 1) : 'hips', x, y));
  c.bone('spine1', 'hips', 0.9, 3.35); c.bone('chest', 'spine1', 1.9, 3.38);
  c.bone('neck1', 'chest', 2.8, 3.56); c.bone('neck2', 'neck1', 3.3, 3.95); c.bone('neck3', 'neck2', 3.72, 4.3);
  c.bone('head', 'neck3', 4.1, 4.6); c.bone('jaw', 'head', 4.22, 4.24);
  c.bone('breath', 'chest', 1.3, 3.3);
  c.setAxis(tail.map((_, i) => 'tail' + i), 'hips', ['spine1', 'chest', 'neck1', 'neck2', 'neck3', 'head']);
  c.spine = [c.B.spine1, c.B.chest]; c.neck = [c.B.neck1, c.B.neck2, c.B.neck3]; c.head = c.B.head; c.jaw = c.B.jaw; c.breath = c.B.breath;
  c.jawMax = 0.78; c.stand = 2.98; c.tailDroop = 0.0;

  const body = [
    K(-7.25, 3.0, 0.01, 0.01, 0.01), K(-6.3, 3.02, 0.08, 0.1, 0.09), K(-5.0, 3.05, 0.18, 0.24, 0.22), K(-3.8, 3.1, 0.3, 0.4, 0.38),
    K(-2.6, 3.15, 0.46, 0.56, 0.6), K(-1.5, 3.2, 0.66, 0.74, 0.84), K(-0.6, 3.26, 0.86, 0.9, 1.04), K(0.3, 3.3, 0.98, 0.95, 1.2),
    K(1.2, 3.32, 1.0, 0.92, 1.24), K(2.0, 3.38, 0.9, 0.86, 1.12), K(2.7, 3.56, 0.7, 0.72, 0.9), K(3.25, 3.95, 0.56, 0.58, 0.68),
    K(3.7, 4.32, 0.5, 0.5, 0.56), K(4.1, 4.6, 0.52, 0.47, 0.42, { sq: 2.4 }), K(4.45, 4.66, 0.53, 0.46, 0.36, { sq: 2.9 }),
    K(4.8, 4.64, 0.44, 0.4, 0.31, { sq: 2.9 }), K(5.15, 4.6, 0.36, 0.36, 0.29, { sq: 2.7 }), K(5.5, 4.54, 0.32, 0.31, 0.27, { sq: 2.6 }),
    K(5.8, 4.47, 0.26, 0.24, 0.21, { sq: 2.3 }), K(5.95, 4.4, 0.02, 0.02, 0.02),
  ];
  c.loft(body, {
    sub: 8, radial: 40,
    color: (P, d, s) => { const k = col(P, d, s); return (s.x > 4.45 && d < -0.9) ? [...k, 1] : k; },
    extraW: breathW(c.bi('breath'), 1.1, 0.9, 0.55),
    bumps: [
      { p: [4.48, 5.04, 0.33], r: 0.14, h: 0.085 }, { p: [4.5, 4.83, 0.54], r: 0.09, h: -0.055 }, // arcade sourcilière, orbite
      { p: [5.74, 4.66, 0.2], r: 0.05, h: -0.035 }, { p: [5.1, 4.99, 0.0], r: 0.17, h: 0.04, sym: false }, { p: [5.45, 4.88, 0.0], r: 0.13, h: 0.035, sym: false },
      { p: [4.25, 4.46, 0.53], r: 0.22, h: 0.07 }, { p: [4.85, 4.48, 0.44], r: 0.11, h: -0.025 }, { p: [4.15, 5.0, 0.3], r: 0.16, h: 0.04 },
      { p: [-0.1, 4.18, 0.55], r: 0.55, h: 0.08 }, { p: [1.9, 4.16, 0.5], r: 0.45, h: 0.06 }, { p: [2.2, 2.9, 0.8], r: 0.45, h: 0.08 },
      { p: [3.0, 3.2, 0.0], r: 0.35, h: 0.08, sym: false }, { p: [3.6, 3.75, 0.0], r: 0.28, h: 0.07, sym: false }, { p: [0.9, 3.0, 1.0], r: 0.7, h: 0.05 },
    ],
  });
  const jaw = [K(3.9, 4.2, 0.34, 0.1, 0.16), K(4.3, 4.16, 0.45, 0.14, 0.27, { sq: 2.5 }), K(4.85, 4.14, 0.36, 0.15, 0.23, { sq: 2.5 }),
    K(5.3, 4.13, 0.3, 0.14, 0.2, { sq: 2.4 }), K(5.65, 4.14, 0.23, 0.11, 0.15), K(5.86, 4.17, 0.015, 0.015, 0.015)];
  const jb = c.bi('jaw'), hb = c.bi('head');
  c.loft(jaw, { sub: 6, radial: 24, weights: (s) => { const w = smooth(3.95, 4.4, s.x); return [[jb, w], [hb, 1 - w]]; }, color: (P, d, s) => { const k = col(P, d * 0.5 - 0.5, s); return (s.x > 4.45 && d > 0.88) ? [...k, 1] : k; } });
  c.loft([K(4.4, 4.24, 0.1, 0.03, 0.03), K(4.8, 4.29, 0.17, 0.05, 0.04), K(5.25, 4.28, 0.14, 0.045, 0.04), K(5.6, 4.26, 0.03, 0.02, 0.02)],
    { sub: 4, radial: 12, weights: () => [[jb, 1]], color: () => [0.3, 0.09, 0.08, 1] });
  // Commissures des lèvres : la peau s'étire quand la gueule s'ouvre.
  for (const s of [1, -1]) {
    c.tri([[4.22, 4.27, 0.47 * s], [4.95, 4.34, 0.36 * s], [4.95, 4.27, 0.3 * s]], ['head', 'head', 'jaw'], [0.07, 0.03, 0.025], [0, 0, 0.6]);
    c.tri([[4.22, 4.27, 0.47 * s], [4.22, 4.2, 0.4 * s], [4.95, 4.27, 0.3 * s]], ['head', 'jaw', 'jaw'], [0.07, 0.03, 0.025], [0, 0, 0.6]);
  }
  // Dents : longueurs et inclinaisons irrégulières.
  const ivory = [0.5, 0.44, 0.3];
  for (let i = 0; i < 15; i++) {
    const x = 4.76 + i * 0.076 + (i % 2) * 0.014, a = at(body, x), len = 0.1 + 0.085 * Math.sin((i / 14) * Math.PI) + ((i * 7) % 4) * 0.014;
    tooth(c, 'head', x, a.y - a.hd + 0.035, a.w * 0.87, len, 0.027, true, 0.12 + ((i * 5) % 3) * 0.04, ivory);
  }
  for (let i = 0; i < 13; i++) {
    const x = 4.8 + i * 0.077, a = at(jaw, x), len = 0.07 + 0.045 * Math.sin((i / 12) * Math.PI) + (i % 2) * 0.014;
    tooth(c, 'jaw', x, a.y + a.hu - 0.03, a.w * 0.8, len, 0.021, false, 0.1, ivory);
  }
  for (let i = 0; i < 3; i++) tooth(c, 'head', 5.87, 4.3, 0.04 + i * 0.07, 0.1, 0.021, true, 0.3, ivory);
  // Petits bras.
  for (const mirror of [false, true]) {
    c.loft([K(2.45, 2.75, 0.11, 0.11, 0.11), K(2.58, 2.5, 0.085, 0.085, 0.085), K(2.76, 2.4, 0.06, 0.06, 0.06), K(2.9, 2.3, 0.04, 0.04, 0.04), K(2.96, 2.22, 0.025, 0.025, 0.025, { ker: 1 }), K(2.97, 2.14, 0.003, 0.003, 0.003, { ker: 1 })],
      { sub: 4, radial: 10, z0: 0.74, mirror, weights: () => [[c.bi('chest'), 1]], color: col });
  }
  const legProf = [[-0.45, 0.5, 0.48, 0.28], [-0.05, 0.74, 0.64, 0.42], [0.45, 0.7, 0.58, 0.43], [0.9, 0.52, 0.42, 0.35], [1.25, 0.37, 0.31, 0.29],
    [1.6, 0.3, 0.37, 0.27], [2.1, 0.2, 0.24, 0.18], [2.6, 0.16, 0.175, 0.15], [2.95, 0.125, 0.13, 0.13], [3.2, 0.13, 0.125, 0.16], [3.33, 0.16, 0.18, 0.22], [3.4, 0.05, 0.05, 0.08]];
  for (const [side, key] of [[1, 'hl'], [-1, 'hr']]) c.leg({
    name: key, key, parent: 'hips', hip: [0.05, 3.25, 0.6], side, L: [1.25, 1.35, 0.75], ball: 0.15, knee: 1, prof: legProf, th3: [0.22, 0.95, 1.25], track: 0.5,
    toes: { n: 3, len: 0.74, r: 0.115, splay: 0.5, claw: 0.24, x: 0.02 }, color: (P, d, s) => (s.ker > 0.5 ? claw : mix3(belly, back, 0.75).map((v) => v * (0.85 + 0.3 * fbm(P.y * 3, P.x * 3, 2, 3)))),
  });
  c.eye('head', 4.5, 4.84, 0.462, 0.068, [0.35, 0.05, 1], ['0.75', '0.42', '0.08']);
  c.point('snout', 'head', 5.85, 4.32); c.point('nostril', 'head', 5.82, 4.68); c.point('mouth', 'head', 5.45, 4.22);
  c.gaits = {
    walk: { S: 3.7, beta: 0.62, lift: 0.55, sway: 0.11, bob: 0.07, roll: 0.035, yaw: 0.07, pitch: 0.018, pitchPh: 0.6, tailYaw: 0.1, tailBob: 0.02, headBob: 0.05, ph: { hl: 0, hr: 0.5 }, trackK: 1 },
    run: { S: 6.4, beta: 0.44, lift: 0.95, sway: 0.07, bob: 0.14, roll: 0.05, yaw: 0.09, pitch: 0.035, pitchPh: 0.6, tailYaw: 0.14, tailBob: 0.04, headBob: 0.08, ph: { hl: 0, hr: 0.5 }, trackK: 0.8 },
  };
  return c.finish({ scaleF: 24, wrinkF: 2.6 });
}

// ---------- Cératopsien (age 0 = jeune, 1 = adulte)
export function makeCera(scale = 1, age = 0, seed = 0) {
  const c = new Creature('cera' + seed, scale);
  const back = [0.17, 0.115, 0.06], belly = [0.36, 0.29, 0.18], horn = [0.2, 0.17, 0.12], beak = [0.1, 0.08, 0.05];
  const col = (P, d, s) => {
    if (s.ker > 0.5) return P.x > 2.75 && P.y < 1.15 ? beak : horn;
    let k = mix3(belly, back, smooth(-0.55, 0.5, d));
    const sp = fbm(P.x * 2.2 + seed, P.y * 2.2 + P.z * 1.5, 3, 13);
    return k.map((v) => v * (0.72 + 0.6 * sp));
  };
  c.bone('hips', null, 0, 1.25);
  const tail = [[-0.4, 1.2], [-0.85, 1.05], [-1.25, 0.88]];
  tail.forEach(([x, y], i) => c.bone('tail' + i, i ? 'tail' + (i - 1) : 'hips', x, y));
  c.bone('spine1', 'hips', 0.6, 1.32); c.bone('chest', 'spine1', 1.3, 1.28);
  c.bone('neck1', 'chest', 1.75, 1.22); c.bone('neck2', 'neck1', 2.0, 1.2);
  c.bone('head', 'neck2', 2.2, 1.18); c.bone('jaw', 'head', 2.3, 0.99); c.bone('breath', 'chest', 0.7, 1.2);
  c.setAxis(tail.map((_, i) => 'tail' + i), 'hips', ['spine1', 'chest', 'neck1', 'neck2', 'head']);
  c.spine = [c.B.spine1, c.B.chest]; c.neck = [c.B.neck1, c.B.neck2]; c.head = c.B.head; c.jaw = c.B.jaw; c.breath = c.B.breath;
  c.jawMax = 0.5; c.stand = 1.17; c.tailDroop = 0.1;
  const body = [
    K(-1.6, 0.66, 0.01, 0.01, 0.01), K(-1.3, 0.82, 0.045, 0.055, 0.055), K(-0.9, 1.0, 0.1, 0.12, 0.13), K(-0.45, 1.16, 0.24, 0.25, 0.3),
    K(0, 1.25, 0.46, 0.38, 0.52), K(0.6, 1.3, 0.56, 0.4, 0.66), K(1.2, 1.27, 0.52, 0.38, 0.6), K(1.6, 1.22, 0.38, 0.33, 0.44),
    K(1.9, 1.2, 0.3, 0.3, 0.33), K(2.2, 1.18, 0.3, 0.3, 0.3), K(2.5, 1.15, 0.31, 0.28, 0.22, { sq: 2.6 }), K(2.8, 1.07, 0.22, 0.24, 0.17, { sq: 2.4 }),
    K(3.02, 0.98, 0.14, 0.18, 0.12, { ker: 0.6 }), K(3.16, 0.88, 0.06, 0.09, 0.06, { ker: 1 }), K(3.22, 0.8, 0.008, 0.01, 0.01, { ker: 1 }),
  ];
  c.loft(body, {
    sub: 8, radial: 34, color: (P, d, s) => { const k = col(P, d, s); return (s.x > 2.45 && s.x < 2.95 && d < -0.93) ? [...k, 1] : k; },
    extraW: breathW(c.bi('breath'), 0.65, 0.55, 0.5),
    bumps: [{ p: [2.52, 1.36, 0.2], r: 0.09, h: 0.05 }, { p: [2.56, 1.24, 0.31], r: 0.055, h: -0.03 }, { p: [2.4, 0.99, 0.33], r: 0.1, h: 0.09 },
      { p: [0, 1.62, 0.32], r: 0.32, h: 0.05 }, { p: [1.3, 1.6, 0.34], r: 0.3, h: 0.05 }, { p: [1.35, 1.0, 0.5], r: 0.3, h: 0.05 }, { p: [0.05, 1.0, 0.45], r: 0.35, h: 0.06 }],
  });
  const jaw = [K(2.1, 0.97, 0.22, 0.08, 0.1), K(2.45, 0.89, 0.23, 0.07, 0.13), K(2.8, 0.86, 0.15, 0.06, 0.1), K(3.02, 0.85, 0.08, 0.045, 0.05, { ker: 0.8 }), K(3.12, 0.86, 0.008, 0.01, 0.01, { ker: 1 })];
  const jb = c.bi('jaw'), hb = c.bi('head');
  c.loft(jaw, { sub: 5, radial: 18, weights: (s) => { const w = smooth(2.15, 2.42, s.x); return [[jb, w], [hb, 1 - w]]; }, color: (P, d, s) => { const k = col(P, -0.6, s); return (s.x > 2.45 && d > 0.93) ? [...k, 1] : k; } });
  // Collerette : large bouclier couché sur la nuque, fin et vascularisé (il s'illumine à contre-jour).
  const fr = 0.82 + age * 0.5;
  // (l'axe part vers l'arrière : « hd » est donc le côté haut de la section)
  c.loft([K(2.56, 1.2, 0.26, 0.1, 0.2, { sq: 2.3 }), K(2.36, 1.26, 0.4 * fr, 0.12, 0.34 * fr, { sq: 2.4, thin: 0.15 }), K(2.12, 1.33, 0.6 * fr, 0.13, 0.56 * fr, { sq: 2.5, thin: 0.4 }),
    K(1.9, 1.4, 0.78 * fr, 0.14, 0.76 * fr, { sq: 2.6, thin: 0.75 }), K(1.78, 1.44, 0.84 * fr, 0.13, 0.84 * fr, { sq: 2.6, thin: 1 }), K(1.74, 1.45, 0.7 * fr, 0.1, 0.72 * fr, { sq: 2.6, thin: 1 }),
    K(1.735, 1.45, 0.3 * fr, 0.05, 0.3 * fr, { thin: 0.6 }), K(1.73, 1.45, 0.02, 0.01, 0.02)],
  { sub: 6, radial: 40, weights: () => [[hb, 1]], color: (P, d, s) => {
    const rr = Math.hypot(P.z, P.y - 1.4) / (0.84 * fr), ang = Math.atan2(Math.abs(P.z), P.y - 1.3);
    const spot = smooth(0.2, 0.1, Math.hypot(ang - 0.75, (rr - 0.62) * 1.4)), edge = smooth(0.8, 0.98, rr);
    const base = P.x < 1.76 ? [0.12, 0.08, 0.05] : mix3(back, [0.21, 0.085, 0.04], 0.5 * smooth(2.4, 1.9, P.x));
    return mix3(mix3(base, [0.04, 0.028, 0.02], spot * 0.8), [0.3, 0.22, 0.13], edge * 0.45).map((v) => v * (0.8 + 0.4 * fbm(P.z * 5, P.y * 5, 2, 17)));
  } });
  // Cornes.
  const hl = 0.22 + age * 0.68;
  for (const mirror of [false, true]) c.loft([K(-0.04, 0, 0.065, 0.065, 0.065, { ker: 0.3 }), K(hl * 0.3, 0.0, 0.055, 0.055, 0.055, { ker: 1 }), K(hl * 0.7, hl * 0.06, 0.034, 0.034, 0.034, { ker: 1 }), K(hl, hl * 0.16, 0.003, 0.003, 0.003, { ker: 1 })],
    { sub: 4, radial: 10, matrix: M4(2.5, 1.37, 0.19, -0.22, 0.8), mirror, weights: () => [[hb, 1]], color: () => horn });
  c.loft([K(-0.03, 0, 0.055, 0.055, 0.055, { ker: 0.3 }), K(0.07 + age * 0.08, 0, 0.04, 0.04, 0.04, { ker: 1 }), K(0.15 + age * 0.14, 0.01, 0.003, 0.003, 0.003, { ker: 1 })],
    { sub: 3, radial: 10, matrix: M4(2.95, 1.17, 0, 0, 1.05), weights: () => [[hb, 1]], color: () => horn });
  const hind = [[-0.25, 0.18, 0.18, 0.1], [0, 0.29, 0.29, 0.2], [0.3, 0.26, 0.24, 0.2], [0.55, 0.17, 0.16, 0.16], [0.8, 0.13, 0.15, 0.125], [1.05, 0.105, 0.105, 0.105], [1.2, 0.115, 0.11, 0.12], [1.26, 0.125, 0.115, 0.135], [1.3, 0.04, 0.04, 0.05]];
  const fore = [[-0.2, 0.14, 0.14, 0.09], [0, 0.21, 0.21, 0.16], [0.25, 0.18, 0.18, 0.155], [0.45, 0.13, 0.14, 0.125], [0.7, 0.105, 0.115, 0.105], [0.87, 0.095, 0.095, 0.095], [0.98, 0.105, 0.1, 0.115], [1.03, 0.04, 0.04, 0.05]];
  const lc = (P, d, s) => (s.ker > 0.5 ? horn : mix3(belly, back, 0.6).map((v) => v * (0.8 + 0.4 * fbm(P.y * 6, P.x * 6 + seed, 2, 5))));
  for (const [side, key] of [[1, 'hl'], [-1, 'hr']]) c.leg({ name: key, key, parent: 'hips', hip: [0, 1.2, 0.33], side, L: [0.55, 0.5, 0.2], ball: 0.06, knee: 1, prof: hind, th3: [0.1, 0.55, 0.75], track: 0.33, toes: { n: 3, len: 0.13, r: 0.055, splay: 0.6, claw: 0.05, short: 0.2 }, color: lc });
  for (const [side, key] of [[1, 'fl'], [-1, 'fr']]) c.leg({ name: key, key, front: true, parent: 'chest', hip: [1.4, 1.0, 0.37], side, L: [0.45, 0.42, 0.15], ball: 0.055, knee: -1, prof: fore, th3: [-0.05, 0.4, 0.65], track: 0.38, toes: { n: 3, len: 0.1, r: 0.05, splay: 0.6, claw: 0.04, short: 0.2 }, color: lc });
  c.eye('head', 2.56, 1.245, 0.283, 0.036, [0.3, 0.05, 1], ['0.55', '0.3', '0.06']);
  c.point('snout', 'head', 3.2, 0.82); c.point('nostril', 'head', 3.0, 1.08); c.point('mouth', 'head', 3.1, 0.86);
  c.gaits = {
    walk: { S: 1.6, beta: 0.66, lift: 0.14, sway: 0.03, bob: 0.015, roll: 0.03, yaw: 0.04, pitch: 0.01, tailYaw: 0.12, tailBob: 0.03, headBob: 0.04, ph: { hl: 0, fl: 0.25, hr: 0.5, fr: 0.75 } },
    gallop: { S: 3.1, beta: 0.34, lift: 0.34, sway: 0.01, bob: 0.075, roll: 0.02, yaw: 0.02, pitch: 0, gallop: 0.1, tailYaw: 0.06, tailBob: 0.08, headBob: 0.12, ph: { hl: 0, hr: 0.14, fl: 0.5, fr: 0.62 } },
  };
  return c.finish({ scaleF: 44, wrinkF: 5 });
}

// ---------- Sauropode à long cou
export function makeSauro(scale = 1, seed = 0) {
  const c = new Creature('sauro' + seed, scale);
  const back = [0.13, 0.11, 0.09], belly = [0.33, 0.29, 0.23], nail = [0.06, 0.05, 0.04];
  const col = (P, d, s) => (s.ker > 0.5 ? nail : mix3(belly, back, smooth(-0.6, 0.4, d)).map((v) => v * (0.75 + 0.5 * fbm(P.x * 0.7 + seed, P.y * 0.7 + P.z, 3, 23))));
  c.bone('hips', null, 0, 4.2);
  const tail = [[-1.6, 4.0], [-3.4, 3.7], [-5.2, 3.3], [-7.0, 2.9], [-8.8, 2.6], [-10.4, 2.4]];
  tail.forEach(([x, y], i) => c.bone('tail' + i, i ? 'tail' + (i - 1) : 'hips', x, y));
  c.bone('spine1', 'hips', 1.5, 4.4); c.bone('chest', 'spine1', 3.2, 4.5);
  const neck = [[4.5, 5.1], [5.8, 6.2], [7.0, 7.5], [8.1, 8.9], [9.0, 10.2]];
  neck.forEach(([x, y], i) => c.bone('neck' + i, i ? 'neck' + (i - 1) : 'chest', x, y));
  c.bone('head', 'neck4', 9.6, 11.0); c.bone('breath', 'chest', 1.8, 4.3);
  c.setAxis(tail.map((_, i) => 'tail' + i), 'hips', ['spine1', 'chest', ...neck.map((_, i) => 'neck' + i), 'head']);
  c.spine = [c.B.spine1, c.B.chest]; c.neck = neck.map((_, i) => c.B['neck' + i]); c.head = c.B.head; c.breath = c.B.breath;
  c.stand = 4.0; c.tailDroop = 0.02;
  const body = [K(-12.2, 2.3, 0.02, 0.02, 0.02), K(-10.4, 2.4, 0.12, 0.13, 0.13), K(-8.0, 2.75, 0.28, 0.3, 0.3), K(-5.5, 3.25, 0.5, 0.52, 0.55), K(-3.0, 3.8, 0.85, 0.8, 0.9),
    K(-1.0, 4.1, 1.2, 1.05, 1.35), K(0.8, 4.25, 1.38, 1.15, 1.6), K(2.4, 4.4, 1.32, 1.1, 1.55), K(3.6, 4.6, 1.0, 0.9, 1.2), K(4.6, 5.2, 0.62, 0.62, 0.72),
    K(5.8, 6.25, 0.45, 0.46, 0.5), K(7.0, 7.55, 0.38, 0.39, 0.42), K(8.1, 8.95, 0.33, 0.34, 0.36), K(9.0, 10.25, 0.29, 0.3, 0.31), K(9.6, 11.0, 0.27, 0.27, 0.26),
    K(10.0, 11.1, 0.26, 0.22, 0.2, { sq: 2.4 }), K(10.35, 11.0, 0.21, 0.15, 0.15, { sq: 2.4 }), K(10.55, 10.92, 0.02, 0.02, 0.02)];
  c.loft(body, { sub: 7, radial: 30, color: col, extraW: breathW(c.bi('breath'), 1.6, 1.5, 0.5) });
  const hind = [[-0.7, 0.45, 0.45, 0.25], [0, 0.72, 0.72, 0.42], [0.9, 0.62, 0.6, 0.48], [1.8, 0.46, 0.45, 0.43], [2.6, 0.38, 0.4, 0.36], [3.4, 0.34, 0.34, 0.33], [3.8, 0.38, 0.36, 0.38], [3.98, 0.4, 0.38, 0.42], [4.08, 0.12, 0.12, 0.14]];
  const fore = [[-0.6, 0.4, 0.4, 0.22], [0, 0.56, 0.56, 0.38], [1.0, 0.48, 0.48, 0.42], [1.9, 0.38, 0.39, 0.37], [2.8, 0.33, 0.34, 0.32], [3.6, 0.3, 0.3, 0.3], [3.98, 0.34, 0.33, 0.35], [4.13, 0.35, 0.34, 0.37], [4.22, 0.1, 0.1, 0.12]];
  for (const [side, key] of [[1, 'hl'], [-1, 'hr']]) c.leg({ name: key, key, parent: 'hips', hip: [0, 4.0, 0.8], side, L: [1.8, 1.6, 0.5], ball: 0.16, knee: 1, prof: hind, th3: [0.04, 0.3, 0.45], track: 0.85, toes: { n: 3, len: 0.3, r: 0.17, splay: 0.6, claw: 0.14, short: 0.2 }, color: col });
  for (const [side, key] of [[1, 'fl'], [-1, 'fr']]) c.leg({ name: key, key, front: true, parent: 'chest', hip: [3.3, 4.1, 0.76], side, L: [1.9, 1.7, 0.45], ball: 0.16, knee: -1, prof: fore, th3: [-0.03, 0.25, 0.4], track: 0.8, toes: { n: 3, len: 0.2, r: 0.16, splay: 0.6, claw: 0.1, short: 0.2 }, color: col });
  c.point('snout', 'head', 10.5, 10.9); c.point('nostril', 'head', 10.2, 11.2); c.point('mouth', 'head', 10.4, 10.9);
  c.gaits = { walk: { S: 5.4, beta: 0.7, lift: 0.3, sway: 0.1, bob: 0.04, roll: 0.02, yaw: 0.03, pitch: 0.005, tailYaw: 0.06, tailBob: 0.01, headBob: 0.03, ph: { hl: 0, fl: 0.25, hr: 0.5, fr: 0.75 } } };
  return c.finish({ scaleF: 14, wrinkF: 1.2 });
}
