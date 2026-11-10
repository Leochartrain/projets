// Particules : brume en couches, pollen, vapeur de respiration, éclaboussures, terre, salive, feuilles.
// Tout est une fonction pure du temps : aucune simulation à état, donc rendu image par image exact.
import * as THREE from 'three';
import { hash, rng, SEED, lerp, sat, smooth, fract, GLSL_SUN } from './util.js';
import { riverZ } from './world.js';

export class Particles {
  constructor(max = 12000) {
    this.max = max; this.n = 0;
    this.buf = new Float32Array(max * 12); this.tmp = [];
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.ib = new THREE.InstancedInterleavedBuffer(this.buf, 12); this.ib.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', new THREE.InterleavedBufferAttribute(this.ib, 3, 0));
    g.setAttribute('iPar', new THREE.InterleavedBufferAttribute(this.ib, 4, 3));
    g.setAttribute('iCol', new THREE.InterleavedBufferAttribute(this.ib, 4, 7));
    this.geo = g;
    const uni = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]);
    this.mat = new THREE.ShaderMaterial({
      uniforms: uni, transparent: true, depthWrite: false, fog: true,
      vertexShader: `attribute vec3 iPos; attribute vec4 iPar; attribute vec4 iCol;
        varying vec2 vUv; varying vec4 vCol; varying float vKind; varying vec3 vWd;
        #include <fog_pars_vertex>
        void main(){
          vUv = position.xy; vCol = iCol; vKind = iPar.z;
          float c = cos(iPar.y), s = sin(iPar.y);
          vec2 q = vec2(position.x * c - position.y * s, position.x * s + position.y * c) * iPar.x;
          q.y *= 1.0 + iPar.w;
          vec4 mvPosition = viewMatrix * vec4(iPos, 1.0); mvPosition.xy += q;
          vWd = iPos - cameraPosition;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `varying vec2 vUv; varying vec4 vCol; varying float vKind; varying vec3 vWd;
        ${GLSL_SUN}
        #include <fog_pars_fragment>
        void main(){
          float d = length(vUv) * 2.0; if (d > 1.0) discard;
          vec3 wd = normalize(vWd); float sd = max(dot(wd, SUN), 0.0);
          vec3 lit = vec3(0.26, 0.31, 0.35) + SUNCOL * (0.12 + 9.0 * pow(sd, 7.0));
          float a; vec3 c;
          if (vKind < 0.5) { a = pow(1.0 - d, 1.6); c = vCol.rgb * lit; }                       // brume, vapeur
          else if (vKind < 1.5) { a = smoothstep(1.0, 0.5, d) * 0.75; c = vCol.rgb * (vec3(0.5, 0.56, 0.6) + SUNCOL * (1.2 + 14.0 * pow(sd, 4.0)))  // goutte
              + SUNCOL * 14.0 * smoothstep(0.5, 0.05, length(vUv - vec2(0.1, 0.12)) * 2.0) * (0.2 + pow(sd, 3.0)); }
          else if (vKind < 2.5) { float e = d + 0.25 * sin(atan(vUv.y, vUv.x) * 5.0 + vCol.a * 40.0); a = smoothstep(1.0, 0.8, e); c = vCol.rgb * (vec3(0.25, 0.3, 0.33) + SUNCOL * 1.5); } // motte de terre
          else if (vKind < 3.5) { vec2 l = vUv * vec2(2.0, 4.4); a = step(length(l) + abs(vUv.x) * 0.6, 1.0); c = vCol.rgb * (vec3(0.3, 0.36, 0.3) + SUNCOL * (2.0 + 9.0 * pow(sd, 3.0))); } // feuille
          else { a = pow(1.0 - d, 2.0); c = vCol.rgb * (vec3(0.2) + SUNCOL * (1.0 + 24.0 * pow(sd, 5.0))); } // pollen, poussière
          gl_FragColor = vec4(c, a * (vKind > 1.5 && vKind < 2.5 ? 1.0 : vCol.a));
          if (gl_FragColor.a < 0.003) discard;
          #include <fog_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 10;
  }
  begin() { this.tmp.length = 0; }
  add(x, y, z, size, r, g, b, a, kind = 0, rot = 0, stretch = 0) { if (a > 0.002 && size > 0) this.tmp.push([x, y, z, size, rot, kind, stretch, r, g, b, a, 0]); }
  end(cam) {
    const t = this.tmp, cx = cam.position.x, cy = cam.position.y, cz = cam.position.z;
    for (const p of t) p[11] = (p[0] - cx) ** 2 + (p[1] - cy) ** 2 + (p[2] - cz) ** 2;
    t.sort((a, b) => b[11] - a[11]);
    const n = Math.min(t.length, this.max), o = t.length - n;
    for (let i = 0; i < n; i++) this.buf.set(t[i + o].slice(0, 11), i * 12);
    this.geo.instanceCount = n; this.ib.needsUpdate = true; this.mesh.visible = n > 0;
  }
}

// ---------- Brume : nappes fixes tirées une fois pour toutes.
export function makeMist() {
  const R = rng(SEED + 31), valley = [], ground = [];
  for (let i = 0; i < 230; i++) { const x = -330 + R() * 700; valley.push({ x, y: 12 + R() * 30, z: riverZ(x) + (R() - 0.5) * 330, s: 55 + R() * 70, a: 0.10 + R() * 0.16, v: 0.6 + R() * 1.2, r: R() * 6 }); }
  for (let i = 0; i < 220; i++) { const x = -20 + R() * 190; ground.push({ x, y: 0.9 + R() * 4.5, z: riverZ(x) + (R() - 0.5) * 90, s: 7 + R() * 15, a: 0.035 + R() * 0.075, v: 0.15 + R() * 0.4, r: R() * 6 }); }
  return { valley, ground };
}
export function emitMist(P, list, t, k = 1, cam = null) {
  for (const m of list) {
    const x = m.x + m.v * t;
    let a = m.a * k;
    if (cam) { const d = Math.hypot(x - cam.position.x, m.y - cam.position.y, m.z - cam.position.z); a *= smooth(m.s * 0.25, m.s * 0.9, d); } // pas de nappe collée à l'objectif
    P.add(x, m.y + Math.sin(t * 0.3 + m.r) * 0.3, m.z, m.s, 1, 1, 1, a, 0, m.r);
  }
}

// Pollen et poussière en suspension autour de la caméra (volume qui se répète).
export function emitMotes(P, cam, t, focus, n = 420, k = 1) {
  const S = 9, c = cam.position;
  for (let i = 0; i < n; i++) {
    const hx = hash(i, 1, 7), hy = hash(i, 2, 7), hz = hash(i, 3, 7), hs = hash(i, 4, 7);
    const x = c.x + (fract(hx + (0.25 * t + 0.4 * Math.sin(t * 0.5 + i)) / S - c.x / S) - 0.5) * S;
    const y = c.y + (fract(hy + (0.06 * Math.sin(t * 0.7 + i * 1.3) - 0.03 * t) / (S * 0.5) - c.y / (S * 0.5)) - 0.5) * S * 0.5;
    const z = c.z + (fract(hz + (0.1 * t) / S - c.z / S) - 0.5) * S;
    if (y < 0.03) continue;
    const d = Math.hypot(x - c.x, y - c.y, z - c.z), blur = Math.abs(d - focus) / Math.max(d, 0.3) * 0.02;
    const size = 0.006 + hs * 0.012 + blur * d * 0.6;
    const a = 0.75 * smooth(0.25, 0.9, d) * smooth(S * 0.5, S * 0.3, d) * (0.006 + hs * 0.012) ** 2 / (size * size) * (0.5 + 0.5 * Math.sin(t * 3 + i * 2.1)) * k;
    P.add(x, y, z, size, 1, 0.9, 0.7, Math.min(a * 2.5, 0.9), 4);
  }
}

// Éclaboussure ou gerbe de terre à chaque appui (événement précalculé).
export function emitFootfall(P, t, e) {
  const age = t - e.t; if (age < 0 || age > 1.7) return;
  const w = e.w, sq = Math.sqrt(w);
  if (e.water) {
    const n = Math.floor(46 * w + 18);
    for (let i = 0; i < n; i++) {
      const h1 = hash(i, e.id, 1), h2 = hash(i, e.id, 2), h3 = hash(i, e.id, 3), h4 = hash(i, e.id, 4);
      const a = h1 * 6.283, vr = (0.5 + 2.4 * h2) * sq, vy = (1.6 + 4.6 * h3) * sq;
      const x = e.x + Math.cos(a) * vr * age + e.vx * 0.35 * age, z = e.z + Math.sin(a) * vr * age + e.vz * 0.35 * age;
      const y = 0.02 + vy * age - 4.905 * age * age; if (y < 0) continue;
      P.add(x, y, z, (0.012 + 0.022 * h4) * sq, 0.75, 0.82, 0.85, 0.85, 1, 0, Math.min(Math.abs(vy - 9.81 * age) * 0.1, 0.9));
    }
    for (let i = 0; i < 5; i++) { // embruns
      const h1 = hash(i, e.id, 5), h2 = hash(i, e.id, 6), k = age / 1.3; if (k > 1) continue;
      P.add(e.x + (h1 - 0.5) * sq + e.vx * 0.3 * age, 0.3 * sq + (0.6 + h2) * sq * age * 1.4, e.z + (h2 - 0.5) * sq + e.vz * 0.3 * age, (0.6 + 1.8 * k) * sq, 1, 1, 1, 0.11 * (1 - k) * Math.min(age * 12, 1), 0, h1 * 6);
    }
  } else {
    const n = Math.floor(10 * w + 5);
    for (let i = 0; i < n; i++) {
      const h1 = hash(i, e.id, 1), h2 = hash(i, e.id, 2), h3 = hash(i, e.id, 3), h4 = hash(i, e.id, 4);
      const a = h1 * 6.283, vr = (0.4 + 1.6 * h2) * sq, vy = (0.9 + 2.6 * h3) * sq;
      const y = e.y + 0.02 + vy * age - 4.905 * age * age; if (y < e.y) continue;
      P.add(e.x + Math.cos(a) * vr * age, y, e.z + Math.sin(a) * vr * age, (0.015 + 0.04 * h4) * sq, 0.06, 0.045, 0.03, h4, 2, age * 9 + h1 * 6);
    }
    for (let i = 0; i < 3; i++) { const h1 = hash(i, e.id, 5), k = age / 1.6; P.add(e.x + (h1 - 0.5) * sq, e.y + 0.15 + k * 0.5 * sq, e.z + (hash(i, e.id, 6) - 0.5) * sq, (0.5 + 1.6 * k) * sq, 0.5, 0.42, 0.32, 0.16 * (1 - k) * Math.min(age * 10, 1), 0, h1 * 6); }
  }
}

// Vapeur de respiration : chaque bouffée naît à un instant connu, à la position que le museau avait alors.
export function emitVapor(P, t, track, inten, o = {}) {
  const rate = o.rate || 60, life = o.life || 1.7, spd = o.speed || 1.6, j1 = Math.floor(t * rate), j0 = Math.floor((t - life) * rate);
  for (let j = j0; j <= j1; j++) {
    const tb = j / rate, age = t - tb; if (age <= 0 || age >= life) continue;
    const I = inten(tb); if (I <= 0.01 || hash(j, 3, 9) > I) continue;
    const s = track(tb); if (!s) continue;
    const h1 = hash(j, 1, 9) - 0.5, h2 = hash(j, 2, 9) - 0.5, k = age / life, tr = spd * (1 - Math.exp(-age * 2.2)) / 2.2 * (o.push ? 1 + I : 1);
    P.add(s.x + s.dx * tr + h1 * 0.5 * age, s.y + s.dy * tr + 0.22 * age + h2 * 0.3 * age, s.z + s.dz * tr + h2 * 0.5 * age,
      (o.size || 0.14) + (o.grow || 0.8) * age, 1, 1, 1, (o.alpha || 0.2) * Math.min(I, 1) * Math.pow(1 - k, 1.4) * Math.min(age * 3.5, 1), 0, j);
  }
}

export function emitLeaves(P, cam, t, n = 26) {
  const c = cam.position, S = 26;
  for (let i = 0; i < n; i++) {
    const hx = hash(i, 1, 13), hy = hash(i, 2, 13), hz = hash(i, 3, 13);
    const x = c.x + (fract(hx - c.x / S) - 0.5) * S + Math.sin(t * 1.1 + i) * 0.5 + t * 0.4;
    const y = 14 - fract(hy + t * (0.07 + 0.04 * hz)) * 14;
    const z = c.z + (fract(hz - c.z / S) - 0.5) * S + Math.cos(t * 0.9 + i * 2) * 0.5;
    P.add(x, y, z, 0.11 + hx * 0.08, 0.13 + hy * 0.1, 0.12, 0.02, 1, 3, t * (2 + hz * 3) + i);
  }
}
