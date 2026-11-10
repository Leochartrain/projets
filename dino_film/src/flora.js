// Végétation du Crétacé : fougères arborescentes, fougères, cycas, conifères géants, prêles.
// Textures dessinées par le code (canvas), géométries générées, milliers d'instances, vent.
import * as THREE from 'three';
import { rng, SEED, fbm, lerp, smooth, GLSL_SUN, GLSL_NOISE, patch } from './util.js';
import { riverZ, groundY, ROCK, PATCH } from './world.js';

// ---------- Textures de feuillage.
function canvasTex(w, h, draw, renderer) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.clearRect(0, 0, w, h); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
const green = (R, h0, h1, l0, l1, s = 55) => `hsl(${lerp(h0, h1, R())},${s + R() * 20}%,${lerp(l0, l1, R())}%)`;

function drawFern(g, w, h, R) {
  const cx = w / 2, N = 46;
  for (let i = 0; i < N; i++) {
    const t = 0.05 + 0.94 * i / (N - 1), y = h * (1 - t);
    const len = w * 0.47 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.62)), 0.75) * (0.9 + R() * 0.15);
    for (const side of [-1, 1]) {
      const ang = (0.42 - t * 0.2) * (0.9 + R() * 0.2), M = Math.max(4, Math.floor(len / 5));
      g.strokeStyle = green(R, 70, 95, 16, 24); g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(cx, y); g.lineTo(cx + side * len * Math.cos(ang), y - len * Math.sin(ang)); g.stroke();
      for (let k = 1; k <= M; k++) {
        const u = k / M, px = cx + side * len * u * Math.cos(ang), py = y - len * u * Math.sin(ang);
        const pl = (h / N) * 0.62 * (1 - u * 0.75) + 1.2;
        for (const s2 of [-1, 1]) {
          g.fillStyle = green(R, 78, 118, 20, 38);
          g.save(); g.translate(px, py); g.rotate(-side * ang + s2 * 1.2 + (side < 0 ? Math.PI : 0)); g.beginPath();
          g.ellipse(pl * 0.5, 0, pl * 0.55, Math.max(1.3, len * 0.028), 0, 0, 6.3); g.fill(); g.restore();
        }
      }
    }
  }
  g.strokeStyle = '#3a3413'; g.lineWidth = 3.4; g.beginPath(); g.moveTo(cx, h); g.lineTo(cx, h * 0.02); g.stroke();
}
function drawCycad(g, w, h, R) {
  const cx = w / 2, N = 64;
  for (let i = 0; i < N; i++) {
    const t = 0.06 + 0.93 * i / (N - 1), y = h * (1 - t);
    const len = w * 0.48 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.8)), 0.5);
    for (const side of [-1, 1]) {
      const ang = 0.55 - t * 0.2 + R() * 0.06;
      g.fillStyle = green(R, 95, 140, 13, 26, 40);
      g.save(); g.translate(cx, y); g.rotate(side > 0 ? -ang : Math.PI + ang); g.beginPath();
      g.moveTo(0, -2.6); g.quadraticCurveTo(len * 0.5, -3.4, len, 0); g.quadraticCurveTo(len * 0.5, 3.4, 0, 2.6); g.fill();
      g.strokeStyle = 'rgba(150,170,90,0.35)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, 0); g.lineTo(len, 0); g.stroke();
      g.restore();
    }
  }
  g.strokeStyle = '#4a4420'; g.lineWidth = 4.5; g.beginPath(); g.moveTo(cx, h); g.lineTo(cx, h * 0.03); g.stroke();
}
function drawConifer(g, w, h, R) {
  const cx = w / 2;
  const twig = (x0, y0, ang, len, depth) => {
    const x1 = x0 + Math.cos(ang) * len, y1 = y0 - Math.sin(ang) * len;
    if (depth) { g.save(); g.translate(x0, y0); g.rotate(-ang); g.fillStyle = green(R, 95, 135, 8, 15, 35); g.beginPath();
      g.moveTo(0, -5); g.quadraticCurveTo(len * 0.45, -19, len, 0); g.quadraticCurveTo(len * 0.45, 19, 0, 5); g.fill(); g.restore(); }
    g.strokeStyle = '#2c2112'; g.lineWidth = depth ? 2 : 5; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    const M = Math.floor(len / 2.4);
    for (let k = 0; k < M; k++) {
      const u = k / M, px = lerp(x0, x1, u), py = lerp(y0, y1, u);
      for (const s of [-1, 1]) {
        const a = ang + s * (0.75 + R() * 0.5), l = 9 + R() * 9;
        g.strokeStyle = green(R, 85, 140, 10, 26, 35); g.lineWidth = 2.6;
        g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a) * l, py - Math.sin(a) * l); g.stroke();
      }
    }
    if (!depth) {
      const B = 24;
      for (let i = 1; i < B; i++) {
        const u = i / B, bl = w * 0.46 * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.7)), 0.7) * (0.8 + R() * 0.3);
        for (const s of [-1, 1]) twig(lerp(x0, x1, u), lerp(y0, y1, u), ang + s * (0.95 + R() * 0.2) * (1 - u * 0.3), bl, 1);
      }
    }
  };
  twig(cx, h, Math.PI / 2, h * 0.97, 0);
}
function drawHorsetail(g, w, h, R) {
  for (let s = 0; s < 7; s++) {
    const x = w * (0.1 + 0.8 * R()), top = h * (0.05 + R() * 0.4);
    g.strokeStyle = green(R, 75, 110, 18, 34, 45); g.lineWidth = 2.6;
    g.beginPath(); g.moveTo(x, h); g.lineTo(x + (R() - 0.5) * 14, top); g.stroke();
    for (let y = h - 14; y > top; y -= 13) for (let k = -4; k <= 4; k++) {
      if (!k) continue; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + k * 5, y - 12 - Math.abs(k)); g.stroke();
    }
  }
}

// ---------- Géométries.
class Builder {
  constructor() { this.p = []; this.n = []; this.uv = []; this.sw = []; this.col = []; this.idx = []; }
  // Ruban courbé qui porte une texture de fronde (section en V pour donner du volume).
  strip(o) {
    const { base, yaw, pitch0, bend, len, width, segs = 5, fold = 0.16, sway = 0.1, tint = [1, 1, 1], roll = 0 } = o;
    const b0 = this.p.length / 3, hx = Math.cos(yaw), hz = Math.sin(yaw);
    const pos = new THREE.Vector3().copy(base), side = new THREE.Vector3(-hz, 0, hx), tan = new THREE.Vector3(), nrm = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), s2 = new THREE.Vector3();
    for (let i = 0; i <= segs; i++) {
      const s = i / segs, e = pitch0 - bend * Math.pow(s, 1.25);
      tan.set(hx * Math.cos(e), Math.sin(e), hz * Math.cos(e));
      s2.copy(side).applyAxisAngle(tan, roll);
      nrm.crossVectors(s2, tan).normalize(); if (nrm.y < 0) nrm.negate();
      const hw = width * 0.5;
      for (let k = -1; k <= 1; k++) {
        this.p.push(pos.x + s2.x * hw * k - nrm.x * fold * width * (k ? 0 : 1) + nrm.x * fold * width * 0.5,
          pos.y + s2.y * hw * k - nrm.y * fold * width * (k ? 0 : 1) + nrm.y * fold * width * 0.5,
          pos.z + s2.z * hw * k - nrm.z * fold * width * (k ? 0 : 1) + nrm.z * fold * width * 0.5);
        const nn = new THREE.Vector3().copy(nrm).addScaledVector(s2, k * 0.5).lerp(up, 0.35).normalize();
        this.n.push(nn.x, nn.y, nn.z); this.uv.push((k + 1) / 2, s); this.sw.push(sway * s * s + (o.swayBase || 0)); this.col.push(...tint);
      }
      pos.addScaledVector(tan, len / segs);
      if (i < segs) { const a = b0 + i * 3; this.idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
    }
  }
  trunk(h, r0, r1, radial = 9, rings = 6, swayTop = 0, lean = 0) {
    const b0 = this.p.length / 3;
    for (let j = 0; j <= rings; j++) {
      const t = j / rings, r = lerp(r0, r1, Math.pow(t, 0.8)) * (1 + (j === 0 ? 0.35 : 0)), y = h * t;
      for (let i = 0; i <= radial; i++) {
        const a = i / radial * Math.PI * 2;
        this.p.push(Math.cos(a) * r + lean * t * t, y, Math.sin(a) * r); this.n.push(Math.cos(a), 0.1, Math.sin(a));
        this.uv.push(i / radial, y); this.sw.push(swayTop * t * t); this.col.push(1, 1, 1);
      }
    }
    for (let j = 0; j < rings; j++) for (let i = 0; i < radial; i++) {
      const a = b0 + j * (radial + 1) + i, b = a + radial + 1;
      this.idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aSway', new THREE.Float32BufferAttribute(this.sw, 1));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    return g;
  }
}

function plantGeos(R) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z), G = {};
  const dead = [0.75, 0.5, 0.25];
  { // Fougère arborescente
    const f = new Builder(), t = new Builder(), h = 4.4;
    t.trunk(h, 0.2, 0.13, 9, 6, 0.05, 0.3);
    for (let i = 0; i < 20; i++) f.strip({ base: V(0.3, h - 0.05, 0), yaw: i * 2.4 + R() * 0.4, pitch0: 0.75 + R() * 0.45, bend: 1.7 + R() * 0.5, len: 2.7 + R() * 0.8, width: 1.0, segs: 7, sway: 0.22, swayBase: 0.05 });
    for (let i = 0; i < 5; i++) f.strip({ base: V(0.3, h, 0), yaw: i * 1.3 + R(), pitch0: 1.35, bend: 0.8, len: 1.7, width: 0.6, segs: 5, sway: 0.15, swayBase: 0.05 });
    for (let i = 0; i < 7; i++) f.strip({ base: V(0.3, h - 0.25, 0), yaw: i * 0.9 + R(), pitch0: -0.5, bend: 0.9, len: 1.6 + R(), width: 0.8, segs: 4, sway: 0.1, tint: dead, swayBase: 0.05 });
    G.treeFern = { foliage: f.geo(), trunk: t.geo() };
  }
  { // Fougère au sol
    const f = new Builder();
    for (let i = 0; i < 11; i++) f.strip({ base: V(0, 0.02, 0), yaw: i * 2.4 + R() * 0.5, pitch0: 0.85 + R() * 0.35, bend: 1.3 + R() * 0.5, len: 1.0 + R() * 0.55, width: 0.46, segs: 5, sway: 0.09 });
    G.fern = { foliage: f.geo() };
  }
  { // Cycas
    const f = new Builder(), t = new Builder();
    t.trunk(0.95, 0.3, 0.25, 9, 3);
    for (let i = 0; i < 26; i++) { const k = i / 26; f.strip({ base: V(0, 0.9, 0), yaw: i * 2.4 + R() * 0.3, pitch0: 0.2 + k * 1.1, bend: 0.55 - k * 0.3, len: 1.9 - k * 0.5, width: 0.44, segs: 4, sway: 0.05, fold: 0.22 }); }
    G.cycad = { foliage: f.geo(), trunk: t.geo() };
  }
  { // Conifère géant (port conique)
    const f = new Builder(), t = new Builder(), h = 44;
    t.trunk(h, 1.25, 0.1, 10, 8, 0.5);
    for (let y = 13; y < 42.8; y += 1.75) {
      const k = (y - 13) / 30.6, len = lerp(8.2, 1.3, Math.pow(k, 0.8));
      for (let i = 0; i < 5; i++) {
        const yaw = i * 1.2566 + y * 1.7 + R() * 0.5, yb = y + R() * 0.8, l2 = len * (0.8 + R() * 0.35);
        f.strip({ base: V(0, yb, 0), yaw, pitch0: 0.1 + k * 0.5, bend: 0.8, len: l2, width: l2 * 0.5, segs: 4, sway: 0.35, swayBase: 0.5 * (y / h) ** 2, fold: 0.12, roll: (R() - 0.5) * 1.1 });
        f.strip({ base: V(0, yb + 0.3, 0), yaw: yaw + 0.5, pitch0: 0.55 + k * 0.4, bend: 1.0, len: l2 * 0.62, width: l2 * 0.4, segs: 3, sway: 0.3, swayBase: 0.5 * (y / h) ** 2, fold: 0.12, roll: (R() - 0.5) * 1.4 });
      }
    }
    for (let i = 0; i < 4; i++) f.strip({ base: V(0, 42.6, 0), yaw: i * 1.57, pitch0: 1.05, bend: 0.5, len: 1.9, width: 1.1, segs: 2, sway: 0.3, swayBase: 0.5 });
    G.conifer = { foliage: f.geo(), trunk: t.geo() };
  }
  { // Araucaria (tronc nu, couronne en parasol)
    const f = new Builder(), t = new Builder(), h = 37;
    t.trunk(h, 0.9, 0.16, 10, 8, 0.5);
    for (let y = 23; y < 37; y += 1.25) {
      const k = (y - 23) / 14, len = lerp(7.5, 2.2, Math.pow(k, 1.4));
      for (let i = 0; i < 6; i++) f.strip({ base: V(0, y, 0), yaw: i * 1.047 + y * 2.1 + R() * 0.4, pitch0: -0.25 + k * 0.7, bend: -0.75, len: len * (0.8 + R() * 0.3), width: len * 0.42, segs: 4, sway: 0.3, swayBase: 0.5 * (y / h) ** 2, fold: 0.1 });
    }
    G.araucaria = { foliage: f.geo(), trunk: t.geo() };
  }
  { // Prêles du bord de l'eau
    const f = new Builder();
    for (let i = 0; i < 3; i++) f.strip({ base: V(0, 0, 0), yaw: i * 1.05, pitch0: 1.5, bend: 0.12, len: 1.25, width: 0.7, segs: 2, sway: 0.08, fold: 0 });
    G.horsetail = { foliage: f.geo() };
  }
  return G;
}

const WIND = `
  vec3 ip = vec3(0.0);
  #ifdef USE_INSTANCING
    ip = instanceMatrix[3].xyz;
  #endif
  float wph = ip.x * 0.13 + ip.z * 0.17;
  float wv = sin(uTime * 1.3 + wph) * 0.55 + sin(uTime * 2.7 + wph * 1.9 + position.y * 0.4) * 0.3 + sin(uTime * 5.9 + wph * 3.1 + position.x * 2.0) * 0.12;
  transformed.x += aSway * wv; transformed.z += aSway * wv * 0.4; transformed.y -= aSway * abs(wv) * 0.2;
`;

function leafMaterial(map, rough) {
  const m = new THREE.MeshStandardMaterial({ map, alphaTest: 0.3, side: THREE.DoubleSide, roughness: rough, vertexColors: true, metalness: 0 });
  return patch(m, {
    key: 'leaf', sunShadow: true,
    vpars: `attribute float aSway; uniform float uTime;`,
    vbegin: WIND,
    fpars: GLSL_SUN,
    // Translucidité : la lumière du soleil traverse les frondes à contre-jour.
    fend: `{
      vec3 Ls = normalize((viewMatrix * vec4(SUN, 0.0)).xyz), Vv = normalize(vViewPosition);
      float thru = max(dot(-normal, Ls), 0.0) * 0.55 + pow(max(dot(-Vv, Ls), 0.0), 4.0) * 0.7;
      outgoingLight += diffuseColor.rgb * vec3(1.1, 1.15, 0.5) * SUNCOL * 11.0 * 0.11 * thru * sunShadow();
    }`,
  });
}
function barkMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 });
  return patch(m, {
    key: 'bark',
    vpars: `attribute float aSway; uniform float uTime; varying vec3 vOb;`,
    vbegin: `vOb = position;` + WIND,
    fpars: `varying vec3 vOb; ${GLSL_NOISE}`,
    fcolor: `float ang = atan(vOb.z, vOb.x);
      float bk = fbm2(vec2(ang * 5.0, vOb.y * 0.7)) * 0.6 + fbm2(vec2(ang * 17.0, vOb.y * 2.4)) * 0.4;
      vec3 bc = mix(vec3(0.03,0.024,0.018), vec3(0.11,0.085,0.062), bk);
      bc = mix(bc, vec3(0.05,0.085,0.03), smoothstep(0.55, 0.8, fbm2(vec2(ang * 2.0 + 4.0, vOb.y * 0.25))) * 0.7);
      diffuseColor.rgb *= bc;`,
    fnormal: `normal = bumpN(normal, -vViewPosition, bk * 0.09, 1.0 / (1.0 + length(vViewPosition) * 0.03));`,
  });
}

export function buildFlora(scene, keepOut) {
  const R = rng(SEED + 11);
  const tex = {
    fern: canvasTex(256, 1024, (g, w, h) => drawFern(g, w, h, R)),
    cycad: canvasTex(256, 1024, (g, w, h) => drawCycad(g, w, h, R)),
    conifer: canvasTex(512, 1024, (g, w, h) => drawConifer(g, w, h, R)),
    horsetail: canvasTex(256, 512, (g, w, h) => drawHorsetail(g, w, h, R)),
  };
  const G = plantGeos(R), bark = barkMaterial();
  const mats = { fern: leafMaterial(tex.fern, 0.55), cycad: leafMaterial(tex.cycad, 0.4), conifer: leafMaterial(tex.conifer, 0.7), horsetail: leafMaterial(tex.horsetail, 0.6) };
  const dummy = new THREE.Object3D(), col = new THREE.Color(), stats = {};

  function plant(name, geo, mat, list, hue) {
    if (!list.length) return;
    const parts = [[geo.foliage, mat, true]]; if (geo.trunk) parts.push([geo.trunk, bark, false]);
    for (const [g, m, isLeaf] of parts) {
      const im = new THREE.InstancedMesh(g, m, list.length);
      list.forEach((o, i) => {
        dummy.position.set(o.x, o.y, o.z); dummy.rotation.set(o.tx || 0, o.r, o.tz || 0); dummy.scale.set(o.s, o.s * (o.sy || 1), o.s);
        dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
        if (isLeaf) col.setHSL(hue[0] + (o.h - 0.5) * hue[1], hue[2], 0.5 * (0.75 + o.v * 0.5)); else col.setScalar(0.8 + o.v * 0.4);
        im.setColorAt(i, isLeaf ? col.multiplyScalar(1.15) : col);
      });
      im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
      scene.add(im);
    }
    stats[name] = list.length;
  }
  const inst = (x, z, s, extra = {}) => ({ x, z, y: groundY(x, z) - 0.05, s, r: R() * 6.283, h: R(), v: R(), ...extra });

  // Conifères : canopée fermée de part et d'autre du couloir de la rivière.
  const con = [], ara = [];
  for (let x = -452; x < 452; x += 11.5) for (let d = 27; d < 190; d += 11.5) for (const side of [-1, 1]) {
    const px = x + (R() - 0.5) * 10, ad = d + (R() - 0.5) * 10, pz = riverZ(px) + side * ad, y = groundY(px, pz);
    if (R() > 0.9 || y > 70 || keepOut(px, pz, 'tree')) continue;
    const o = inst(px, pz, 0.7 + R() * 0.55, { sy: 0.85 + R() * 0.4, tx: (R() - 0.5) * 0.05, tz: (R() - 0.5) * 0.05 });
    (R() < 0.3 ? ara : con).push(o);
  }
  plant('conifer', G.conifer, mats.conifer, con, [0.3, 0.07, 0.36]);
  plant('araucaria', G.araucaria, mats.conifer, ara, [0.27, 0.06, 0.34]);

  // Fougères arborescentes.
  const tf = [];
  for (let i = 0; i < 5200 && tf.length < 3000; i++) {
    const x = -300 + R() * 560, ad = 15.5 + Math.pow(R(), 1.6) * 95, z = riverZ(x) + (R() < 0.5 ? -1 : 1) * ad;
    if (keepOut(x, z, 'fern') || groundY(x, z) > 30) continue;
    tf.push(inst(x, z, 0.55 + R() * 0.9, { sy: 0.7 + R() * 0.7, tx: (R() - 0.5) * 0.12, tz: (R() - 0.5) * 0.12 }));
  }
  plant('treeFern', G.treeFern, mats.fern, tf, [0.27, 0.08, 0.4]);

  // Fougères basses : tapis dense près des berges de la zone d'action.
  const gf = [];
  for (let i = 0; i < 30000 && gf.length < 9000; i++) {
    const x = -110 + R() * 280, ad = 12.8 + Math.pow(R(), 2.0) * 70, z = riverZ(x) + (R() < 0.5 ? -1 : 1) * ad;
    if (keepOut(x, z, 'low')) continue;
    gf.push(inst(x, z, 0.6 + R() * 1.1, { tx: (R() - 0.5) * 0.2, tz: (R() - 0.5) * 0.2 }));
  }
  plant('fern', G.fern, mats.fern, gf, [0.26, 0.09, 0.4]);

  const cy = [];
  for (let i = 0; i < 4000 && cy.length < 900; i++) {
    const x = -110 + R() * 280, ad = 13 + R() * 30, z = riverZ(x) + (R() < 0.5 ? -1 : 1) * ad;
    if (keepOut(x, z, 'low')) continue;
    cy.push(inst(x, z, 0.7 + R() * 0.9));
  }
  plant('cycad', G.cycad, mats.cycad, cy, [0.3, 0.06, 0.32]);

  const ht = [];
  for (let i = 0; i < 12000 && ht.length < 4200; i++) {
    const x = -110 + R() * 280, ad = 10.6 + R() * 3.8, z = riverZ(x) + (R() < 0.5 ? -1 : 1) * ad;
    if (keepOut(x, z, 'reed') || fbm(x * 0.08, z * 0.08, 2, 91) < 0.48) continue;
    ht.push(inst(x, z, 0.5 + R() * 0.9));
  }
  plant('horsetail', G.horsetail, mats.horsetail, ht, [0.25, 0.08, 0.35]);
  return stats;
}
