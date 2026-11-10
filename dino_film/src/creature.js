// Fabrique de dinosaures : squelette, peau lissée sur des profils, shader d'écailles,
// marche avec pieds ancrés (cinématique inverse), cou et tête par CCD.
import * as THREE from 'three';
import { clamp, lerp, ease, smooth, noise1, GLSL_SUN, GLSL_NOISE, patch } from './util.js';

const V = () => new THREE.Vector3(), Q = () => new THREE.Quaternion();
const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);
const qx = (a) => Q().setFromAxisAngle(AX, a), qy = (a) => Q().setFromAxisAngle(AY, a), qz = (a) => Q().setFromAxisAngle(AZ, a);
const CH = ['x', 'y', 'w', 'hu', 'hd', 'sq', 'ker', 'thin', 'inn'];
const DEF = { sq: 2, ker: 0, thin: 0, inn: 0 };

function crKeys(keys, sub) {
  const K = keys.map((k) => ({ ...DEF, ...k })), out = [], n = K.length;
  const cr = (a, b, c, d, t) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
  for (let i = 0; i < n - 1; i++) {
    const a = K[Math.max(i - 1, 0)], b = K[i], c = K[i + 1], d = K[Math.min(i + 2, n - 1)];
    for (let j = 0; j < sub; j++) {
      const t = j / sub, o = {};
      for (const ch of CH) o[ch] = cr(a[ch], b[ch], c[ch], d[ch], t);
      // Les rayons ne doivent jamais dépasser leurs voisins (pas de rebond de spline).
      for (const ch of ['w', 'hu', 'hd']) o[ch] = clamp(o[ch], Math.min(b[ch], c[ch]) * 0.999, Math.max(b[ch], c[ch]) * 1.08);
      out.push(o);
    }
  }
  out.push({ ...K[n - 1] });
  return out;
}

export class Creature {
  constructor(name, scale = 1) {
    this.name = name; this.scale = scale;
    this.rig = new THREE.Group(); this.rig.name = name;
    this.bones = []; this.B = {}; this.rest = {};
    this.legs = []; this.points = {}; this.neck = []; this.tail = []; this.spine = [];
    this.g = { pos: [], col: [], rest: [], skin: [], si: [], sw: [], idx: [], fix: [] };
    this.axisJ = [];
  }
  bone(name, parent, x, y, z = 0) {
    const b = new THREE.Bone(); b.name = name; b.userData.i = this.bones.length;
    this.rest[name] = new THREE.Vector3(x, y, z);
    if (parent) { b.position.copy(this.rest[name]).sub(this.rest[parent]); this.B[parent].add(b); } else { b.position.set(x, y, z); this.rig.add(b); }
    this.bones.push(b); this.B[name] = b; return b;
  }
  bi(name) { return this.B[name].userData.i; }
  // Chaîne axiale (queue → bassin → tête) : poids de peau par interpolation le long de x.
  setAxis(tail, hips, front) {
    this.tail = tail.map((n) => this.B[n]); this.hips = this.B[hips];
    const segs = [];
    const tx = tail.map((n) => this.rest[n].x), fx = front.map((n) => this.rest[n].x);
    for (let i = tail.length - 1; i >= 0; i--) segs.push([i + 1 < tail.length ? tx[i + 1] : -1e9, tx[i], this.bi(tail[i])]);
    segs.push([tx[0] ?? -1e9, fx[0], this.bi(hips)]);
    for (let i = 0; i < front.length; i++) segs.push([fx[i], i + 1 < front.length ? fx[i + 1] : 1e9, this.bi(front[i])]);
    this.axisSegs = segs;
  }
  axisW(x) {
    const S = this.axisSegs; let i = S.findIndex((s) => x >= s[0] && x < s[1]); if (i < 0) i = S.length - 1;
    const [a, b, bn] = S[i]; if (a < -1e8 || b > 1e8) {
      if (a < -1e8 && b > 1e8) return [[bn, 1]];
      // Segment d'extrémité : fondu seulement du côté intérieur.
      const inner = a < -1e8 ? b : a, d = Math.abs(x - inner), o = a < -1e8 ? S[i + 1] : S[i - 1], len = Math.abs(o[1] - o[0]) * 0.5;
      const w = clamp(0.5 + d / (2 * len), 0.5, 1); return w >= 1 ? [[bn, 1]] : [[bn, w], [o[2], 1 - w]];
    }
    const u = (x - a) / (b - a);
    if (u < 0.5) return i > 0 ? [[bn, 0.5 + u], [S[i - 1][2], 0.5 - u]] : [[bn, 1]];
    return i < S.length - 1 ? [[bn, 1.5 - u], [S[i + 1][2], u - 0.5]] : [[bn, 1]];
  }

  // Peau : sections en super-ellipse le long d'une courbe du plan sagittal.
  loft(keys, o = {}) {
    const { sub = 6, radial = 26, z0 = 0, weights, color, matrix, mirror = false, bumps = [], extraW } = o;
    const st = crKeys(keys, sub), g = this.g, b0 = g.pos.length / 3, nS = st.length, p = V(), c = V(), tmp = V();
    const ringStart = [];
    for (let i = 0; i < nS; i++) {
      const s = st[i], a = st[Math.max(i - 1, 0)], b = st[Math.min(i + 1, nS - 1)];
      let tx = b.x - a.x, ty = b.y - a.y; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const nx = -ty, ny = tx;
      let W = weights ? weights(s, i / (nS - 1)) : this.axisW(s.x);
      if (extraW) W = extraW(s, W);
      W = W.filter((w) => w[1] > 0.001).sort((u, v) => v[1] - u[1]).slice(0, 4);
      const ws = W.reduce((t, w) => t + w[1], 0);
      ringStart.push(g.pos.length / 3);
      for (let k = 0; k <= radial; k++) {
        const th = (k / radial) * Math.PI * 2 + Math.PI, cs = Math.cos(th), sn = Math.sin(th), e = 2 / s.sq;
        const ex = Math.sign(sn) * Math.pow(Math.abs(sn), e), ey = Math.sign(cs) * Math.pow(Math.abs(cs), e);
        const off = (ey >= 0 ? Math.max(s.hu, 1e-4) : Math.max(s.hd, 1e-4)) * ey, lat = Math.max(s.w, 1e-4) * ex;
        p.set(s.x + nx * off, s.y + ny * off, z0 + lat); c.set(s.x, s.y, z0);
        for (const bm of bumps) for (const sg of bm.sym === false ? [1] : [1, -1]) {
          const d = Math.hypot(p.x - bm.p[0], p.y - bm.p[1], p.z - bm.p[2] * sg);
          if (d < bm.r * 2.5) { tmp.copy(p).sub(c).normalize(); p.addScaledVector(tmp, bm.h * Math.exp(-(d * d) / (bm.r * bm.r))); }
        }
        const dorsal = ey, col = color ? color(p, dorsal, s) : [0.3, 0.3, 0.3];
        if (matrix) p.applyMatrix4(matrix);
        if (mirror) p.z = -p.z;
        g.pos.push(p.x, p.y, p.z); g.rest.push(p.x, p.y, p.z); g.col.push(col[0], col[1], col[2]);
        g.skin.push(s.thin, s.ker, col[3] ?? s.inn);
        for (let q = 0; q < 4; q++) { g.si.push(W[q] ? W[q][0] : 0); g.sw.push(W[q] ? W[q][1] / ws : 0); }
      }
    }
    // Sens des triangles : vérifié sur un anneau médian pour que la peau regarde dehors.
    const mid = ringStart[Math.floor(nS / 2)], P = (i) => V().fromArray(g.pos, i * 3);
    const A = P(mid + Math.floor(radial / 4)), Bv = P(mid + Math.floor(radial / 4) + 1), Cv = P(mid + radial + 1 + Math.floor(radial / 4));
    const ctr = V(); for (let k = 0; k < radial; k++) ctr.add(P(mid + k)); ctr.multiplyScalar(1 / radial);
    const fn = V().crossVectors(Cv.clone().sub(A), Bv.clone().sub(A));
    const flip = fn.dot(A.clone().sub(ctr)) < 0;
    for (let i = 0; i < nS - 1; i++) for (let k = 0; k < radial; k++) {
      const a = ringStart[i] + k, b = a + 1, c2 = ringStart[i + 1] + k, d = c2 + 1;
      if (flip) g.idx.push(a, b, c2, b, d, c2); else g.idx.push(a, c2, b, b, c2, d);
    }
    g.fix.push({ ringStart, radial });
    return b0;
  }
  // Petit triangle de peau (commissure des lèvres).
  tri(pts, bones, col, skin = [0, 0, 1]) {
    const g = this.g, b0 = g.pos.length / 3;
    pts.forEach((p, i) => { g.pos.push(...p); g.rest.push(...p); g.col.push(...col); g.skin.push(...skin); g.si.push(this.bi(bones[i]), 0, 0, 0); g.sw.push(1, 0, 0, 0); });
    g.idx.push(b0, b0 + 1, b0 + 2);
  }

  leg(o) {
    const { name, parent, hip, side, L, ball, knee = 1, prof, toes, th3, track } = o;
    const [l1, l2, l3] = L, z = hip[2] * side, tot = l1 + l2 + l3;
    const th = this.bone(name + 'Thigh', parent, hip[0], hip[1], z);
    const sh = this.bone(name + 'Shin', name + 'Thigh', hip[0], hip[1] - l1, z);
    const ft = this.bone(name + 'Foot', name + 'Shin', hip[0], hip[1] - l1 - l2, z);
    const toe = this.bone(name + 'Toe', name + 'Foot', hip[0], hip[1] - tot, z);
    const ib = [this.bi(parent), th.userData.i, sh.userData.i, ft.userData.i, toe.userData.i];
    const weights = (s) => {
      const d = hip[1] - s.y; // distance sous la hanche
      if (d < l1 * 0.3) { const w = smooth(-0.4 * l1, 0.3 * l1, d); return [[ib[1], w], [ib[0], 1 - w]]; }
      if (d < l1 + l2 * 0.5) { const w = smooth(l1 - 0.2 * l1, l1 + 0.2 * l2, d); return [[ib[2], w], [ib[1], 1 - w]]; }
      if (d < l1 + l2 + l3 * 0.5) { const w = smooth(l1 + l2 - 0.15 * l2, l1 + l2 + 0.2 * l3, d); return [[ib[3], w], [ib[2], 1 - w]]; }
      const w = smooth(tot - 0.2 * l3, tot + 0.02, d); return [[ib[4], w], [ib[3], 1 - w]];
    };
    const mirror = side < 0;
    const keys = prof.map(([d, f, bk, w, ker]) => ({ x: hip[0], y: hip[1] - d, w, hu: f, hd: bk, ker: ker || 0 }));
    keys.unshift({ x: hip[0], y: keys[0].y + keys[0].w * 0.5, w: 0.01, hu: 0.01, hd: 0.01 });
    this.loft(keys, { sub: 5, radial: 20, z0: hip[2], weights, color: o.color, mirror, bumps: o.bumps || [] });
    // Doigts griffus.
    const by = hip[1] - tot, n = toes.n;
    for (let i = 0; i < n; i++) {
      const a = n === 1 ? 0 : lerp(-toes.splay, toes.splay, i / (n - 1)), len = toes.len * (1 - Math.abs(a) * (toes.short ?? 0.45)), r = toes.r;
      const m = new THREE.Matrix4().makeTranslation(hip[0] + (toes.x || 0), by, hip[2] + Math.sin(a) * r * 0.6).multiply(new THREE.Matrix4().makeRotationY(-a));
      const cl = toes.claw;
      this.loft([
        { x: -r * 1.1, y: r * 0.25, w: r * 0.7, hu: r * 0.9, hd: ball * 0.9 },
        { x: len * 0.2, y: 0.02, w: r * 1.08, hu: r * 1.0, hd: ball },
        { x: len * 0.55, y: 0, w: r * 0.92, hu: r * 0.8, hd: ball * 0.98 },
        { x: len * 0.85, y: 0, w: r * 0.84, hu: r * 0.72, hd: ball * 0.92 },
        { x: len, y: 0.01, w: r * 0.6, hu: r * 0.62, hd: ball * 0.6, ker: 0.5 },
        { x: len + cl * 0.45, y: -ball * 0.15, w: r * 0.36, hu: r * 0.46, hd: r * 0.3, ker: 1 },
        { x: len + cl * 0.85, y: -ball * 0.55, w: r * 0.17, hu: r * 0.2, hd: r * 0.14, ker: 1 },
        { x: len + cl, y: -ball * 0.86, w: 0.003, hu: 0.003, hd: 0.003, ker: 1 },
      ], { sub: 4, radial: 12, matrix: m, mirror, color: o.color, weights: (s) => { const w = smooth(-r, len * 0.25, s.x); return [[ib[4], w], [ib[3], 1 - w]]; } });
    }
    this.legs.push({ name, parent: this.B[parent], thigh: th, shin: sh, foot: ft, toe, L, ball, knee, side, th3, track: track ?? hip[2], hipX: hip[0], front: o.front || false, key: o.key, st: {} });
  }

  point(name, bone, x, y, z = 0) { this.points[name] = { bone: this.B[bone], v: new THREE.Vector3(x, y, z).sub(this.rest[bone]) }; }
  worldPoint(name, out) { const p = this.points[name]; return p.bone.localToWorld(out.copy(p.v)); }

  eye(bone, x, y, z, r, look, irisCol) {
    const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.2 });
    patch(m, {
      key: 'eye', vpars: 'varying vec3 vOb;', vbegin: 'vOb = normalize(position);', fpars: 'varying vec3 vOb;',
      fcolor: `float ed = vOb.z; vec3 ic = mix(vec3(${irisCol.join(',')}), vec3(0.02,0.012,0.006), smoothstep(0.86, 0.6, ed));
        ic *= 0.7 + 0.5 * sin(atan(vOb.y, vOb.x) * 34.0) * 0.3;
        ic = mix(ic, vec3(0.002), smoothstep(0.955, 0.97, ed)); diffuseColor.rgb = ic;`,
    });
    for (const s of [1, -1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), m);
      e.position.set(x, y, z * s).sub(this.rest[bone]);
      e.lookAt(new THREE.Vector3(x + look[0], y + look[1], (z + look[2]) * s));
      this.B[bone].add(e);
    }
  }

  finish(opts = {}) {
    const g = this.g, geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
    geo.setAttribute('aRest', new THREE.Float32BufferAttribute(g.rest, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(g.col, 3));
    geo.setAttribute('aSkin', new THREE.Float32BufferAttribute(g.skin, 3));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(g.si, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(g.sw, 4));
    geo.setIndex(g.idx); geo.computeVertexNormals();
    // Raccords : couture de chaque anneau et pointes fermées.
    const N = geo.attributes.normal, a = V(), b = V();
    for (const { ringStart, radial } of g.fix) {
      for (const r of ringStart) { a.fromBufferAttribute(N, r); b.fromBufferAttribute(N, r + radial); a.add(b).normalize(); N.setXYZ(r, a.x, a.y, a.z); N.setXYZ(r + radial, a.x, a.y, a.z); }
      for (const r of [ringStart[0], ringStart[ringStart.length - 1]]) {
        a.set(0, 0, 0); for (let k = 0; k <= radial; k++) a.add(b.fromBufferAttribute(N, r + k));
        if (a.lengthSq() > 1e-8) { a.normalize(); for (let k = 0; k <= radial; k++) N.setXYZ(r + k, a.x, a.y, a.z); }
      }
    }
    this.uni = { uScaleF: { value: opts.scaleF || 26 }, uWrinkF: { value: opts.wrinkF || 3.2 }, uRig: { value: this.scale }, uWetY: { value: -10 }, uSheen: { value: opts.sheen ?? 1 } };
    const mat = skinMaterial(this.uni);
    this.rig.updateMatrixWorld(true);
    const mesh = new THREE.SkinnedMesh(geo, mat);
    this.rig.add(mesh);
    mesh.bind(new THREE.Skeleton(this.bones));
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    this.mesh = mesh; this.rig.scale.setScalar(this.scale);
    this.g = null;
    return this;
  }

  // ---------- Pose : fonction pure des paramètres (aucun état conservé d'une image à l'autre).
  pose(p, groundY) {
    const sc = this.scale, g = p.gait, m = p.move ?? 1, h = p.heading;
    const dir = V().set(Math.cos(h), 0, -Math.sin(h)), lat = V().set(Math.sin(h), 0, Math.cos(h));
    const S = g.S * sc, u0 = p.s / S, ph = 2 * Math.PI * (u0 - g.beta / 2);
    const O = p.origin, T = V();
    let yH = 0, nH = 0, yF = 0, nF = 0, xF = 0, xHd = 0;
    for (const L of this.legs) {
      const phase = g.ph[L.key], u = u0 + phase, k = Math.floor(u), f = u - k, st = L.st;
      const q = (kk) => (kk - phase) * S + L.hipX * sc + g.beta * S / 2 + (L.front ? (g.reachF || 0) : (g.reachH || 0)) * sc;
      const at = (along, out) => out.copy(O).addScaledVector(dir, along).addScaledVector(lat, L.side * L.track * sc * (g.trackK ?? 1));
      const sink = (p.sink || 0);
      let along, yoff, gy;
      if (f < g.beta) {
        st.stance = true; st.t = f / g.beta; st.sw = 0; along = q(k); at(along, T); gy = groundY(T.x, T.z);
        yoff = -sink * smooth(0, 0.22, st.t);
      } else {
        st.stance = false; st.sw = (f - g.beta) / (1 - g.beta); st.t = 1;
        const e = ease(st.sw); along = lerp(q(k), q(k + 1), e);
        at(q(k), T); const g0 = groundY(T.x, T.z); at(q(k + 1), T); const g1 = groundY(T.x, T.z);
        gy = lerp(g0, g1, e); at(along, T);
        yoff = lerp(-sink, 0, ease(st.sw * 3)) + g.lift * sc * Math.pow(Math.sin(Math.PI * st.sw), 0.9) * (0.35 + 0.65 * m);
      }
      st.k = k; st.gy = gy; st.land = at(q(k), V()); st.landY = groundY(st.land.x, st.land.z);
      st.target = V().set(T.x, gy + yoff + L.ball * sc, T.z);
      if (L.front) { yF += gy; nF++; xF = L.hipX; } else { yH += gy; nH++; xHd = L.hipX; }
    }
    yH /= Math.max(nH, 1);
    let pitch = (p.pitch || 0) + g.pitch * m * Math.sin(2 * ph + (g.pitchPh || 0));
    if (nF) { yF /= nF; pitch += Math.atan2(yF - yH, (xF - xHd) * sc) * 0.9; if (g.gallop) pitch += g.gallop * m * Math.sin(ph + 1.2); }
    const bobF = g.gallop ? Math.sin(ph + 0.4) : -Math.cos(2 * ph);
    const hy = yH + (this.stand * (p.crouch ?? 1) + g.bob * m * bobF) * sc;
    const sway = g.sway * m * Math.cos(ph) * sc;
    const hp = V().copy(O).addScaledVector(dir, p.s).addScaledVector(lat, sway);
    this.hips.position.set(hp.x / sc, hy / sc, hp.z / sc);
    const yaw = g.yaw * m * Math.sin(ph), Qh = qy(h);
    this.hips.quaternion.copy(qy(h + yaw)).multiply(qz(pitch)).multiply(qx(g.roll * m * Math.cos(ph) + (p.roll || 0)));

    // Colonne, queue en contrepoids, respiration.
    const t = p.t || 0, tr = p.tremble || 0;
    this.tail.forEach((b, i) => {
      const k = i / this.tail.length;
      b.rotation.set(0, g.tailYaw * m * Math.sin(ph - 0.9 - i * 0.55) * (0.5 + k) + (p.tailYaw || 0) * (0.4 + k) + 0.04 * Math.sin(t * 0.9 - i * 0.6),
        (this.tailDroop || 0) + g.tailBob * m * Math.sin(2 * ph - i * 0.6) + pitch * 0.35 - (p.tailLift || 0) * (0.5 + k * 0.5) + 0.02 * Math.sin(t * 0.7 - i * 0.5));
    });
    this.spine.forEach((b, i) => b.rotation.set(0, -yaw * 0.45 + (p.spineYaw || 0), -pitch * 0.2 + (p.spinePitch || 0)));
    const nk = this.neck.length;
    this.neck.forEach((b, i) => {
      b.rotation.set((p.neckRoll || 0) / nk, (-yaw * 0.3 + (p.neckYaw || 0) + g.headBob * m * 0.3 * Math.sin(ph - 0.5)) / nk + tr * 0.02 * noise1(t * 31 + i * 7, 3),
        (-pitch * 0.5 + (p.neckPitch || 0) + g.headBob * m * Math.sin(2 * ph - 0.9 - i * 0.3)) / nk + tr * 0.025 * noise1(t * 37 + i * 3, 4));
    });
    this.head.rotation.set((p.headRoll || 0) + tr * 0.03 * noise1(t * 29, 5), p.headYaw || 0, (p.headPitch || 0) + tr * 0.03 * noise1(t * 41, 6));
    if (this.jaw) this.jaw.rotation.set(0, 0, -(p.jaw || 0) * this.jawMax - tr * 0.03 * (0.5 + 0.5 * noise1(t * 33, 8)));
    if (this.breath) {
      const a = (p.breathAmp ?? 0.03) * Math.sin(t * (p.breathRate ?? 2.2) + (this.phase0 || 0)) + tr * 0.02 * noise1(t * 45, 9);
      this.breath.scale.set(1 + a * 0.3, 1 + a, 1 + a);
    }
    this.rig.updateMatrixWorld(true);

    // Pattes : cinématique inverse analytique vers les appuis au sol.
    const H = V(), pw = Q(), tq = Q(), sq = Q(), fq = Q(), oq = Q(), inv = Q();
    for (const L of this.legs) {
      const st = L.st, [l1, l2, l3] = L.L, [a3, b3, c3] = L.th3;
      const th3 = st.stance ? lerp(a3, b3, Math.pow(st.t, 1.6)) : lerp(lerp(b3, c3, ease(st.sw * 2.2)), a3, ease(st.sw));
      const toeP = st.stance ? 0 : (-0.75 * Math.sin(Math.PI * st.sw) * (1 - st.sw) + 0.3 * smooth(0.55, 1, st.sw)) * (0.3 + 0.7 * m);
      L.thigh.getWorldPosition(H).divideScalar(sc);
      const vx = st.target.x / sc - H.x, vy = st.target.y / sc - H.y, vz = st.target.z / sc - H.z;
      const vf = vx * dir.x + vz * dir.z, vl = vx * lat.x + vz * lat.z, psi = -Math.atan2(vl, -vy), D = Math.hypot(vy, vl);
      let ax = vf - l3 * Math.sin(th3), ay = D - l3 * Math.cos(th3), dist = Math.hypot(ax, ay);
      const maxD = (l1 + l2) * 0.998; if (dist > maxD) { ax *= maxD / dist; ay *= maxD / dist; dist = maxD; }
      const phi = Math.atan2(ax, ay), al = Math.acos(clamp((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), -1, 1));
      const th1 = phi + L.knee * al, kx = l1 * Math.sin(th1), ky = l1 * Math.cos(th1), th2 = Math.atan2(ax - kx, ay - ky);
      const Qb = Qh.clone().multiply(qx(psi));
      L.parent.getWorldQuaternion(pw);
      tq.copy(Qb).multiply(qz(th1)); sq.copy(Qb).multiply(qz(th2)); fq.copy(Qb).multiply(qz(th3)); oq.copy(Qh).multiply(qz(toeP));
      L.thigh.quaternion.copy(inv.copy(pw).invert()).multiply(tq);
      L.shin.quaternion.copy(inv.copy(tq).invert()).multiply(sq);
      L.foot.quaternion.copy(inv.copy(sq).invert()).multiply(fq);
      L.toe.quaternion.copy(inv.copy(fq).invert()).multiply(oq);
    }
    this.rig.updateMatrixWorld(true);
    if (p.headIK && p.headIK.w > 0.001) this.solveHead(p.headIK);
  }

  // Cou et tête : descente de coordonnées cycliques (CCD) vers une cible.
  solveHead({ target, look, w = 1, maxAngle = 0.7, iter = 7 }) {
    const chain = this.neck, pre = chain.map((b) => b.quaternion.clone()), preH = this.head.quaternion.clone();
    const e = V(), j = V(), a = V(), c = V(), bw = Q(), pw = Q(), q = Q(), id = Q();
    for (let it = 0; it < iter; it++) {
      for (let i = chain.length - 1; i >= 0; i--) {
        const b = chain[i];
        this.worldPoint('snout', e); b.getWorldPosition(j);
        a.copy(e).sub(j).normalize(); c.copy(target).sub(j).normalize();
        q.setFromUnitVectors(a, c); q.slerp(id, 0.35).normalize();
        b.getWorldQuaternion(bw); b.parent.getWorldQuaternion(pw);
        b.quaternion.copy(pw.invert()).multiply(q).multiply(bw);
        const ang = 2 * Math.acos(clamp(Math.abs(b.quaternion.w), 0, 1));
        if (ang > maxAngle) b.quaternion.slerpQuaternions(id, b.quaternion, maxAngle / ang);
        b.updateMatrixWorld(true);
      }
      if (look) { this.head.parent.getWorldQuaternion(pw); this.head.quaternion.copy(pw.invert()).multiply(look); this.head.updateMatrixWorld(true); }
    }
    if (w < 1) { chain.forEach((b, i) => b.quaternion.slerpQuaternions(pre[i], b.quaternion, w)); this.head.quaternion.slerpQuaternions(preH, this.head.quaternion, w); }
    this.rig.updateMatrixWorld(true);
  }
}

// Peau : écailles (Voronoï 3D), plis, teinte par écaille, diffusion sous-surfacique simulée.
function skinMaterial(uni) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0, side: THREE.DoubleSide });
  return patch(m, {
    key: 'skin', sunShadow: true, uniforms: uni,
    vpars: `attribute vec3 aRest; attribute vec3 aSkin; varying vec3 vRest; varying vec3 vSkin;`,
    vbegin: `vRest = aRest; vSkin = aSkin;`,
    fpars: `varying vec3 vRest; varying vec3 vSkin; uniform float uScaleF, uWrinkF, uRig, uWetY, uSheen; ${GLSL_SUN} ${GLSL_NOISE}`,
    fcolor: `
      float sAmt = (1.0 - vSkin.y) * (1.0 - vSkin.z);
      float px = length(fwidth(vRest)) * uScaleF;
      float sFade = 1.0 - smoothstep(0.12, 0.5, px);
      vec2 vo = voro3(vRest * uScaleF), vo2 = voro3(vRest * uScaleF * 2.7 + 3.0);
      float cell = smoothstep(0.0, 0.17, vo.x), fine = smoothstep(0.0, 0.22, vo2.x);
      float wr = fbm3(vRest * uWrinkF), wr2 = fbm3(vRest * uWrinkF * 3.1 + 5.0);
      float crease = pow(1.0 - abs(2.0 * wr - 1.0), 5.0) + 0.6 * pow(1.0 - abs(2.0 * wr2 - 1.0), 6.0);
      float sH = ((cell * 0.75 + fine * 0.25 * (1.0 - smoothstep(0.03, 0.12, px))) * 0.0042 * sFade - crease * 0.007 * (1.0 - smoothstep(0.3, 1.5, px))) * sAmt;
      float mott = fbm3(vRest * 1.7 + 11.0);
      diffuseColor.rgb *= mix(1.0, (0.5 + 0.5 * cell) * (0.82 + 0.36 * vo.y), sAmt * sFade);
      diffuseColor.rgb *= mix(1.0, 0.72 + 0.56 * mott, sAmt);
      diffuseColor.rgb *= 1.0 - 0.35 * crease * sAmt;
      float wetS = smoothstep(uWetY + 0.35, uWetY, vRest.y);
      diffuseColor.rgb *= mix(1.0, 0.5, wetS);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.22, 0.045, 0.04) * (0.6 + 0.6 * mott), vSkin.z);`,
    frough: `roughnessFactor = mix(mix(0.8, 0.58, cell * sFade), 0.32, vSkin.y);
      roughnessFactor = mix(roughnessFactor, 0.3, wetS * 0.8); roughnessFactor = mix(roughnessFactor, 0.3, vSkin.z);
      roughnessFactor = mix(roughnessFactor, 0.2, uSheen * 0.0);`,
    fnormal: `normal = bumpN(normal, -vViewPosition, sH * uRig, 1.0);`,
    fend: `{
      vec3 Ls = normalize((viewMatrix * vec4(SUN, 0.0)).xyz), Vv = normalize(vViewPosition);
      vec3 gN = normalize(vNormal) * faceDirection;
      float sh = sunShadow(), NdL = dot(gN, Ls);
      float wrap = max((NdL + 0.55) / 1.55, 0.0) - max(NdL, 0.0);
      float rim = pow(1.0 - max(dot(gN, Vv), 0.0), 3.0) * pow(max(dot(-Vv, Ls), 0.0), 2.0);
      float thru = max(dot(-gN, Ls), 0.0) * vSkin.x;
      vec3 sss = mix(vec3(1.0, 0.30, 0.16), vec3(1.0, 0.5, 0.25), vSkin.x);
      float shW = mix(1.0, sh, smoothstep(-0.05, 0.2, NdL));
      outgoingLight += diffuseColor.rgb * SUNCOL * 11.0 * sss * (wrap * 0.16 * shW + rim * (0.12 + vSkin.x * 0.5) + thru * 0.14);
    }`,
  });
}
